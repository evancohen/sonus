import { Detector, Models } from 'snowboy';
import { start as startRecording, stop as stopRecording } from 'node-record-lpcm16';
import { Writable } from 'stream';
import { annyang } from '../lib/annyang-core.js';
import { CloudSpeechRecognizer } from './cloud-speech-recognizer';

const ERROR = {
  NOT_STARTED: "NOT_STARTED",
  INVALID_INDEX: "INVALID_INDEX"
};

export function init(options, recognizer) {
  return new Sonus(options, recognizer);
}

class Sonus {
  private _opts: any;
  private _stream: Writable;
  private _csr: CloudSpeechRecognizer;
  private _mic: any;
  private _recordProgram: string;
  private _device: any;
  private _started: boolean;
  private _models: Models;
  private _detector: Detector;
  private _transcriptEmpty: boolean;

  public annyang = annyang;

  constructor(options, recognizer) {
    this._opts = { ...options };
    this._stream = new Writable();
    this._csr = new CloudSpeechRecognizer(recognizer);

    this._mic = {};
    this._recordProgram = this._opts.recordProgram;
    this._device = this._opts.device;
    this._started = false;

    // Create a hotword detector, and listen for hotwords.
    this._models = new Models();
    const hotwords = this._opts.hotwords || [1];
    hotwords.forEach((model) => {
      this._models.add({
        file: model.file || 'resources/snowboy.umdl',
        sensitivity: model.sensitivity || '0.5',
        hotwords: model.hotword || 'default'
      });
    });

    const detectorOptions = {
      models: this._models,
      resource: options.resource || 'resources/common.res',
      audioGain: options.audioGain || 2.0,
      language: options.language || 'en-US' // https://cloud.google.com/speech/docs/languages
    };

    this._detector = new Detector(detectorOptions);
    this._detector.on('silence', () => this._stream.emit('silence'));
    this._detector.on('sound', () => this._stream.emit('sound'));

    // When a hotword is detected, pipe the audio stream to speech detection.
    this._detector.on('hotword', (index, hotword) => this._onHotword(index, hotword));

    // Listen for speech recognition results.
    this._transcriptEmpty = true;
    this._csr.on('data', data => this._onSpeechData(data));
    this._csr.on('error', error => this._stream.emit('error', { streamingError: error }));
  }

  public start() {
    this._mic = startRecording({
      threshold: 0,
      device: this._device || null,
      recordProgram: this._recordProgram || "rec",
      verbose: false
    });

    this._mic.pipe(this._detector);
    this._started = true;
  }

  public stop() {
    stopRecording();
  }

  public pause() {
    this._mic.pause();
  }

  public resume() {
    this._mic.resume();
  }

  public on(event: string, handler: Function) {
    this._stream.on(event, handler);
  }

  public trigger(index: number, hotword: string) {
    this._onHotword(index, hotword);
  }

  private _onHotword(index: number, hotword: string) {
    if (!this._started) {
      throw ERROR.NOT_STARTED;
    }

    try {
      let triggerHotword = (index === 0) ? hotword : this._models.lookup(index);
      this._stream.emit('hotword', index, triggerHotword);
      this._csr.startStreaming(this._opts, this._mic);
    } catch (e) {
      throw ERROR.INVALID_INDEX;
    }
  }

  private _onSpeechData(data) {
    const result = data.results[0];
    if (result) {
      this._transcriptEmpty = false;
      if (result.isFinal) {
        this._stream.emit('final-result', result.transcript);
        annyang.trigger(result.transcript);
        this._transcriptEmpty = true; // reset transcript
      } else {
        this._stream.emit('partial-result', result.transcript);
      }
    } else if (data.endpointerType === 'END_OF_UTTERANCE' && this._transcriptEmpty) {
      this._stream.emit('final-result', "");
    }
  }
}
