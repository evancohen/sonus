'use strict';
// Google Speech Dependencies
const path = require('path');
const grpc = require('grpc');
const googleProtoFiles = require('google-proto-files');
const googleAuth = require('google-auto-auth');

//Sonus dependencies
const record = require('node-record-lpcm16');
const stream = require('stream');
const Snowboy = require('snowboy');


// Load gRPC proto files for speech recognition
function _getSpeechProto() {
  var PROTO_ROOT_DIR = googleProtoFiles('..');
  var protoDescriptor = grpc.load({
    root: PROTO_ROOT_DIR,
    file: path.relative(PROTO_ROOT_DIR, googleProtoFiles.speech.v1beta1)
  }, 'proto', {
      binaryAsBase64: true,
      convertFieldsToCamelCase: true
    });
  return protoDescriptor.google.cloud.speech.v1beta1;
}

// Authenticate with Google
function _getGoogleAuthClient(speechProto, resolve, reject) {
  // Set auth scopes
  var googleAuthClient = googleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  googleAuthClient.getAuthClient(function (err, authClient) {
    if (err) {
      reject(error);
    }
    var credentials = grpc.credentials.combineChannelCredentials(
      grpc.credentials.createSsl(),
      grpc.credentials.createFromGoogleCredential(authClient)
    );
    console.log('Loading speech service...');
    resolve(new speechProto.Speech('speech.googleapis.com', credentials));
  });
}

// Request transformation
var _toRecognizeRequest = new stream.Transform({ objectMode: true });
_toRecognizeRequest._transform = function (chunk, encoding, done) {
  done(null, {
    audioContent: chunk
  });
};

// Streaming: Google Speech Recognition
class GoogleSpeechRecognition extends stream.Writable {
  constructor() {
    super();
    this.speechServicePromise = new Promise(
      function (resolve, reject) {
        _getGoogleAuthClient(_getSpeechProto(), resolve, reject);
      }
    );
  }

  startStreaming(audioStream) {
    const _this = this;
    this.speechServicePromise.then(function (speechService) {
      var call = speechService.streamingRecognize()

      // Listen for various responses
      call.on('error', function (error) {
        _this.emit('error', error);
      });

      call.on('data', function (recognizeResponse) {
        if (recognizeResponse) {
          _this.emit('response', recognizeResponse);
          //after we get a final result, unpipe
          if(recognizeResponse.results[0] && recognizeResponse.results[0].isFinal){
            audioStream.unpipe(_toRecognizeRequest)
          }
        }
      });
      call.on('end', function () {
        _this.emit('end');
        _this.end();
      });

      // Write the initial recognize reqeust
      call.write({
        streamingConfig: {
          config: {
            encoding: 'LINEAR16',
            sampleRate: 16000
          },
          interimResults: true,
          singleUtterance: true
        }
      });

      // Stream the audio to the Speech API
      audioStream
        .pipe(_toRecognizeRequest)
        .pipe(call);
    }, function (error) {
      // An authorization error occured with Google.
      _this.emit('error', error);
    });
  }
}



// BEGIN SONUS
class Sonus extends stream.Writable {
  constructor(options) {
    super();

    const _this = this;
    // Set up Snowboy
    this._mic = {};
    this._snowboy = new Snowboy(options);
    this._gs = new GoogleSpeechRecognition();

    this._snowboy.on('silence', function () {
      console.log('silence');
    })

    this._snowboy.on('noise', function () {
      console.log('noise');
    })

    // When a hotword is detected pipe the audio stream to speech detection
    this._snowboy.on('hotword', function (index) {
      console.log("Keyword spotted:", index);
      _this._gs.startStreaming(_this._mic);
    });

    this._gs.on('error', function (error) {
      this.emit('error', { streamingError: error });
    });

    this._gs.on('response', function (response) {
      if (response.results[0]){
        if(response.results[0].isFinal){
           _this.emit('final-result', response.results[0].alternatives[0]);
        } else {
           _this.emit('partial-result', response.results[0].alternatives[0])
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
    this._mic.pipe(this._snowboy);
  }

  stop() {
    record.stop();
  }

}

module.exports = Sonus;