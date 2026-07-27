export type AudioSourceKind = 'upload' | 'microphone';

export interface AudioMetrics {
  rms: number;
  peak: number;
  bassEnergy: number;
  midEnergy: number;
  trebleEnergy: number;
  centroid: number;
  dynamicRange: number;
  zeroCrossingRate: number;
  tempoEstimate: number;
  mood: 'calm' | 'balanced' | 'intense';
}

export interface AudioVisualSignature {
  amplitudeEnvelope: number[];
  bassTimeline: number[];
  midTimeline: number[];
  trebleTimeline: number[];
  transientTimeline: number[];
  durationSeconds: number;
  sampleCount: number;
  seed: string;
}

export interface AudioAnalysisSnapshot {
  metrics: AudioMetrics;
  waveform: number[];
  spectrum: number[];
  signature: AudioVisualSignature;
  sourceKind: AudioSourceKind;
  capturedAt: string;
  trackLabel: string;
}
