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
  }

  startStreaming(audioStream) {
    const _self = this;

    audioStream.pipe(speech.createRecognizeStream({
      config: {
        encoding: 'LINEAR16',
        sampleRate: 16000
      },
      singleUtterance: true,
      interimResults: true,
      verbose: true
    }))
    .on('error', function(error){
      _self.emit('error', error);
    })
    .on('data', function(data) {
      if (data) {
        _self.emit('data', data);
      }
    });
  }
}



// BEGIN SONUS
class Sonus extends stream.Writable {
  constructor(options) {
    super();

    const _self = this;
    // Set up Snowboy
    this._mic = {};
    this._detector = new Detector(options);
    this._gs = new GoogleSpeechRecognition();

    this._detector.on('silence', function () {
      _self.emit('silence');
    })

    this._detector.on('sound', function () {
      _self.emit('sound');
    })

    // When a hotword is detected pipe the audio stream to speech detection
    this._detector.on('hotword', function (index, hotword) {
      _self.emit('hotword', index, hotword)
      _self._gs.startStreaming(_self._mic);
    });

    this._gs.on('error', function (error) {
      _self.emit('error', { streamingError: error });
    });

    this._gs.on('data', function (data) {
      if (data.results[0]){
        if(data.results[0].isFinal){
           _self.emit('final-result', data.results[0].transcript);
        } else {
           _self.emit('partial-result', data.results[0].transcript);
        }
      }
    });
    this._gs.on('end', function () {
      //Nothing to do here
      console.log("TIME TO UNPIPE")
    });
  }

  start() {
    this._mic = record.start({
      threshold: 0,
      verbose: false
    });
    this._mic.pipe(this._detector);
  }

  stop() {
    record.stop();
  }

}

module.exports = Sonus;