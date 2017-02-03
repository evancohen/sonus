## API Methods

Paramaters marked in **bold** are required

### Require sonus and a cloud speech recognizer in your project:
``` javascript
const Sonus = require('sonus')
const speech = require('@google-cloud/speech')({
  projectId: 'streaming-speech-sample',
  keyFilename: './keyfile.json'
})
```
For more information about Google Cloud Speech see: https://cloud.google.com/speech/
Note: don't forget to enable billing!

### Custom hotwords
You can train and download custom hotwords for sonus from https://snowboy.kitt.ai  
In order to initialize Sonus you need to pass in 1 or more hotwords.
Each hotword supports the following proporties: 
**`file`** - The path to your hotword model (either pmdl or umdl)  
**`hotword`** - The string that represents your hotword (ex: "sonus")  
`sensitivity` - (default `'0.5'`) If you are getting a lot of false positives or are having trouble detecting your hotword adjusting this value shoud help

**Example:** (to be passed into the sonus constructor)  
``` javascript
const hotwords = [
    {file: '/mymodel.pmdl', hotword: 'sonus'},
    {file: 'snowboy.umdl', hotword: 'snowboy'}]
```

### Languages
Sonus lets you customize the language for streaming speech recognition. For details on supported languages see the docs for your streaming speech recognizer

**Example:** (to be passed into the sonus constructor)  
``` javascript
const language = "en-US"
```

### Initialize Sonus
Sonus's initialization accepts two paramaters:  
**`options`** - an options object that contains your hotwords, language, etc  
 - **`hotwords`** - an array of recognizable hotwords
 - `language` - streaming language recognition
 - `speechContext` - Array of strings containing words/phrases so that the speech recognizer is more likely to recognize them.
 - `recordProgram` - (default `'rec'`) Supports:
   - `'rec'` - Good for OSX
   - `'sox'` - Sometimes `rec` is aliased to this (not often)
   - `'arecord'`- Reccomended for low powered linux devices (Pi, CHIP, etc)
 - `device` - [Only for 'arecord'] device identifier. ex: "hw:1,0"  

**`speechRecognizer`** - the speech recognizer of your choice

**Example:**
``` javascript
const sonus = Sonus.init({ hotwords, language, recordProgram: 'arecord' }, speech)
```

### Start recognition
Pass your initialized sonus object into `Sonus.start`
**Example:**
``` javascript
Sonus.start(sonus)
```

### Pause recognition
Pass your initialized sonus object into `Sonus.pause`.
Pausing recognition while streaming will not cancel the request, instead it will cause it to simulate the "end" of speech and return final results.
**Example:**
``` javascript
Sonus.pause(sonus)
```

### Resume recognition
Pass your initialized sonus object into `Sonus.resume`
**Example:**
``` javascript
Sonus.resume(sonus)
```

### Stop recognition
If you want to stop recognition enterly you can use `Sonus.stop`
**Example:**
``` javascript
Sonus.stop(sonus)
```
Note that after recognition is stopped it can not be started again without creating an enterly new sonus instance.

### Trigger keyword/hotword manually
You can manuall trigger a hotword by passing your initialized sonus object and an index into `Sonus.trigger`
The indexes of your hotwords are base 1 and are deturmined by the order in which the hotwords are passed into `Sonus.init`

**Exceptions**
- `NOT_STARTED` - will be thrown if you have not started sonus when this is called.
- `INVALID_INDEX` - will be thrown if you pass an invalid index.

**Example:**
``` javascript
Sonus.trigger(sonus, 1)
```
sonus will be triggered with a hotword index of `1`

You can also optionally specify an index of `0` and an arbitrary hotword that will be returned in the `hotword` event
**Example:**
``` javascript
sonus.trigger(sonus, 0, 'some hotword')
```
sonus will be triggered with a hotword index of `1` and a hotword of `some hotword`

Passing a hotword with a valid index will override the hotword name and trigger that hotword
**Example:**
``` javascript
sonus.trigger(sonus, 1, 'override')
```
## Events
hotword
partial-result
final-result
error
