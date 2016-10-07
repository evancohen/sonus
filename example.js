'use strict'

const Sonus = require('./index.js')
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
})

const hotwords = [{ file: 'resources/sonus.pmdl', hotword: 'sonus' }]
const language = "en-US"
const sonus = Sonus.init({ hotwords, language }, speech)

Sonus.start(sonus)
console.log('Say "' + hotwords[0].hotword + '"...')

sonus.on('hotword', (index, keyword) => console.log("!"))

sonus.on('partial-result', result => console.log("Partial", result))

sonus.on('final-result', result => {
  console.log("Final", result)
  if (result.includes("stop")) {
    Sonus.stop()
  }
})
