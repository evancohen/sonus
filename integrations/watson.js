// IBM Watson integration - Flynn Buckingham

// ToDo: Add viable runtime configuration
const config = {
	objectMode: true,
	interim_results: true,
	'content-type': 'audio/l16; rate=44100'
};

module.exports = watson => {
	if (typeof watson != 'object') return console.error('invalid instance')

	const isSocket = true;

	return {
		isSocket,
		streamingRecognize: options => watson.createRecognizeStream(config),
		errorEvent: data => {
			console.log('error', data)
		},
		partitalEvent: data => {
			console.log('partial data', data)
		},
		finalEvent: data => {
			console.log('final data')
		}
	}
}
