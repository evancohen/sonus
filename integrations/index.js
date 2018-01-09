
// add integrations in folder

const integrations = ['google', 'watson']
let integration

// loop through integrations
integrations.map(name => {
	try { integration = require('./' + name) } catch (e) {}
	if (integration) module.exports[name] = integration
	else console.warn('missing integration for', name)
})

/* can be used like
const googleSpeech = require('sonus/integrations').google
  or
const { watson } = require('sonus/integrations')

*/
