'use strict'

const assert = require('assert')
const path = require('path')

// Resolve from the consumer, not this checkout, to exercise a real install.
const root = path.dirname(require.resolve('sonus/package.json', { paths: [process.cwd()] }))
const sonus = require(root)
assert.strictEqual(typeof sonus.init, 'function')
const { Models, Detector } = require(path.join(root, 'snowboy/lib/node'))
const models = new Models()
models.add({ file: path.join(root, 'snowboy/models/snowboy.umdl'), hotwords: 'snowboy' })
const detector = new Detector({
  resource: path.join(root, 'snowboy/common.res'),
  models,
  audioGain: 1,
  applyFrontend: false
})
assert.strictEqual(detector.numHotwords(), 1)
assert.strictEqual(detector.sampleRate(), 16000)
assert.strictEqual(detector.numChannels(), 1)
assert.strictEqual(detector.bitsPerSample(), 16)
const result = detector.runDetection(Buffer.alloc(3200))
assert.ok(result === -2 || result === 0, 'Silence must not trigger a hotword or detection error')
detector.destroy()
console.log('Consumer install and native detector smoke test passed')
