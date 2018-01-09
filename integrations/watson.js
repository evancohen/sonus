// IBM Watson integration

module.exports = speech => {
	if (typeof speech != 'function') return console.error('invalid instance')

	return speech
}
