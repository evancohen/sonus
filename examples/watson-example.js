// 'use strict'

const ROOT_DIR = __dirname + '/../'
const Sonus = require(ROOT_DIR + 'index.js')

const WatsonClass = require('watson-developer-cloud/speech-to-text/v1');
const watsonSpeech = new WatsonClass({
  "url": "https://stream.watsonplatform.net/speech-to-text/api",
  "username": "<username>",
  "password": "<password>"
})

const speech = require( ROOT_DIR + 'integrations').watson(watsonSpeech)

console.log(speech)

const hotwords = [{ file: ROOT_DIR + 'resources/sonus.pmdl', hotword: 'sonus' }]
const language = "en-US"

//recordProgram can also be 'arecord' which works much better on the Pi and low power devices
const sonus = Sonus.init({ hotwords, language, recordProgram: "rec" }, speech)

Sonus.start(sonus)
console.log('Say "' + hotwords[0].hotword + '"...')

sonus.on('hotword', (index, keyword) => console.log("!" + keyword))

sonus.on('data', result => console.log("data", result))

sonus.on('partial-result', result => console.log("Partial", result))

sonus.on('error', error => console.log('error', error))

sonus.on('final-result', result => {
  console.log("Final", result.toString('utf-8'))
  if (result.includes("stop")) {
    Sonus.stop()
  }
})
