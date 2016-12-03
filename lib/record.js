'use strict';

const {Detector, Models} = require('snowboy')
const {spawn} = require('child_process')
const stream = require('stream')


var recording, // Will hold our passthrough audio stream
    cp;        // Recording process

// returns a Readable stream
exports.start = function (options) {
  rec = null; // Empty out possibly dead recording process

  var defaults = {
    sampleRate : 16000,
    compress   : false,
    threshold  : 0.5,
    verbose    : false,
    recordProgram : 'rec'
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
            'silence', '1','0.1', options.threshold + '%',
            '1','1.0', options.threshold + '%'
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

  // Fill recording stream with stdout
  rec.on('data', function (data) {

    if (options.verbose)
      console.log('Recording %d bytes', data.length);
  });

  // Verbose ending
  rec.on('end', function () {

    if (options.verbose)
      console.timeEnd('End Recording');
  });

  return rec;

};

exports.stop = function () {
  if (typeof cp === 'undefined')
  {
    console.log('Please start a recording first');
    return false;
  }

 cp.kill(); // Exit the spawned process, exit gracefully
 return recording;
};