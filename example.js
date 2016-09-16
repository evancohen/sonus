const Sonus = require('./index.js');

const sonus = new Sonus({
  resource: "resources/common.res",
  model: "resources/snowboy.umdl",
  sensitivity: "0.5",
  audioGain: 2.0
})

sonus.start();

sonus.on('partial-result', function(result) {
  console.log("Partial", result);
})

sonus.on('final-result', function(result) {
  console.log("Final", result);
  if(result.transcript.includes("exit")){
    sonus.stop();
  }
})