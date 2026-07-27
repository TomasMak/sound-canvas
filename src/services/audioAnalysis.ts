import type {
  AudioAnalysisSnapshot,
  AudioMetrics,
  AudioSourceKind,
  AudioVisualSignature
} from '../types/audio';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const TIMELINE_POINTS = 64;
const SPECTRUM_POINTS = 96;
const FFT_SIZE = 2048;

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const averageRange = (values: number[], start: number, end: number): number => {
  const slice = values.slice(start, end);
  return average(slice);
};

const normalizeTogether = (series: number[][]): number[][] => {
  const maximum = Math.max(...series.flat(), 0.000001);
  return series.map((values) => values.map((value) => clamp(Math.sqrt(value / maximum))));
};

const mixToMono = (buffer: AudioBuffer): Float32Array => {
  const mono = new Float32Array(buffer.length);

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      mono[sampleIndex] += channel[sampleIndex] / buffer.numberOfChannels;
    }
  }

  return mono;
};

const fftMagnitudes = (samples: Float32Array, startIndex: number): Float64Array => {
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);

  for (let index = 0; index < FFT_SIZE; index += 1) {
    const sourceIndex = Math.min(samples.length - 1, Math.max(0, startIndex + index));
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1));
    real[index] = samples[sourceIndex] * window;
  }

  let reversedIndex = 0;
  for (let index = 1; index < FFT_SIZE; index += 1) {
    let bit = FFT_SIZE >> 1;
    while (reversedIndex & bit) {
      reversedIndex ^= bit;
      bit >>= 1;
    }
    reversedIndex ^= bit;

    if (index < reversedIndex) {
      [real[index], real[reversedIndex]] = [real[reversedIndex], real[index]];
    }
  }

  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const phaseReal = Math.cos(angle);
    const phaseImaginary = Math.sin(angle);

    for (let offset = 0; offset < FFT_SIZE; offset += length) {
      let rotationReal = 1;
      let rotationImaginary = 0;

      for (let index = 0; index < length / 2; index += 1) {
        const evenIndex = offset + index;
        const oddIndex = evenIndex + length / 2;
        const oddReal =
          real[oddIndex] * rotationReal - imaginary[oddIndex] * rotationImaginary;
        const oddImaginary =
          real[oddIndex] * rotationImaginary + imaginary[oddIndex] * rotationReal;

        real[oddIndex] = real[evenIndex] - oddReal;
        imaginary[oddIndex] = imaginary[evenIndex] - oddImaginary;
        real[evenIndex] += oddReal;
        imaginary[evenIndex] += oddImaginary;

        const nextRotationReal =
          rotationReal * phaseReal - rotationImaginary * phaseImaginary;
        rotationImaginary =
          rotationReal * phaseImaginary + rotationImaginary * phaseReal;
        rotationReal = nextRotationReal;
      }
    }
  }

  return Float64Array.from({ length: FFT_SIZE / 2 }, (_, index) =>
    Math.hypot(real[index], imaginary[index]) / FFT_SIZE
  );
};

const estimateTempo = (samples: Float32Array, sampleRate: number): number => {
  const hopSize = 1024;
  const frameSize = 2048;
  const frameCount = Math.max(1, Math.floor((samples.length - frameSize) / hopSize));
  const energies = new Float64Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * hopSize;
    let sum = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const value = samples[start + index] ?? 0;
      sum += value * value;
    }
    energies[frameIndex] = Math.sqrt(sum / frameSize);
  }

  const onsets = new Float64Array(frameCount);
  for (let index = 1; index < frameCount; index += 1) {
    onsets[index] = Math.max(0, energies[index] - energies[index - 1]);
  }

  const framesPerSecond = sampleRate / hopSize;
  const minimumLag = Math.max(1, Math.floor((framesPerSecond * 60) / 180));
  const maximumLag = Math.min(
    frameCount - 1,
    Math.ceil((framesPerSecond * 60) / 60)
  );
  let bestLag = Math.round((framesPerSecond * 60) / 110);
  let bestCorrelation = 0;
  const correlations = new Float64Array(maximumLag + 1);

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0;
    for (let index = lag; index < frameCount; index += 1) {
      correlation += onsets[index] * onsets[index - lag];
    }
    correlations[lag] = correlation;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  const halfLag = Math.round(bestLag / 2);
  if (
    halfLag >= minimumLag &&
    correlations[halfLag] >= bestCorrelation * 0.52
  ) {
    bestLag = halfLag;
  }

  return clamp((framesPerSecond * 60) / Math.max(bestLag, 1), 60, 180);
};

