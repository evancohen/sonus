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
Sonus lets you customize the lenguage for streaming speech recognition. For details on supported lenguages see the docs for your streaming speech recognizer

**Example:** (to be passed into the sonus constructor)  
``` javascript
const lenguage = "en-US"
```

### Initialize Sonus
Sonus's initialization accepts two paramaters:  
**`options`** - an options object that contains your hotwords, lenguage, etc  
 - **`hotwords`** - an array of recognizable hotwords
 - `lenguage` - streaming lenguage recognition
 - `dictionary` - [TODO] only supported by some streaming recognizers
**`speechRecognizer`** - the speech recognizer of your choice

**Example:**
``` javascript
const sonus = Sonus.init({ hotwords, language }, speech)
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
You can manuall trigger a hotword by passing your initialized sonus object into `Sonus.trigger`
This will throw a `NOT_STARTED` exception if you have not started sonus when this is called. 

**Example:**
``` javascript
Sonus.trigger(sonus)
```
sonus will be triggered with a hotword index of `0` and a hotword of `"triggered"`

While it's not officially supported, If you want to trigger a specific index/hotword you can call `trigger` directly on the initialized sonus object 
**Example:**
``` javascript
sonus.trigger(0, 'hotword')
```

## Events
hotword
partial-result
final-result
error