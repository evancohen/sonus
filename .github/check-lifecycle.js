'use strict'

// CI-only regression checks. No microphone, credentials, native addon or timers.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { EventEmitter } = require('events')
const { PassThrough, Writable, Duplex } = require('stream')

function fixture(options = {}) {
  const mics = [], children = [], requests = [], channels = [], errors = []
  const timers = new Set()
  let starts = 0, stops = 0, synchronousError
  class Models {
    add(model) { this.model = model }
    lookup(index) { if (index !== 1) throw new Error('bad index'); return 'hello' }
  }
  class Detector extends Writable {
    constructor(opts) { super(); this.opts = opts }
    _write(chunk, encoding, callback) { callback() }
  }
  const record = {
    start() {
      starts++
      const mic = new PassThrough()
      const child = new EventEmitter()
      child.exitCode = null
      child.signalCode = null
      mics.push(mic); children.push(child)
      return mic
    },
    stop() { stops++; return children[children.length - 1] }
  }
  const recognizer = {
    streamingRecognize(request) {
      if (synchronousError) throw synchronousError
      requests.push(request)
      const channel = new Duplex({ objectMode: true, read() {}, write(data, enc, cb) { cb() } })
      const end = channel.end.bind(channel)
      channel.endCalls = 0
      channel.end = () => { channel.endCalls++; return end() }
      channels.push(channel)
      return channel
    }
  }
  const mod = { exports: {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8'), {
    module: mod, __dirname: path.join(__dirname, '..'),
    require(name) {
      if (name === 'node-record-lpcm16') return record
      if (name === 'snowboy') return { Models, Detector }
      if (name === './lib/annyang-core.js') return { trigger() {} }
      return require(name)
    },
    setTimeout(fn) { const timer = { fn, unref() {} }; timers.add(timer); return timer },
    clearTimeout(timer) { timers.delete(timer) }
  })
  const Sonus = mod.exports
  const sonus = Sonus.init(options, recognizer)
  sonus.on('error', error => errors.push(error))
  const tick = () => new Promise(resolve => setImmediate(resolve))
  return { Sonus, sonus, mics, children, requests, channels, errors, timers, recognizer,
    starts: () => starts, stops: () => stops, tick,
    syncError(error) { synchronousError = error },
    close(index = children.length - 1) { children[index].exitCode = 0; children[index].emit('close', 0) }
  }
}

const checks = []
function check(name, fn) { checks.push([name, fn]) }

