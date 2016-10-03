const Sonus = require('./index.js')
const {Models} = require('snowboy')
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
})

const models = new Models()
models.add({ file: 'resources/snowboy.umdl', hotwords: 'snowboy' })

const sonus = Sonus.init({ models: models }, speech)
Sonus.start(sonus)

console.log('Say "snowboy"...')

sonus.on('hotword', function (index, keyword) {
  console.log("!")
})

sonus.on('partial-result', function (result) {
  console.log("Partial", result)
})

sonus.on('final-result', function (result) {
  console.log("Final", result)
  if (result.includes("stop")) {
    Sonus.stop()
  }
})
