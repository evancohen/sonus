
module.exports = speech => {
	if (typeof speech != 'function') return console.error('invalid instance')

	// do nothing since default is google integration
	return speech
}
