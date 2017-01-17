const util = require('util')
const stream = require('stream')

var RingBuffer = function (size) {
    this.buffer_ = new Buffer.alloc(size, 0, 'binary');
    this.size_ = size;
    this.position_ = 0;
};

/**
 * Copies the internal buffer into a new buffer that is ordered
 * and can be fead into the recognizer. Does not alter the buffer.
 */
RingBuffer.prototype.getOrderedBuffer = function (callback) {
    // Create a new buffer that is in a correct order
    var temp = new Buffer.alloc(this.size_, 0, 'binary')
    this.buffer_.copy(temp, 0, this.position_);
    this.buffer_.copy(temp, 0, 0, this.position_);
    callback(temp)
    return true;
};

/**
 * Puts bytes from a source buffer into the internal buffer.  Compacts the buffer
 * if needed.  Returns if the operation was successful.  put() will fail if the
 * internal buffer (after compaction) does not have space to hold the source
 * buffer.
 */
RingBuffer.prototype.push = function (chunk) {
    if(this.size_ < chunk.length) {
        // We don't have enough space in the ring
        chunk.slice(chunk.length - this.size_).copy(this.buffer_)
        this.position_ = 0;
    } else if (this.position_ + chunk.length >= this.size_){
        // We need to wrap the ring
        chunk.copy(this.buffer_, this.position_, this.size_)
        chunk.slice(this.position_).copy(this.buffer_)
        this.position_ = chunk.length - ((this.size_ - this.position_) - 2)
    } else {
        // We have space to copy
        chunk.copy(this.buffer_, this.position_)
        this.position_ = this.position_ + chunk.length
    }

    return true;
};


/** 
 * Buffer Stream with ring buffer 
 */
var BufferStream = function (bufferSize) {
    stream.Transform.apply(this, arguments);
    this.sumanReady = false;
    this.buffer = new RingBuffer(bufferSize);
};

util.inherits(BufferStream, stream.Transform);

BufferStream.prototype._transform = function (chunk, encoding, done) {
    // custom buffering logic
    // ie. add chunk to this.buffer, check buffer size, etc.

    if (this.sumanReady) {
        this.push(chunk);
    }
    else {
        this.buffer.push(chunk);
    }

    done()
};

/**
 * When the transform stream is piped, 
 * write its internal buffer to the stream.
 */
BufferStream.prototype.pipe = function (destination, options) {
    var res = BufferStream.super_.prototype.pipe.apply(this, arguments);
    this.buffer.getOrderedBuffer(function (b){
        res.write(b);
    })
    this.sumanReady = true;
    return res;
};

/**
 * When the transform stream is unpiped, 
 * begin writing to the buffer again.
 */
BufferStream.prototype.unpipe = function (destination, options) {
    var res = BufferStream.super_.prototype.pipe.apply(this, arguments);
    this.sumanReady = false;
    return res;
};

module.exports = BufferStream;