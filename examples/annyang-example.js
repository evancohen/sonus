'use strict'

const ROOT_DIR = __dirname + '/../'
const Sonus = require(ROOT_DIR + 'index.js')
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: ROOT_DIR + 'keyfile.json'
})

const hotwords = [{ file: ROOT_DIR + 'resources/sonus.pmdl', hotword: 'sonus' }]
const language = "en-US"
const sonus = Sonus.init({ hotwords, language }, speech)

const commands = {
  'hello': function () {
    console.log('You will obey');
  },
  '(give me) :flavor ice cream': function (flavor) {
    console.log('Fetching some ' + flavor + ' ice ceam for you sr')
  },
  'turn (the)(lights) :state (the)(lights)': function (state) {
    console.log('Turning the lights', (state == 'on') ? state : 'off')
  }
}

Sonus.annyang.addCommands(commands)

Sonus.start(sonus)
console.log('Say "' + hotwords[0].hotword + '"...')
sonus.on('hotword', (index, keyword) => console.log("!" + keyword))
sonus.on('partial-result', result => console.log("Partial", result))

sonus.on('final-result', result => {
  console.log("Final", result)
  if (result.includes("stop")) {
    Sonus.stop()
  }
})