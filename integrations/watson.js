// IBM Watson integration - Flynn Buckingham

// ToDo: Add viable runtime configuration
const config = {
    objectMode: true,
    interim_results: true,
    'content-type': 'audio/l16; rate=16000'
}

module.exports = watson => {
    if (typeof watson != 'object') return console.error('invalid instance')

    const isSocket = true

    return {
        isSocket,
        streamingRecognize: () => watson.createRecognizeStream(config)
    }
}
