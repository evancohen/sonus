'use strict'

const Sonus = require('./index.js')
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
})

const hotwords = [{ file: 'resources/snowboy.umdl', hotword: 'snowboy' }]
const language = "en-US"
const sonus = Sonus.init({ hotwords, language }, speech)

Sonus.start(sonus)
console.log('Say "snowboy"...')

sonus.on('hotword', (index, keyword) => console.log("!"))

sonus.on('partial-result', result => console.log("Partial", result))

sonus.on('final-result', result => {
  console.log("Final", result)
  if (result.includes("stop")) {
    Sonus.stop()
  }
})
