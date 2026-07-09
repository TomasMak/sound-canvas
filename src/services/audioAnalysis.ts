import type { AudioMetrics } from '../types/audio';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const averageRange = (values: number[], start: number, end: number): number => {
  const slice = values.slice(start, end);
  return average(slice);
};

export const calculateAudioMetrics = (
  waveform: Uint8Array,
  spectrum: Uint8Array,
  sampleRate: number
): AudioMetrics => {
  const waveformValues = Array.from(waveform, (value) => (value - 128) / 128);
  const spectrumValues = Array.from(spectrum, (value) => value / 255);

  const rms = Math.sqrt(
    waveformValues.reduce((sum, value) => sum + value * value, 0) / waveformValues.length
  );
  const peak = Math.max(...waveformValues.map((value) => Math.abs(value)));
  const dynamicRange = peak - rms;

  let zeroCrossings = 0;
  for (let index = 1; index < waveformValues.length; index += 1) {
    if (
      (waveformValues[index - 1] >= 0 && waveformValues[index] < 0) ||
      (waveformValues[index - 1] < 0 && waveformValues[index] >= 0)
    ) {
      zeroCrossings += 1;
    }
  }

  let weightedSum = 0;
  let totalSpectrumEnergy = 0;
  spectrumValues.forEach((magnitude, index) => {
    weightedSum += index * magnitude;
    totalSpectrumEnergy += magnitude;
  });

  const nyquist = sampleRate / 2;
  const binSize = nyquist / spectrumValues.length;
  const centroid =
    totalSpectrumEnergy === 0 ? 0 : (weightedSum / totalSpectrumEnergy) * binSize;

  const bassEnergy = averageRange(spectrumValues, 0, Math.floor(spectrumValues.length * 0.15));
  const midEnergy = averageRange(
    spectrumValues,
    Math.floor(spectrumValues.length * 0.15),
    Math.floor(spectrumValues.length * 0.6)
  );
  const trebleEnergy = averageRange(
    spectrumValues,
    Math.floor(spectrumValues.length * 0.6),
    spectrumValues.length
  );

  const zeroCrossingRate = zeroCrossings / waveformValues.length;
  const tempoEstimate = clamp((bassEnergy * 0.7 + zeroCrossingRate * 0.3) * 200, 60, 180);

  let mood: AudioMetrics['mood'] = 'balanced';
  if (rms < 0.12 && trebleEnergy < 0.35) {
    mood = 'calm';
  } else if (rms > 0.22 || bassEnergy > 0.6) {
    mood = 'intense';
  }

  return {
    rms: clamp(rms),
    peak: clamp(peak),
    bassEnergy: clamp(bassEnergy),
    midEnergy: clamp(midEnergy),
    trebleEnergy: clamp(trebleEnergy),
    centroid,
    dynamicRange: clamp(dynamicRange),
    zeroCrossingRate: clamp(zeroCrossingRate),
    tempoEstimate,
    mood
  };
};

export const serializeWaveform = (waveform: Uint8Array): number[] =>
  Array.from(waveform, (value) => value / 255);

export const serializeSpectrum = (spectrum: Uint8Array): number[] =>
  Array.from(spectrum, (value) => value / 255);
