import type { AudioAnalysisSnapshot } from '../src/types/audio.js';
import type { ArtStyleId } from '../src/types/art.js';

const styleInstructions: Record<ArtStyleId, string> = {
  abstract:
    'Create expressive abstract artwork with sweeping energy, layered textures, and a composition shaped by musical rhythm.',
  pixelated:
    'Create pixel art with a strong retro game aesthetic, visible pixel blocks, bold contrast, and movement tied to the beat.',
  'spectral-bloom':
    'Create luminous generative art with organic forms, spectral gradients, glowing particles, and harmonic depth.'
};

export const buildArtPrompt = (
  snapshot: AudioAnalysisSnapshot,
  style: ArtStyleId,
  promptNotes: string
): string => {
  const { metrics, trackLabel, sourceKind } = snapshot;

  return [
    `Generate a single finished artwork inspired by the audio track "${trackLabel}".`,
    styleInstructions[style],
    `Audio source: ${sourceKind}.`,
    `Mood: ${metrics.mood}.`,
    `Tempo estimate: ${Math.round(metrics.tempoEstimate)} BPM.`,
    `Energy profile: bass ${metrics.bassEnergy.toFixed(2)}, mids ${metrics.midEnergy.toFixed(2)}, treble ${metrics.trebleEnergy.toFixed(2)}.`,
    `Wave intensity: RMS ${metrics.rms.toFixed(2)}, peak ${metrics.peak.toFixed(2)}, dynamic range ${metrics.dynamicRange.toFixed(2)}.`,
    `Spectral centroid: ${Math.round(metrics.centroid)} Hz.`,
    'Translate beats into visible rhythm, frequency balance into palette and form, and texture into composition.',
    'Return a high quality image with no text, no watermark, and no framing device.',
    promptNotes.trim()
  ]
    .filter(Boolean)
    .join(' ');
};
