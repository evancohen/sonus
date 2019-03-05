'use strict'

const record = require('node-record-lpcm16')
const stream = require('stream')
const { Detector, Models } = require('snowboy')
const consecutiveEmptyBuffers = 20;
var emptybufferCounter=0;
var timer=null
const ERROR = {
  NOT_STARTED: "NOT_STARTED",
  INVALID_INDEX: "INVALID_INDEX"
}

const CloudSpeechRecognizer = {}
CloudSpeechRecognizer.init = recognizer => {
  const csr = new stream.Writable()
  csr.listening = false
  csr.recognizer = recognizer
  return csr
}

CloudSpeechRecognizer.startStreaming = (options, audioStream, cloudSpeechRecognizer) => {
  if (cloudSpeechRecognizer.listening) {
    return
  }

  let hasResults = false
  cloudSpeechRecognizer.listening = true

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: options.language,
      speechContexts: options.speechContexts || null
    },
    singleUtterance: true,
    interimResults: true,
  }

  const recognitionStream = cloudSpeechRecognizer.recognizer
    .streamingRecognize(request)
    .on('error', err => {
      cloudSpeechRecognizer.emit('error', err)
      stopStream()
    })
    .on('data', data => {
      if (data.results[0] && data.results[0].alternatives[0]) {
        hasResults = true;
        // Emit partial or final results and end the stream
        if (data.error) {
          cloudSpeechRecognizer.emit('error', data.error)
          stopStream()
        } else if (data.results[0].isFinal) {
          cloudSpeechRecognizer.emit('final-result', data.results[0].alternatives[0].transcript)
          stopStream()
        } else {
          cloudSpeechRecognizer.emit('partial-result', data.results[0].alternatives[0].transcript)
        }
      } else {
        // Reached transcription time limit
        if(!hasResults){
          cloudSpeechRecognizer.emit('final-result', '')
        }
        stopStream()
      }
    })

  const stopStream = () => {
    cloudSpeechRecognizer.listening = false
    audioStream.unpipe(recognitionStream)
    recognitionStream.end()
  }

  audioStream.pipe(recognitionStream)
}

const Sonus = {}
var detector = null;
Sonus.annyang = require('./lib/annyang-core.js')

Sonus.init = (options, recognizer) => {
  // don't mutate options
  const opts = Object.assign({}, options),
    models = new Models(),
    sonus = new stream.Writable(),
    csr = CloudSpeechRecognizer.init(recognizer)
  sonus.mic = {}
  sonus.recordProgram = opts.recordProgram
  sonus.device = opts.device
  sonus.started = false

  // If we don't have any hotwords passed in, add the default global model
  opts.hotwords = opts.hotwords || [1]
  opts.hotwords.forEach(model => {
    models.add({
      file: model.file || 'node_modules/snowboy/resources/snowboy.umdl',
      sensitivity: model.sensitivity || '0.5',
      hotwords: model.hotword || 'default'
    })
  })

  // defaults
  opts.models = models
  opts.resource = opts.resource || 'node_modules/snowboy/resources/common.res'
  opts.audioGain = opts.audioGain || 2.0
  opts.language = opts.language || 'en-US' //https://cloud.google.com/speech/docs/languages

  sonus.opts=opts
  Sonus.setupDetector(sonus)

  // Handle speech recognition requests
  csr.on('error', error => sonus.emit('error', { streamingError: error }))
  csr.on('partial-result', transcript => sonus.emit('partial-result', transcript))
  csr.on('final-result', transcript => {
    sonus.emit('final-result', transcript)
    if(transcript.length>0)
      Sonus.annyang.trigger(transcript)
  })

  sonus.trigger = (index, hotword) => {
    if (sonus.started) {
      try {
        let triggerHotword = (index == 0) ? hotword : models.lookup(index)
        sonus.emit('hotword', index, triggerHotword)
        CloudSpeechRecognizer.startStreaming(opts, sonus.mic, csr)
      } catch (e) {
        throw ERROR.INVALID_INDEX
      }
    } else {
      throw ERROR.NOT_STARTED
    }
  }

  sonus.pause = () => {
    record.pause()
  }

  sonus.resume = () => {
    record.resume()
  }

  return sonus
}

Sonus.setupDetector = (sonus) => {
  
  detector = sonus.detector = new Detector(sonus.opts)

  detector.on('silence', () => {emptybufferCounter=0; sonus.emit('silence')})
  detector.on('sound', (data) => {
    // only process sound events if we are not in recovery mode, otherwise we get a random segment fault
		if(timer==null){
			// the arecord process has a bug, where it will start sending empty wav 'files' over and over.
			// the only recovery is to kill that process, and start a new one
			// so we are looking for a set of consecutive empty 
			//	(or very small data, testing shows 8, 12, and 44 byte buffers) 
			//  pcm data buffers as the indicator that arecord is stuck
      //  normal buffer size if 4096 bytes in 16000 hz recording mode
			//  if there is no sound data, only header, count it
			if((data.length<100) && (++emptybufferCounter)){
				// if we have consecutive no data packets, then arecord is stuck
				if(emptybufferCounter>consecutiveEmptyBuffers){
					// stop reco, this will force kill the pcm application
					record.stop()
					// and clear the consecutive buffer counter
					emptybufferCounter=0;
					// setup the restart timer, as we are on a callback now
					timer=setTimeout(function(){ Sonus.restart(sonus)}, 100);
				}	
			} else{
				// have data
				// reset the consecutive empty counter 
				emptybufferCounter=0;
        sonus.emit('sound', data)
			}
		}
  })
  // if the reco engine closes on its own
	detector.on('close', close_msg => {
		// if we are not already in recovery mode
		if(timer==null){
			console.error("!e:", close_msg)
			// the process has ended 
			// set value to prevent recursion
			timer=1
			// stop the reco processing, clean up
			record.stop()
			emptybufferCounter=0;
			// setup to restart reco
			timer=setTimeout(function() {Sonus.restart(sonus)}, 200);	
		}
	})
	detector.on('end', end_msg => {
		// place holder for end notification
		console.error("!e:", end_msg)
	})
  // When a hotword is detected pipe the audio stream to speech detection
  detector.on('hotword', (index, hotword) => {
    sonus.trigger(index, hotword)
  })

}
//  used to enable restarting the pcm recorder and detector
Sonus.restart = source => {  
  timer = null;
  // detector has to be replaced on restart
  Sonus.setupDetector(source.opts)  
  Sonus.start(source)
}

Sonus.start = sonus => {
  // start the pcm data recorder
  sonus.mic = record.start({
    threshold: 0,
    device: sonus.device || null,
    recordProgram: sonus.recordProgram || "rec",
    verbose: false
  })
  // pipe the data to the detector
  sonus.mic.pipe(sonus.detector)
  sonus.started = true
}

Sonus.trigger = (sonus, index, hotword) => sonus.trigger(index, hotword)

Sonus.pause = () => record.pause()

Sonus.resume = () => record.resume()

Sonus.stop = () => record.stop()

module.exports = Sonus