export const createSignatureSeed = (
  values: Pick<
    AudioVisualSignature,
    'amplitudeEnvelope' | 'bassTimeline' | 'midTimeline' | 'trebleTimeline' | 'transientTimeline'
  >
): string => {
  const signatureText = [
    ...values.amplitudeEnvelope,
    ...values.bassTimeline,
    ...values.midTimeline,
    ...values.trebleTimeline,
    ...values.transientTimeline
  ]
    .map((value) => Math.round(clamp(value) * 255))
    .join(',');
  let hash = 2166136261;

  for (let index = 0; index < signatureText.length; index += 1) {
    hash ^= signatureText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
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

export const analyzeAudioBuffer = (
  buffer: AudioBuffer,
  sourceKind: AudioSourceKind,
  trackLabel: string
): AudioAnalysisSnapshot => {
  const samples = mixToMono(buffer);
  const amplitudeEnvelope: number[] = [];
  const waveform: number[] = [];
  const rawBassTimeline: number[] = [];
  const rawMidTimeline: number[] = [];
  const rawTrebleTimeline: number[] = [];
  const averageSpectrum = Array.from({ length: SPECTRUM_POINTS }, () => 0);
  let totalSquares = 0;
  let peak = 0;
  let zeroCrossings = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    totalSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (
      index > 0 &&
      ((samples[index - 1] >= 0 && value < 0) || (samples[index - 1] < 0 && value >= 0))
    ) {
      zeroCrossings += 1;
    }
  }

  for (let segmentIndex = 0; segmentIndex < TIMELINE_POINTS; segmentIndex += 1) {
    const start = Math.floor((segmentIndex / TIMELINE_POINTS) * samples.length);
    const end = Math.max(
      start + 1,
      Math.floor(((segmentIndex + 1) / TIMELINE_POINTS) * samples.length)
    );
    let segmentSquares = 0;
    let signedPeak = 0;

    for (let index = start; index < end; index += 1) {
      const value = samples[index];
      segmentSquares += value * value;
      if (Math.abs(value) > Math.abs(signedPeak)) {
        signedPeak = value;
      }
    }

    amplitudeEnvelope.push(Math.sqrt(segmentSquares / Math.max(end - start, 1)));
    waveform.push(clamp(0.5 + signedPeak * 0.48));

    const fftStart = Math.max(
      0,
      Math.min(samples.length - FFT_SIZE, Math.floor((start + end - FFT_SIZE) / 2))
    );
    const magnitudes = fftMagnitudes(samples, fftStart);
    let bass = 0;
    let mids = 0;
    let treble = 0;

    magnitudes.forEach((magnitude, binIndex) => {
      const frequency = (binIndex * buffer.sampleRate) / FFT_SIZE;
      const power = magnitude * magnitude;
      if (frequency < 250) {
        bass += power;
      } else if (frequency < 4000) {
        mids += power;
      } else {
        treble += power;
      }

      const spectrumIndex = Math.min(
        SPECTRUM_POINTS - 1,
        Math.floor((binIndex / magnitudes.length) * SPECTRUM_POINTS)
      );
      averageSpectrum[spectrumIndex] += magnitude / TIMELINE_POINTS;
    });

    rawBassTimeline.push(Math.sqrt(bass));
    rawMidTimeline.push(Math.sqrt(mids));
    rawTrebleTimeline.push(Math.sqrt(treble));
  }

  const normalizedAmplitude = normalizeTogether([amplitudeEnvelope])[0];
  const [bassTimeline, midTimeline, trebleTimeline] = normalizeTogether([
    rawBassTimeline,
    rawMidTimeline,
    rawTrebleTimeline
  ]);
  const rawTransients = normalizedAmplitude.map((value, index) =>
    index === 0 ? 0 : Math.max(0, value - normalizedAmplitude[index - 1])
  );
  const transientTimeline = normalizeTogether([rawTransients])[0];
  const normalizedSpectrum = normalizeTogether([averageSpectrum])[0];
  const totalBandEnergy =
    average(rawBassTimeline) + average(rawMidTimeline) + average(rawTrebleTimeline);
  const rms = Math.sqrt(totalSquares / Math.max(samples.length, 1));
  const bassEnergy = average(rawBassTimeline) / Math.max(totalBandEnergy, 0.000001);
  const midEnergy = average(rawMidTimeline) / Math.max(totalBandEnergy, 0.000001);
  const trebleEnergy = average(rawTrebleTimeline) / Math.max(totalBandEnergy, 0.000001);
  const spectrumTotal = averageSpectrum.reduce((sum, value) => sum + value, 0);
  const nyquist = buffer.sampleRate / 2;
  const centroid =
    spectrumTotal === 0
      ? 0
      : averageSpectrum.reduce(
          (sum, value, index) =>
            sum + value * ((index + 0.5) / SPECTRUM_POINTS) * nyquist,
          0
        ) / spectrumTotal;
  const tempoEstimate = estimateTempo(samples, buffer.sampleRate);
  let mood: AudioMetrics['mood'] = 'balanced';

  if (rms < 0.1 && trebleEnergy < 0.3) {
    mood = 'calm';
  } else if (rms > 0.22 || average(transientTimeline) > 0.28) {
    mood = 'intense';
  }

  const signatureBase = {
    amplitudeEnvelope: normalizedAmplitude,
    bassTimeline,
    midTimeline,
    trebleTimeline,
    transientTimeline
  };
  const signature: AudioVisualSignature = {
    ...signatureBase,
    durationSeconds: buffer.duration,
    sampleCount: buffer.length,
    seed: createSignatureSeed(signatureBase)
  };

  return {
    metrics: {
      rms: clamp(rms),
      peak: clamp(peak),
      bassEnergy: clamp(bassEnergy),
      midEnergy: clamp(midEnergy),
      trebleEnergy: clamp(trebleEnergy),
      centroid,
      dynamicRange: clamp(peak - rms),
      zeroCrossingRate: clamp(zeroCrossings / Math.max(samples.length, 1)),
      tempoEstimate,
      mood
    },
    waveform,
    spectrum: normalizedSpectrum,
    signature,
    sourceKind,
    capturedAt: new Date().toISOString(),
    trackLabel
  };
};
