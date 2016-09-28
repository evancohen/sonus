'use strict'

const record = require('node-record-lpcm16')
const stream = require('stream')
const {Detector} = require('snowboy')

class CloudSpeechRecognizer extends stream.Writable {
  constructor(recognizer) {
    super()
    this.listening = false
    this.recognizer = recognizer
  }

  startStreaming(audioStream) {
    const _self = this
    if (_self.listening)
      return

    _self.listening = true

    const recognitionStream = _self.recognizer.createRecognizeStream({
      config: {
        encoding: 'LINEAR16',
        sampleRate: 16000
      },
      singleUtterance: true,
      interimResults: true,
      verbose: true
    })

    recognitionStream.on('error', function (error) {
      _self.emit('error', error)
    })

    recognitionStream.on('data', function (data) {
      if (data) {
        _self.emit('data', data)
        if (data.endpointerType == 'END_OF_AUDIO') {
          _self.listening = false
        }
      }
    })

    audioStream.pipe(recognitionStream)
  }
}

class Sonus extends stream.Writable {
  constructor(options, recognizer) {
    super()
    const _self = this
    _self.mic = {}
    _self.csr = new CloudSpeechRecognizer(recognizer)

    options.resource = options.resource || "node_modules/snowboy/resources/common.res"
    options.audioGain = options.audioGain || 2.0

    _self.detector = new Detector(options)

    this.detector.on('silence', function () {
      _self.emit('silence')
    })

    this.detector.on('sound', function () {
      _self.emit('sound')
    })

    // When a hotword is detected pipe the audio stream to speech detection
    this.detector.on('hotword', function (index, hotword) {
      _self.emit('hotword', index, hotword)
      _self.csr.startStreaming(_self.mic)
    })

    this.csr.on('error', function (error) {
      _self.emit('error', { streamingError: error })
    })

    this.csr.on('data', function (data) {
      if (data.results[0]) {
        if (data.results[0].isFinal) {
          _self.emit('final-result', data.results[0].transcript)
        } else {
          _self.emit('partial-result', data.results[0].transcript)
        }
      }
    })
  }

  start() {
    this.mic = record.start({
      threshold: 0,
      verbose: false
    })
    this.mic.pipe(this.detector)
  }

  stop() {
    record.stop()
  }

}

module.exports = Sonus