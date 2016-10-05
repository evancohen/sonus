# sonus
Just like Alexa, Google Now, and Siri, sonus is always listening offline for a *customizable* hotword. Once that hotword is detected your speech is streamed to the cloud recognition service of your choice - then you get the results [#withsonus](https://twitter.com/hashtag/withsonus?src=github).

**This project is in active development, it's not quite ready for prime time**

### Platform Support 
- [X] Linux - most major distros (Including Raspbian)
- [X] macOS
- [ ] Windows

### Streaming Recognition Services

- [X] Google Cloud Speech
- [ ] Alexa Voice Services
- [ ] Wit.ai
- [ ] Microsoft Cognitive Services
- [ ] Houndify

## Installation

```
npm install --save sonus
```

## Dependencies

Generally, running `npm install` should suffice. This module however, requires you to install [SoX](http://sox.sourceforge.net).

### For most linux disto's
```
sudo apt-get install sox libsox-fmt-all
```

### For macOS
```
brew install sox
```

## Usage 

Add sonus and your cloud speech recognition system of choice:
``` javascript
const Sonus = require('sonus');
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
});
```

Add your keyword and initialize sonus:
``` javascript
const hotwords = [{ file: 'resources/snowboy.umdl', hotword: 'snowboy' }]

const sonus = Sonus.init({ hotwords }, speech)
```

Create your own Alexa in less than a tweet:
``` javascript
Sonus.start(sonus)

sonus.on('hotword', (index, keyword) => console.log("!"))

sonus.on('final-result', console.log)

```

## Authors
Evan Cohen: [@_evnc](https://twitter.com/_evnc)
Ashish Chandwani: [@ashishschandwa1](https://twitter.com/ashishschandwa1)

## License
Licensed under [MIT](https://github.com/evancohen/sonus/blob/master/LICENSE).
