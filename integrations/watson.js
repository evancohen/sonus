// IBM Watson integration - Flynn Buckingham

// ToDo: Add viable runtime configuration
const config = {
	objectMode: true,
	model: 'en-US_BroadbandModel',
	'content-type': 'audio/l16; rate=16000'
};

module.exports = watson => {
	if (typeof watson != 'object') return console.error('invalid instance')

	return {
		streamingRecognize: options => watson.createRecognizeStream(config)
	}
}
