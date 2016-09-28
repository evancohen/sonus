# sonus
Just like Alexa, Google Now, and Siri, sonus is always listening offline for a customizable hotword. Once that hotword is detected, sonus streams what you say to the speech recognition service of your choice and gives you the results. 

**This project is in active development, it's not quite ready for prime time**

### Platform Support 
- [X] Linux - most major distros (Including Raspbian)
- [X] macOS
- [ ] Windows

### Streaming Recognition Services**

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

Add sonus to an existing project:
``` javascript
const Sonus = require('./index.js');
const {Models} = require('snowboy');
```

Add your keyword and initialize sonus:
``` javascript
const models = new Models();
models.add({ file: 'resources/snowboy.umdl', hotwords: 'snowboy' });

const sonus = new Sonus({ models: models });
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

## Todo

- [ ] Integrate a simple command registration system (Annyang?)
- [ ] Clean up interface so it's even eaiser to use
