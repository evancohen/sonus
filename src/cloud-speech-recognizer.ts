import { Writable } from 'stream';

export class CloudSpeechRecognizer {
  private _listening: boolean;
  private _recognizer: any;
  private _stream: Writable;

  constructor(recognizer) {
    this._recognizer = recognizer;
    this._stream = new Writable();
    this._listening = false;
  }

  public startStreaming(options, audioStream) {
    if (this._listening) {
      return;
    }

    this._listening = true;

    const recognitionStream = this._recognizer.createRecognizeStream({
      config: {
        encoding: 'LINEAR16',
        sampleRate: 16000,
        languageCode: options.language,
        speechContext: options.speechContext || null
      },
      singleUtterance: true,
      interimResults: true,
      verbose: true
    });

    recognitionStream.on('error', err => this._stream.emit('error', err));
    recognitionStream.on('data', data => {
      if (data) {
        this._stream.emit('data', data);
        if (data.endpointerType === 'END_OF_UTTERANCE') {
          this._listening = false;
          audioStream.unpipe(recognitionStream);
        }
      }
    });

    audioStream.pipe(recognitionStream);
  }

  public on(event, handler) {
    this._stream.on(event, handler);
  }
}
