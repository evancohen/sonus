'use strict'

const record = require('node-record-lpcm16')
const stream = require('stream')
const { Detector, Models } = require('snowboy')

const ERROR = {
  NOT_STARTED: "NOT_STARTED",
  INVALID_INDEX: "INVALID_INDEX"
}

const SILENCE_TIMEOUT = 6 // timeout in samples for sockets

const CloudSpeechRecognizer = {}
CloudSpeechRecognizer.init = recognizer => {
  const csr = new stream.Writable()
  csr.listening = false
  csr.recognizer = recognizer

  // bind integration hooks
  if (recognizer.finalEvent) csr.on('final-result', recognizer.finalEvent)
  if (recognizer.partitalEvent) csr.on('partial-result', recognizer.partitalEvent)
  if (recognizer.errorEvent) csr.on('error', recognizer.errorEvent)

  return csr
}

CloudSpeechRecognizer.startStreaming = (options, audioStream, cloudSpeechRecognizer) => {
  if (cloudSpeechRecognizer.listening) {
    return
  }

  let hasResults = false
  cloudSpeechRecognizer.listening = true

  // ToDo: remove this in favor of cross-platform config
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

  const onSilence = () => (silent = true)
  const onSound = () => {
    if (silent) silent = false
  }

  let silent = false
  cloudSpeechRecognizer.on('silence', onSilence)
  cloudSpeechRecognizer.on('sound', onSound)

  const recognitionStream = cloudSpeechRecognizer.recognizer
    .streamingRecognize(request)
    .on('error', err => {
      cloudSpeechRecognizer.emit('error', err)
      stopStream()
    })
    .on('data', data => {
      const firstResult = (data.results) ? data.results[0] : null
      if (firstResult && firstResult.alternatives[0]) {
        hasResults = true
        cloudSpeechRecognizer.emit('raw', data)
        // Emit partial or final rcsresults and end the stream
        if (data.error) {
          cloudSpeechRecognizer.emit('error', data.error)
          stopStream()
        } else if (firstResult.isFinal || firstResult.final) {
          cloudSpeechRecognizer.emit('final-result', firstResult.alternatives[0].transcript)
          stopStream()
        } else {
          cloudSpeechRecognizer.emit('partial-result', firstResult.alternatives[0].transcript)
        }
      } else {
        // Reached transcription time limit
        if(!hasResults){
          cloudSpeechRecognizer.emit('final-result', '')
        }
        stopStream()
      }
    })

  let silenceCount = 0

  const socketEvent = data => {
    if (silent) silenceCount++

    if (silenceCount > SILENCE_TIMEOUT){
      stopStream()
      silenceCount = 0
    } else recognitionStream.write(data)
  }

  const stopStream = () => {
    cloudSpeechRecognizer.listening = false

    if (cloudSpeechRecognizer.recognizer.isSocket) audioStream.removeListener('data', socketEvent)
    else audioStream.unpipe(recognitionStream)

    cloudSpeechRecognizer.removeListener('silence', onSilence)
    cloudSpeechRecognizer.removeListener('sound', onSound)

    recognitionStream.end()
  }

  if (cloudSpeechRecognizer.recognizer.isSocket) audioStream.on('data', socketEvent)
  else audioStream.pipe(recognitionStream)
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

  detector.on('silence', () => {
    csr.emit('silence')
    sonus.emit('silence')
  })
  detector.on('sound', () => {
    csr.emit('sound')
    sonus.emit('sound')
  })

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
  csr.on('raw', rawData => sonus.emit('raw', rawData))

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
