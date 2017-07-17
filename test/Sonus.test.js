const Sonus = require('../index')
const mockData = "mydata"
const mockStream = require('./mockStream')(mockData)
const speech = {}
speech.createRecognizeStream = mockStream
const hotwords = [{
  file: 'resources/snowboy.umdl',
  hotword: 'snowboy'
}]
const sonus = Sonus.init({
  hotwords
}, speech)

describe("Sonus", () => {
  beforeEach(() => {
    Sonus.start(sonus)
  })

  afterEach(() => {
    Sonus.stop(sonus)
  })

  it("listen event", () => {
    sonus.on('hotword', () => console.log("!"))
    sonus.on('final-result', console.log)
  })

  it("trigger hotword", () => {
    sonus.on('hotword', () => console.log("!"))
    sonus.on('final-result', (data) => {
      expect(data).toBe(mockData)
    })
    Sonus.trigger(sonus, 1)
  })
})