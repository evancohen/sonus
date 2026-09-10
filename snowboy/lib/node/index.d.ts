import * as stream from 'stream';
export interface HotwordModel {
    file: string;
    sensitivity?: string;
    hotwords: string | Array<string>;
}
export interface DetectorOptions {
    resource: string;
    models: HotwordModels;
    audioGain?: number;
    applyFrontend?: boolean;
    highSensitivity?: string;
}
export interface SnowboyDetectInterface {
    reset(): boolean;
    runDetection(buffer: Buffer): number;
    setSensitivity(sensitivity: string): void;
    setHighSensitivity(highSensitivity: string): void;
    getSensitivity(): string;
    setAudioGain(gain: number): void;
    updateModel(): void;
    numHotwords(): number;
    sampleRate(): number;
    numChannels(): number;
    bitsPerSample(): number;
}
export declare class HotwordModels implements HotwordModels {
    private models;
    private lookupTable;
    add(model: HotwordModel): void;
    get modelString(): string;
    get sensitivityString(): string;
    lookup(index: number): string;
    numHotwords(): number;
    private generateHotwordsLookupTable;
}
export declare class SnowboyDetect extends stream.Writable implements SnowboyDetectInterface {
    nativeInstance: SnowboyDetectNativeInterface;
    private models;
    constructor(options: DetectorOptions);
    reset(): boolean;
    runDetection(buffer: Buffer): number;
    setSensitivity(sensitivity: string): void;
    setHighSensitivity(highSensitivity: string): void;
    getSensitivity(): string;
    setAudioGain(gain: number): void;
    updateModel(): void;
    numHotwords(): number;
    sampleRate(): number;
    numChannels(): number;
    bitsPerSample(): number;
    _write(chunk: Buffer, encoding: string, callback: Function): any;
    private processDetectionResult;
}
export declare const Detector: typeof SnowboyDetect;
export declare const Models: typeof HotwordModels;
