<p align="center">
<img src="./sonus.png" alt="sonus" />
</p>
<p align="center">
<a href="https://travis-ci.org/evancohen/sonus"><img src="https://api.travis-ci.org/evancohen/sonus.svg?branch=master" alt="Build Status"/></a>
<a href="https://codeclimate.com/github/evancohen/sonus"><img src="https://codeclimate.com/github/evancohen/sonus/badges/gpa.svg" /></a>
<a href='https://dependencyci.com/github/evancohen/sonus'><img src='https://dependencyci.com/github/evancohen/sonus/badge' alt='Dependency Status'/></a>
</p>
<p align="center">
<strong>A dead simple STT library in Node</strong>
</p>

Sonus lets you quickly and easally add a VUI (Voice User Interface) to any hardware or software project. Just like Alexa, Google Now, and Siri, Sonus is always listening offline for a *customizable* hotword. Once that hotword is detected your speech is streamed to the cloud recognition service of your choice - then you get the results.

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
Recommended: use `arecord`, which comes with most linux distros.
Alternatively:
```
sudo apt-get install sox libsox-fmt-all
```

### For macOS
```
brew install sox
```

## Usage

Configure out cloud speech recognition system of choice, like [Google Cloud
Speech API](https://cloud.google.com/speech/docs/getting-started).

Add sonus and said recognizer:
``` javascript
const Sonus = require('sonus')
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
})
```

Add your keyword and initialize Sonus with a [Snowboy](https://snowboy.kitt.ai)
hotword:
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

### [Full API Documentation](docs/API.md)

## Versioning

This project uses semantic versioning as of `v0.1.0`

## How do I set up Google Cloud Speech API?

Follow [these instructions](https://cloud.google.com/speech/docs/getting-started).

## How do I make my own hotword?

Sonus uses [Snowboy](https://snowboy.kitt.ai) for offline hotword recognition.
You can use [their website](https://snowboy.kitt.ai) or
[API](http://docs.kitt.ai/snowboy/#restful-api) to train a model for a new
hotword. Hotword training must occur online through their web service.


## Built [#withsonus](https://twitter.com/hashtag/withsonus?src=github)
- [L.I.S.A. - Home automation project](https://github.com/mylisabox/lisa-box)

*If you've build a project with Sonus send a PR and include it here!*

## Authors
Evan Cohen: [@_evnc](https://twitter.com/_evnc)  
Ashish Chandwani: [@ashishschandwa1](https://twitter.com/ashishschandwa1)

## License
Licensed under [MIT](https://github.com/evancohen/sonus/blob/master/LICENSE).
