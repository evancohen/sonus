const Sonus = require('./index.js');
const {Models} = require('snowboy');

const models = new Models();
models.add({file: 'resources/snowboy.umdl', sensitivity: '0.5', hotwords : 'snowboy'});

const sonus = new Sonus({resource: "resources/common.res", models: models, audioGain: 2.0});
sonus.start();

sonus.on('partial-result', function(result) {
  console.log("Partial", result);
})

sonus.on('final-result', function(result) {
  console.log("Final", result);
  if(result.includes("stop")){
    sonus.stop();
  }
})