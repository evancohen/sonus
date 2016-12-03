'use strict';

const {Detector, Models} = require('snowboy')
const {spawn} = require('child_process')
const stream = require('stream')

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

    cloudSpeechRecognizer.listening = true

    const recognizer = cloudSpeechRecognizer.recognizer
    const recognitionStream = recognizer.createRecognizeStream({
        config: {
            encoding: 'LINEAR16',
            sampleRate: 16000,
            languageCode: options.language
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

    return recognitionStream
}

// ________________________________________________________________________________________________

var cp;        // Recording process

// returns a Readable stream
var record = {
    start: function (options, sonus) {
        rec = null; // Empty out possibly dead recording process

        var defaults = {
            sampleRate: 16000,
            compress: false,
            threshold: 0.5,
            verbose: false,
            recordProgram: 'rec'
        };

        options = Object.assign(defaults, options);

        // Capture audio stream
        var cmd, cmdArgs;
        switch (options.recordProgram) {
            // On some Windows machines, sox is installed using the "sox" binary
            // instead of "rec"
            case 'sox':
            case 'rec':
            default:
                cmd = options.recordProgram;
                cmdArgs = [
                    '-q',                     // show no progress
                    '-r', options.sampleRate, // sample rate
                    '-c', '1',                // channels
                    '-e', 'signed-integer',   // sample encoding
                    '-b', '16',               // precision (bits)
                    '-t', 'wav',              // audio type
                    '-',                      // pipe
                    // end on silence
                    'silence', '1', '0.1', options.threshold + '%',
                    '1', '1.0', options.threshold + '%'
                ];
                break;
            // On some systems (RasPi), arecord is the prefered recording binary
            case 'arecord':
                cmd = 'arecord';
                cmdArgs = [
                    '-q',                     // show no progress
                    '-r', options.sampleRate, // sample rate
                    '-c', '1',                // channels
                    '-t', 'wav',              // audio type
                    '-f', 'S16_LE',           // Sample format
                    '-',                      // pipe
                ];
                break;
        }

        if (options.verbose)
            console.log('Recording with sample rate', options.sampleRate + '...');

        // Spawn audio capture command
        cp = spawn(cmd, cmdArgs, { encoding: 'binary' })
        var rec = cp.stdout;

        if (options.verbose)
            console.time('End Recording');

        
        let currentCSRInstance = {}
        let language = "en-US"

        // Fill recording stream with stdout
        rec.on('data', function (data) {

            if (options.verbose)
                console.log('Recording %d bytes', data.length);
            
            let detected = sonus.detector.runDetection(data)

            if(detected >= 1 && !sonus.csr.listening){
                currentCSRInstance = CloudSpeechRecognizer.startStreaming({language}, sonus.mic, sonus.csr)
            }
            
            if(sonus.csr.listening){
                currentCSRInstance.write(data)
            }
        });

        // Verbose ending
        rec.on('end', function () {

            if (options.verbose)
                console.timeEnd('End Recording');
        });

        return rec;

    },

    stop: function () {
        if (typeof cp === 'undefined') {
            console.log('Please start a recording first');
            return false;
        }

        cp.kill(); // Exit the spawned process, exit gracefully
        return recording;
    }
}

// ________________________________________________________________________________________________

const Sonus = {}
Sonus.annyang = require('./lib/annyang-core.js')

Sonus.init = (options, recognizer) => {
    // don't mutate options
    const opts = Object.assign({}, options),
        models = new Models(),
        sonus = new stream.Writable()
    sonus.csr = CloudSpeechRecognizer.init(recognizer)
    sonus.mic = {}

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
        sonus.emit('hotword', index, hotword)
    })

    sonus.csr.on('error', error => sonus.emit('error', { streamingError: error }))

    sonus.csr.on('data', data => {
        const result = data.results[0]
        if (result) {
            if (result.isFinal) {
                sonus.emit('final-result', result.transcript)
                Sonus.annyang.trigger(result.transcript)
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
    }, sonus)
}

Sonus.pause = sonus => sonus.mic.pause()

Sonus.resume = sonus => sonus.mic.resume()

Sonus.stop = () => record.stop()

module.exports = Sonus