var Readable = require("stream").Readable
var util = require("util")
var _transcript
module.exports = transcript => {
  _transcript = transcript
  return mockStream
}

function mockStream(options) {
  if (!(this instanceof mockStream)) return new mockStream(options)
  if (!options) options = {}
  options.objectMode = true
  Readable.call(this, options)
}

util.inherits(mockStream, Readable)

mockStream.prototype._read = function read() {
  this.emit("data", {
    results: [{
      isFinal: true,
      transcript: _transcript
    }]
  })
}