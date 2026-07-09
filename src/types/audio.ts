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

export interface AudioAnalysisSnapshot {
  metrics: AudioMetrics;
  waveform: number[];
  spectrum: number[];
  sourceKind: AudioSourceKind;
  capturedAt: string;
  trackLabel: string;
}
