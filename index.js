'use strict'

const record = require('node-record-lpcm16')
const stream = require('stream')
const path = require('path')

const ERROR = { NOT_STARTED: 'NOT_STARTED', INVALID_INDEX: 'INVALID_INDEX' }
const ARECORD_FILE_LIMIT = 1500000000
const RECORDER_STOP_TIMEOUT = 8000
// node-record-lpcm16 owns one recording process, so only one instance may record.
let activeSonus = null
const Sonus = {}
Sonus.annyang = require('./lib/annyang-core.js')

const stopStreaming = csr => {
  if (csr.stopStreaming) csr.stopStreaming()
}

const startStreaming = sonus => {
  const csr = sonus.csr
  if (csr.listening || !sonus.started || sonus.paused) return
  const audio = sonus.mic
  let recognition
  try {
    recognition = csr.recognizer.streamingRecognize({
      config: {
        encoding: 'LINEAR16', sampleRateHertz: 16000,
        languageCode: sonus.opts.language,
        speechContexts: sonus.opts.speechContexts || null
      },
      singleUtterance: true, interimResults: true
    })
  } catch (error) {
    csr.emit('error', error)
    return
  }
  let stopped = false
  let finalReceived = false
  const stop = () => {
    if (stopped) return
    stopped = true
    csr.listening = false
    csr.stopStreaming = null
    audio.unpipe(recognition)
    recognition.removeListener('data', onData)
    recognition.removeListener('end', onEnd)
    recognition.removeListener('close', onEnd)
    // Retain the guarded error listener to absorb errors arriving after end().
    recognition.end()
  }
  const onError = error => {
    if (stopped) return
    stop()
    csr.emit('error', error)
  }
  const onEnd = () => {
    if (stopped) return
    stop()
    if (!finalReceived) csr.emit('final-result', '')
  }
  const onData = data => {
    if (stopped || !data) return
    if (data.error) return onError(data.error)
    const results = Array.isArray(data.results) ? data.results : []
    for (const result of results) {
      const alternative = result.alternatives && result.alternatives[0]
      if (!alternative) continue
      if (result.isFinal) {
        finalReceived = true
        // Clean up before notifying callers, which may immediately start again.
        stop()
        csr.emit('final-result', alternative.transcript || '')
        return
      }
      csr.emit('partial-result', alternative.transcript || '')
    }
    // Speech-event-only responses may precede the final transcript. Keep reading.
  }
  csr.listening = true
  csr.stopStreaming = stop
  recognition.on('error', onError).on('data', onData)
    .on('end', onEnd).on('close', onEnd)
  audio.pipe(recognition)
}

const disconnect = sonus => {
  stopStreaming(sonus.csr)
  if (sonus.detachMic) sonus.detachMic()
  if (sonus.mic && sonus.detector) sonus.mic.unpipe(sonus.detector)
}

const stopRecorder = (sonus, restart) => {
  disconnect(sonus)
  if (sonus.pendingStop) {
    if (!restart) sonus.pendingStop.restart = false
    return sonus.pendingStop.child
  }
  const pending = { restart, child: null, timer: null }
  sonus.pendingStop = pending
  const finish = () => {
    clearTimeout(pending.timer)
    if (pending.child) {
      pending.child.removeListener('close', finish)
      pending.child.removeListener('error', fail)
    }
    sonus.pendingStop = null
    if (activeSonus === sonus) activeSonus = null
    if (pending.restart && sonus.started) {
      try { openRecorder(sonus) } catch (error) {
        sonus.started = false
        sonus.emit('error', { recordingError: error })
      }
    }
  }
  const fail = error => {
    clearTimeout(pending.timer)
    pending.restart = false
    sonus.started = false
    // Keep ownership until this specific process closes; never kill by name.
    sonus.emit('error', { recordingError: error })
  }
  try {
    pending.child = record.stop()
  } catch (error) {
    fail(error)
    return
  }
  if (!pending.child) {
    pending.restart = false
    sonus.started = false
    finish()
    return
  }
  pending.child.once('close', finish).on('error', fail)
  pending.timer = setTimeout(() => fail(new Error('Recorder did not stop within 8 seconds')), RECORDER_STOP_TIMEOUT)
  if (pending.timer.unref) pending.timer.unref()
  if (pending.child.exitCode != null || pending.child.signalCode != null) finish()
  return pending.child
}

