# sonus
Just like Alexa, Google Now, and Siri, sonus is always listening offline for a customizable hotword. Once that hotword is detected, sonus streams what you say to the speech recognition service of your choice and gives you the results. 

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
npm install sonus
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
const {Models} = require('snowboy');
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
});
```

Add your keyword and initialize sonus:
``` javascript
const models = new Models();
models.add({ file: 'resources/snowboy.umdl', hotwords: 'snowboy' });

const sonus = new Sonus({ models: models }, speech);
```

Create your own Alexa in less than 10 lines of code:
``` javascript
sonus.start(); //start listening

sonus.on('hotword', function (index, keyword) {
  console.log("!");
})

sonus.on('final-result', function (result) {
  console.log(result);
  if (result.includes("stop")) {
    sonus.stop(); //stop listening
  }
})
```

## Author
Evan Cohen: [@_evnc](https://twitter.com/_evnc)

## License
Licensed under [MIT](https://github.com/evancohen/sonus/blob/master/LICENSE).


## Todo

- [ ] Create a shim for annyang as an example for a simple command registration system
- [ ] Clean up interface so it's even eaiser to use
