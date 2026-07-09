import { useEffect, useRef, useState } from 'react';
import {
  calculateAudioMetrics,
  serializeSpectrum,
  serializeWaveform
} from '../services/audioAnalysis';
import type { AudioAnalysisSnapshot, AudioSourceKind } from '../types/audio';

interface UseAudioAnalysisResult {
  isListening: boolean;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  snapshot: AudioAnalysisSnapshot | null;
  error: string | null;
  startMicrophone: () => Promise<void>;
  stopMicrophone: () => void;
  connectAudioElement: (element: HTMLAudioElement, trackLabel: string) => Promise<void>;
}

const FFT_SIZE = 2048;

export const useAudioAnalysis = (): UseAudioAnalysisResult => {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [snapshot, setSnapshot] = useState<AudioAnalysisSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(
    null
  );
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceKindRef = useRef<AudioSourceKind>('upload');
  const trackLabelRef = useRef('Untitled track');

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

  const analyzeFrame = (): void => {
    if (!analyserRef.current || !audioContextRef.current) {
      return;
    }

    const waveform = new Uint8Array(analyserRef.current.fftSize);
    const spectrum = new Uint8Array(analyserRef.current.frequencyBinCount);

    analyserRef.current.getByteTimeDomainData(waveform);
    analyserRef.current.getByteFrequencyData(spectrum);

    const metrics = calculateAudioMetrics(waveform, spectrum, audioContextRef.current.sampleRate);
    setSnapshot({
      metrics,
      waveform: serializeWaveform(waveform),
      spectrum: serializeSpectrum(spectrum),
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
    trackLabel: string
  ): Promise<void> => {
    try {
      setError(null);
      sourceKindRef.current = 'upload';
      trackLabelRef.current = trackLabel;

      cleanupMicrophone();
      const context = ensureAudioContext();
      await context.resume();

      if (!(mediaSourceRef.current instanceof MediaElementAudioSourceNode)) {
        mediaSourceRef.current = context.createMediaElementSource(element);
      }

      mediaSourceRef.current.disconnect();
      analyserRef.current?.disconnect();
      mediaSourceRef.current.connect(analyserRef.current!);
      analyserRef.current!.connect(context.destination);
      setIsPlaying(true);
      startLoop();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Could not analyze the uploaded track.';
      setError(message);
    }
  };

  const startMicrophone = async (): Promise<void> => {
    try {
      setError(null);
      sourceKindRef.current = 'microphone';
      trackLabelRef.current = 'Live microphone capture';

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
      if (!isListening) {
        cleanupAnimation();
      }
    };

    const handlePlay = (): void => {
      setIsPlaying(true);
      startLoop();
    };

    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('play', handlePlay);

    return () => {
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('play', handlePlay);
    };
  }, [isListening]);

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
    audioRef,
    snapshot,
    error,
    startMicrophone,
    stopMicrophone,
    connectAudioElement
  };
};