check('legacy no-argument stop resets state and ends cloud stream', async () => {
  const f = fixture({ hotwords: -1 }); f.Sonus.start(f.sonus)
  f.Sonus.stop()
  assert.strictEqual(f.sonus.started, false)
  assert.strictEqual(f.sonus.csr.listening, false)
  assert.strictEqual(f.channels[0].endCalls, 1)
  f.close(); f.Sonus.stop()
  assert.strictEqual(f.stops(), 1)
})
check('inactive instance cannot stop another recorder; start is exclusive and idempotent', () => {
  const f = fixture(); const other = f.Sonus.init({}, {})
  f.Sonus.start(f.sonus); f.Sonus.start(f.sonus)
  assert.strictEqual(f.starts(), 1)
  f.Sonus.stop(other); assert.strictEqual(f.stops(), 0)
  assert.throws(() => f.Sonus.start(other), /already in use/)
  f.Sonus.stop(); assert.throws(() => f.Sonus.start(f.sonus), /still stopping/)
  f.close(); f.Sonus.start(other); assert.strictEqual(f.starts(), 2)
  f.Sonus.stop(); f.close()
})
check('conversation defaults, repeated phrases and empty event responses', () => {
  const f = fixture({ hotwords: -1 }); f.Sonus.start(f.sonus)
  assert.strictEqual(f.requests[0].config.languageCode, 'en-US')
  f.channels[0].emit('data', { speechEventType: 'END_OF_SINGLE_UTTERANCE' })
  assert.strictEqual(f.sonus.csr.listening, true)
  let final
  f.sonus.on('final-result', text => { final = text; f.Sonus.start(f.sonus) })
  f.channels[0].emit('data', { results: [{ isFinal: true, alternatives: [{ transcript: 'hello' }] }] })
  assert.strictEqual(final, 'hello')
  assert.strictEqual(f.starts(), 1)
  assert.strictEqual(f.channels.length, 2)
  f.channels[0].emit('error', new Error('late error'))
  assert.strictEqual(f.errors.length, 0)
  assert.strictEqual(f.sonus.csr.listening, true)
  f.Sonus.stop(); f.close()
})
check('cloud setup and response errors retain their cause and allow retry', () => {
  const f = fixture(); f.Sonus.start(f.sonus)
  const cause = new Error('credentials')
  f.syncError(cause); f.Sonus.trigger(f.sonus, 1)
  assert.strictEqual(f.errors[0].streamingError, cause)
  assert.strictEqual(f.sonus.csr.listening, false)
  f.syncError(null); f.Sonus.trigger(f.sonus, 1)
  f.channels[0].emit('data', { error: cause })
  assert.strictEqual(f.channels[0].endCalls, 1)
  assert.strictEqual(f.errors[1].streamingError, cause)
  assert.throws(() => f.Sonus.trigger(f.sonus, 2), error => error === 'INVALID_INDEX')
  f.Sonus.stop(); f.close()
})
check('cloud EOF resets listening and emits empty final once', () => {
  const f = fixture({ hotwords: -1 }); let finals = 0
  f.sonus.on('final-result', () => finals++)
  f.Sonus.start(f.sonus); f.channels[0].emit('end'); f.channels[0].emit('close')
  assert.strictEqual(finals, 1); assert.strictEqual(f.sonus.csr.listening, false)
  f.Sonus.trigger(f.sonus); assert.strictEqual(f.channels.length, 2)
  f.Sonus.stop(); f.close()
})
check('arecord rollover reconnects conversation and resets byte counts', async () => {
  const f = fixture({ hotwords: -1, recordProgram: 'arecord' }); f.Sonus.start(f.sonus)
  f.sonus.byteCount = 1500000000
  f.mics[0].write(Buffer.alloc(2)); await f.tick()
  assert.strictEqual(f.stops(), 1); assert.strictEqual(f.starts(), 1)
  assert.strictEqual(f.channels[0].endCalls, 1)
  f.close(0)
  assert.strictEqual(f.starts(), 2); assert.strictEqual(f.channels.length, 2)
  assert.strictEqual(f.sonus.byteCount, 0)
  f.Sonus.stop(); f.close()
})
check('stop during rollover never resurrects recording', async () => {
  const f = fixture({ recordProgram: 'arecord' }); f.Sonus.start(f.sonus)
  f.sonus.byteCount = 1500000000; f.mics[0].write(Buffer.alloc(2)); await f.tick()
  f.Sonus.stop(); f.close()
  assert.strictEqual(f.starts(), 1); assert.strictEqual(f.sonus.started, false)
  assert.strictEqual(f.timers.size, 0)
})
check('rollover timeout is reported and does not restart later', async () => {
  const f = fixture({ recordProgram: 'arecord' }); f.Sonus.start(f.sonus)
  f.sonus.byteCount = 1500000000; f.mics[0].write(Buffer.alloc(2)); await f.tick()
  for (const timer of [...f.timers]) timer.fn()
  assert.match(f.errors[0].recordingError.message, /did not stop/)
  assert.strictEqual(f.sonus.started, false)
  f.close(); assert.strictEqual(f.starts(), 1)
})
check('pause and resume work without nonexistent recorder pause methods', () => {
  const f = fixture({ hotwords: -1 }); f.Sonus.start(f.sonus)
  f.sonus.pause(); assert.strictEqual(f.mics[0].isPaused(), true)
  assert.strictEqual(f.sonus.csr.listening, false)
  f.sonus.resume(); assert.strictEqual(f.sonus.csr.listening, true)
  assert.strictEqual(f.starts(), 1); assert.strictEqual(f.channels.length, 2)
  f.Sonus.stop(); f.close()
})
check('recorder EOF and detector errors clean up rather than disappear', async () => {
  const f = fixture(); f.Sonus.start(f.sonus)
  f.mics[0].end(); await f.tick()
  assert.strictEqual(f.sonus.started, false)
  assert.match(f.errors[0].recordingError.message, /ended unexpectedly/)
  assert.strictEqual(f.sonus.detector.writableEnded, false)
  f.close()
  f.Sonus.start(f.sonus)
  const cause = new Error('detection')
  f.sonus.detector.emit('error', cause)
  assert.strictEqual(f.errors[1].detectionError, cause)
  assert.strictEqual(f.sonus.started, false)
  f.close()
})

;(async () => {
  for (const [name, run] of checks) { await run(); console.log('PASS:', name) }
  console.log(`${checks.length} lifecycle regression checks passed`)
})().catch(error => { console.error(error); process.exitCode = 1 })
