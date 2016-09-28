'use strict';
// Google Speech Dependencies
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
});

//Sonus dependencies
const record = require('node-record-lpcm16');
const stream = require('stream');
const {Detector} = require('snowboy');

// Streaming: Google Speech Recognition
class GoogleSpeechRecognition extends stream.Writable {
  constructor() {
    super();
    this.listening = false
  }

  startStreaming(audioStream) {
    const _self = this;
    if (_self.listening)
      return;

    _self.listening = true;

    const recognitionStream = speech.createRecognizeStream({
      config: {
        encoding: 'LINEAR16',
        sampleRate: 16000
      },
      singleUtterance: true,
      interimResults: true,
      verbose: true
    });

    recognitionStream.on('error', function (error) {
      _self.emit('error', error);
    })

    recognitionStream.on('data', function (data) {
      if (data) {
        _self.emit('data', data);
        if (data.endpointerType == 'END_OF_AUDIO') {
          _self.listening = false;
        }
      }
    })

    audioStream.pipe(recognitionStream);
  }
}

class Sonus extends stream.Writable {
  constructor(options) {
    super();
    const _self = this;
    _self.mic = {};
    _self.detector = new Detector(options);
    _self._gs = new GoogleSpeechRecognition();

    // Forward event emitters
    this.detector.on('silence', function () {
      _self.emit('silence');
    })

    this.detector.on('sound', function () {
      _self.emit('sound');
    })

    // When a hotword is detected pipe the audio stream to speech detection
    this.detector.on('hotword', function (index, hotword) {
      _self.emit('hotword', index, hotword)
      _self._gs.startStreaming(_self.mic);
    })

    this._gs.on('error', function (error) {
      _self.emit('error', { streamingError: error });
    })

    this._gs.on('data', function (data) {
      if (data.results[0]) {
        if (data.results[0].isFinal) {
          _self.emit('final-result', data.results[0].transcript);
        } else {
          _self.emit('partial-result', data.results[0].transcript);
        }
      }
    })
  }

  start() {
    this.mic = record.start({
      threshold: 0,
      verbose: false
    });
    this.mic.pipe(this.detector);
  }

  stop() {
    record.stop();
  }

}

module.exports = Sonus;