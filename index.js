'use strict'

const record = require('node-record-lpcm16')
const stream = require('stream')
const {Detector} = require('snowboy')

const CloudSpeechRecognizer = {}
CloudSpeechRecognizer.init = recognizer => {
  const csr = new stream.Writable()
  csr.listening = false
  csr.recognizer = recognizer
  return csr
}

CloudSpeechRecognizer.startStreaming = (audioStream, cloudSpeechRecognizer) => {
  if (cloudSpeechRecognizer.listening) {
    return
  }

  cloudSpeechRecognizer.listening = true

  const recognizer = cloudSpeechRecognizer.recognizer
  const recognitionStream = recognizer.createRecognizeStream({
    config: {
      encoding: 'LINEAR16',
      sampleRate: 16000
    },
    singleUtterance: true,
    interimResults: true,
    verbose: true
  })

  recognitionStream.on('error', err => cloudSpeechRecognizer.emit('error', err))


  recognitionStream.on('data', data => {
    if (data) {
      cloudSpeechRecognizer.emit('data', data)
      if (data.endpointerType === 'END_OF_AUDIO') {
        cloudSpeechRecognizer.listening = false
      }
    }
  })

  audioStream.pipe(recognitionStream)
}

const Sonus = {}
Sonus.init = (options, recognizer) => {
  // don't mutate options
  const opts = Object.assign({}, options)

  const sonus = new stream.Writable()
  sonus.mic = {}
  const csr = CloudSpeechRecognizer.init(recognizer)

  // defaults
  opts.resource = options.resource || 'node_modules/snowboy/resources/common.res'
  opts.audioGain = options.audioGain || 2.0

  const detector = sonus.detector = new Detector(opts)

  detector.on('silence', () => sonus.emit('silence'))
  detector.on('sound', () => sonus.emit('sound'))

  // When a hotword is detected pipe the audio stream to speech detection
  detector.on('hotword', (index, hotword) => {
    sonus.emit('hotword', index, hotword)
    CloudSpeechRecognizer.startStreaming(sonus.mic, csr)
  })

  csr.on('error', error => sonus.emit('error', { streamingError: error }))

  csr.on('data', data => {
    const result = data.results[0]
    if (result) {
      if (result.isFinal) {
        sonus.emit('final-result', result.transcript)
      } else {
        sonus.emit('partial-result', result.transcript)
      }
    }
  })
  return sonus
}

Sonus.start = sonus => {
  sonus.mic = record.start({
    threshold: 0,
    verbose: false
  })

  sonus.mic.pipe(sonus.detector)
}

Sonus.stop = () => record.stop()

module.exports = Sonus
