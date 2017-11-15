'use strict'

const record = require('node-record-lpcm16')
const stream = require('stream')
const { Detector, Models } = require('snowboy')

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

  const detector = sonus.detector = new Detector(opts)

  detector.on('silence', () => sonus.emit('silence'))
  detector.on('sound', () => sonus.emit('sound'))

  // When a hotword is detected pipe the audio stream to speech detection
  detector.on('hotword', (index, hotword) => {
    sonus.trigger(index, hotword)
  })

  // Handel speech recognition requests
  csr.on('error', error => sonus.emit('error', { streamingError: error }))
  csr.on('partial-result', transcript => sonus.emit('partial-result', transcript))
  csr.on('final-result', transcript => {
    sonus.emit('final-result', transcript)
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

Sonus.start = sonus => {
  sonus.mic = record.start({
    threshold: 0,
    device: sonus.device || null,
    recordProgram: sonus.recordProgram || "rec",
    verbose: false
  })

  sonus.mic.pipe(sonus.detector)
  sonus.started = true
}

Sonus.trigger = (sonus, index, hotword) => sonus.trigger(index, hotword)

Sonus.pause = () => record.pause()

Sonus.resume = () => record.resume()

Sonus.stop = () => record.stop()

module.exports = Sonus
