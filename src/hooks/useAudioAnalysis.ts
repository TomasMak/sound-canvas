import { useEffect, useRef, useState } from 'react';
import {
  analyzeAudioBuffer,
  calculateAudioMetrics,
  createSignatureSeed,
  serializeSpectrum,
  serializeWaveform
} from '../services/audioAnalysis';
import type {
  AudioAnalysisSnapshot,
  AudioMetrics,
  AudioSourceKind,
  AudioVisualSignature
} from '../types/audio';

interface UseAudioAnalysisResult {
  isListening: boolean;
  isPlaying: boolean;
  isAnalyzing: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  snapshot: AudioAnalysisSnapshot | null;
  error: string | null;
  startMicrophone: () => Promise<void>;
  stopMicrophone: () => void;
  connectAudioElement: (
    element: HTMLAudioElement,
    trackLabel: string,
    file: File
  ) => Promise<void>;
}

const FFT_SIZE = 2048;
const LIVE_SAMPLE_INTERVAL = 120;
const LIVE_TIMELINE_POINTS = 64;

interface LiveSample {
  metrics: AudioMetrics;
}

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const normalizeTogether = (series: number[][]): number[][] => {
  const maximum = Math.max(...series.flat(), 0.000001);
  return series.map((values) =>
    values.map((value) => Math.min(1, Math.max(0, Math.sqrt(value / maximum))))
  );
};

