
// add integrations in folder

const integrations = ['google', 'watson']
let integration

// loop through integrations
integrations.map(name => {
    try { integration = require('./' + name) } catch (e) {
      console.warn('require error', name)
    }
    if (integration) module.exports[name] = integration
    else console.warn('missing integration for', name)
})

/* can be used like

const googleSpeech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
})

const speech = require('sonus/integrations').google(googleSpeech)

OR

var watsonSpeech = new require('watson-developer-cloud/speech-to-text/v1')({
  username: '<username>',
  password: '<password>'
});

const speech = require('sonus/integrations').watson(watsonSpeech)

*/