const openRecorder = sonus => {
  activeSonus = sonus
  sonus.byteCount = 0
  try {
    sonus.mic = record.start({
      threshold: 0, device: sonus.device || null,
      recordProgram: sonus.recordProgram, verbose: false
    })
  } catch (error) {
    activeSonus = null
    sonus.started = false
    throw error
  }
  const mic = sonus.mic
  const onError = error => {
    if (sonus.mic !== mic || sonus.pendingStop || !sonus.started) return
    Sonus.stop(sonus)
    sonus.emit('error', { recordingError: error })
  }
  const onEnd = () => {
    if (sonus.started && !sonus.pendingStop) onError(new Error('Recorder stream ended unexpectedly'))
  }
  const onData = data => {
    sonus.byteCount += data.length
    if (sonus.byteCount > ARECORD_FILE_LIMIT && !sonus.pendingStop) stopRecorder(sonus, true)
  }
  sonus.detachMic = () => {
    mic.removeListener('data', onData)
    // Leave the guarded error handler for late errors from the old stream.
    mic.removeListener('end', onEnd)
    sonus.detachMic = null
  }
  mic.on('error', onError).on('end', onEnd)
  if (sonus.recordProgram === 'arecord') mic.on('data', onData)
  if (sonus.detector) mic.pipe(sonus.detector, { end: false })
  if (sonus.paused) mic.pause()
  else if (!sonus.detector) startStreaming(sonus)
}

Sonus.init = (options, recognizer) => {
  const opts = Object.assign({ language: 'en-US', recordProgram: 'rec', audioGain: 1.0 }, options)
  opts.language = opts.language || 'en-US'
  opts.audioGain = opts.audioGain != null ? opts.audioGain : 1.0
  const sonus = new stream.Writable()
  const csr = sonus.csr = new stream.Writable()
  csr.listening = false
  csr.recognizer = recognizer
  sonus.opts = opts
  sonus.mic = null
  sonus.recordProgram = opts.recordProgram || 'rec'
  sonus.device = opts.device
  sonus.started = false
  sonus.paused = false
  sonus.pendingStop = null
  if (opts.hotwords !== -1) {
    const { Detector, Models } = require('snowboy')
    const models = new Models()
    const hotwords = opts.hotwords || [{}]
    if (!Array.isArray(hotwords) || hotwords.length === 0) throw new TypeError('hotwords must be a non-empty array or -1')
    hotwords.forEach(model => models.add({
      file: model.file || path.join(__dirname, 'resources/snowboy.umdl'),
      sensitivity: model.sensitivity || '0.5', hotwords: model.hotword || 'default'
    }))
    opts.models = models
    opts.resource = opts.resource || path.join(__dirname, 'resources/common.res')
    const detector = sonus.detector = new Detector(opts)
    detector.on('silence', () => sonus.emit('silence'))
    detector.on('sound', () => sonus.emit('sound'))
    detector.on('error', error => {
      Sonus.stop(sonus)
      sonus.emit('error', { detectionError: error || new Error('Snowboy detection failed') })
    })
    detector.on('hotword', (index, hotword) => {
      if (sonus.started && !sonus.paused && !sonus.pendingStop) sonus.trigger(index, hotword)
    })
    sonus.trigger = (index, hotword) => {
      if (!sonus.started || sonus.paused || sonus.pendingStop) throw ERROR.NOT_STARTED
      let triggerHotword
      try { triggerHotword = index === 0 ? hotword : models.lookup(index) } catch (error) {
        throw ERROR.INVALID_INDEX
      }
      sonus.emit('hotword', index, triggerHotword)
      startStreaming(sonus)
    }
  } else {
    sonus.trigger = () => {
      if (!sonus.started || sonus.paused || sonus.pendingStop) throw ERROR.NOT_STARTED
      startStreaming(sonus)
    }
  }
  csr.on('error', error => sonus.emit('error', { streamingError: error }))
  csr.on('partial-result', transcript => sonus.emit('partial-result', transcript))
  csr.on('final-result', transcript => {
    sonus.emit('final-result', transcript)
    if (sonus.detector) Sonus.annyang.trigger(transcript)
  })
  sonus.pause = () => Sonus.pause(sonus)
  sonus.resume = () => Sonus.resume(sonus)
  return sonus
}

Sonus.start = sonus => {
  if (activeSonus && activeSonus !== sonus) throw new Error('Recorder is already in use by another Sonus instance')
  if (sonus.pendingStop) throw new Error('Recorder is still stopping')
  if (sonus.started) {
    // In conversational mode, another start requests the next phrase.
    if (!sonus.detector) startStreaming(sonus)
    return
  }
  sonus.started = true
  sonus.paused = false
  openRecorder(sonus)
}
Sonus.trigger = (sonus, index, hotword) => sonus.trigger(index, hotword)
Sonus.pause = (sonus = activeSonus) => {
  if (!sonus || activeSonus !== sonus || !sonus.started) return
  sonus.paused = true
  stopStreaming(sonus.csr)
  if (sonus.mic) sonus.mic.pause()
}
Sonus.resume = (sonus = activeSonus) => {
  if (!sonus || activeSonus !== sonus || !sonus.started || !sonus.paused) return
  sonus.paused = false
  if (!sonus.pendingStop) {
    if (!sonus.detector) startStreaming(sonus)
    sonus.mic.resume()
  }
}
Sonus.stop = (sonus = activeSonus) => {
  if (!sonus || activeSonus !== sonus) return
  sonus.started = false
  sonus.paused = false
  return stopRecorder(sonus, false)
}
module.exports = Sonus