export const useAudioAnalysis = (): UseAudioAnalysisResult => {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snapshot, setSnapshot] = useState<AudioAnalysisSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceKindRef = useRef<AudioSourceKind>('upload');
  const trackLabelRef = useRef('Untitled track');
  const liveSamplesRef = useRef<LiveSample[]>([]);
  const lastLiveSampleAtRef = useRef(0);
  const listeningStartedAtRef = useRef(0);

  const cleanupAnimation = (): void => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const cleanupMicrophone = (): void => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const analyzeFrame = (timestamp = performance.now()): void => {
    if (!analyserRef.current || !audioContextRef.current) {
      return;
    }

    if (timestamp - lastLiveSampleAtRef.current < LIVE_SAMPLE_INTERVAL) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }
    lastLiveSampleAtRef.current = timestamp;

    const waveform = new Uint8Array(analyserRef.current.fftSize);
    const spectrum = new Uint8Array(analyserRef.current.frequencyBinCount);

    analyserRef.current.getByteTimeDomainData(waveform);
    analyserRef.current.getByteFrequencyData(spectrum);

    const metrics = calculateAudioMetrics(waveform, spectrum, audioContextRef.current.sampleRate);
    const nextSamples = [...liveSamplesRef.current, { metrics }].slice(-LIVE_TIMELINE_POINTS);
    liveSamplesRef.current = nextSamples;
    const rawAmplitude = nextSamples.map((sample) => sample.metrics.rms);
    const rawBass = nextSamples.map((sample) => sample.metrics.bassEnergy);
    const rawMids = nextSamples.map((sample) => sample.metrics.midEnergy);
    const rawTreble = nextSamples.map((sample) => sample.metrics.trebleEnergy);
    const [amplitudeEnvelope] = normalizeTogether([rawAmplitude]);
    const [bassTimeline, midTimeline, trebleTimeline] = normalizeTogether([
      rawBass,
      rawMids,
      rawTreble
    ]);
    const [transientTimeline] = normalizeTogether([
      amplitudeEnvelope.map((value, index) =>
        index === 0 ? 0 : Math.max(0, value - amplitudeEnvelope[index - 1])
      )
    ]);
    const signatureBase = {
      amplitudeEnvelope,
      bassTimeline,
      midTimeline,
      trebleTimeline,
      transientTimeline
    };
    const signature: AudioVisualSignature = {
      ...signatureBase,
      durationSeconds: Math.max(0, (timestamp - listeningStartedAtRef.current) / 1000),
      sampleCount: nextSamples.length,
      seed: createSignatureSeed(signatureBase)
    };
    const aggregateRms = average(nextSamples.map((sample) => sample.metrics.rms));
    const aggregateBass = average(nextSamples.map((sample) => sample.metrics.bassEnergy));
    const aggregateTreble = average(nextSamples.map((sample) => sample.metrics.trebleEnergy));
    const mood: AudioMetrics['mood'] =
      aggregateRms < 0.12 && aggregateTreble < 0.35
        ? 'calm'
        : aggregateRms > 0.22 || aggregateBass > 0.6
          ? 'intense'
          : 'balanced';

    setSnapshot({
      metrics: {
        rms: aggregateRms,
        peak: Math.max(...nextSamples.map((sample) => sample.metrics.peak)),
        bassEnergy: aggregateBass,
        midEnergy: average(nextSamples.map((sample) => sample.metrics.midEnergy)),
        trebleEnergy: aggregateTreble,
        centroid: average(nextSamples.map((sample) => sample.metrics.centroid)),
        dynamicRange: average(nextSamples.map((sample) => sample.metrics.dynamicRange)),
        zeroCrossingRate: average(
          nextSamples.map((sample) => sample.metrics.zeroCrossingRate)
        ),
        tempoEstimate: average(nextSamples.map((sample) => sample.metrics.tempoEstimate)),
        mood
      },
      waveform: serializeWaveform(waveform),
      spectrum: serializeSpectrum(spectrum),
      signature,
      sourceKind: sourceKindRef.current,
      capturedAt: new Date().toISOString(),
      trackLabel: trackLabelRef.current
    });

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  };

  const ensureAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = 0.85;
    }

    return audioContextRef.current;
  };

  const startLoop = (): void => {
    cleanupAnimation();
    analyzeFrame();
  };

  const connectAudioElement = async (
    element: HTMLAudioElement,
    trackLabel: string,
    file: File
  ): Promise<void> => {
    try {
      setError(null);
      setIsAnalyzing(true);
      sourceKindRef.current = 'upload';
      trackLabelRef.current = trackLabel;

      cleanupAnimation();
      cleanupMicrophone();
      const context = ensureAudioContext();
      await context.resume();
      mediaSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      mediaSourceRef.current = null;

      const fileData = await file.arrayBuffer();
      const decodedAudio = await context.decodeAudioData(fileData.slice(0));
      setSnapshot(analyzeAudioBuffer(decodedAudio, 'upload', trackLabel));
      setIsPlaying(!element.paused);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Could not analyze the uploaded track.';
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startMicrophone = async (): Promise<void> => {
    try {
      setError(null);
      sourceKindRef.current = 'microphone';
      trackLabelRef.current = 'Live microphone capture';
      liveSamplesRef.current = [];
      lastLiveSampleAtRef.current = 0;
      listeningStartedAtRef.current = performance.now();

      cleanupMicrophone();
      const context = ensureAudioContext();
      await context.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      mediaStreamRef.current = stream;

      mediaSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      mediaSourceRef.current = context.createMediaStreamSource(stream);
      mediaSourceRef.current.connect(analyserRef.current!);

      setIsListening(true);
      setIsPlaying(false);
      startLoop();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Could not start microphone analysis.';
      setError(message);
    }
  };

  const stopMicrophone = (): void => {
    cleanupAnimation();
    cleanupMicrophone();
    mediaSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    setIsListening(false);
  };

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return undefined;
    }

    const handlePause = (): void => {
      setIsPlaying(false);
    };

    const handlePlay = (): void => {
      setIsPlaying(true);
    };

    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('play', handlePlay);

    return () => {
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('play', handlePlay);
    };
  }, []);

  useEffect(() => {
    return () => {
      cleanupAnimation();
      cleanupMicrophone();
      mediaSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  return {
    isListening,
    isPlaying,
    isAnalyzing,
    audioRef,
    snapshot,
    error,
    startMicrophone,
    stopMicrophone,
    connectAudioElement
  };
};
