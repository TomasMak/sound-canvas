import type { AudioAnalysisSnapshot } from '../src/types/audio.js';
import type { ArtStyleId } from '../src/types/art.js';

const styleInstructions: Record<ArtStyleId, string> = {
  abstract:
    'Finish the visual score as expressive contemporary abstract artwork with tactile material, layered depth, and confident negative space.',
  pixelated:
    'Finish the visual score as refined pixel art with visible blocks, crisp stepped contours, and rhythmic digital texture.',
  'spectral-bloom':
    'Finish the visual score as luminous generative art with organic blooms, atmospheric depth, and restrained spectral light.'
};

const encodeTimeline = (values: number[]): string =>
  values.map((value) => Math.min(9, Math.max(0, Math.round(value * 9)))).join('');

export const buildArtPrompt = (
  snapshot: AudioAnalysisSnapshot,
  style: ArtStyleId,
  promptNotes: string
): string => {
  const { metrics, signature, trackLabel, sourceKind } = snapshot;

  return [
    `Create one finished artwork from the supplied visual score for "${trackLabel}".`,
    styleInstructions[style],
    `Audio source: ${sourceKind}.`,
    `The reference image is an authoritative, deterministic visual score derived from ${signature.durationSeconds.toFixed(1)} seconds of audio; it is not a loose mood board.`,
    'Preserve its left-to-right chronology, dominant paths, peaks, valleys, relative line weights, negative space, and accent positions.',
    'Do not replace the supplied composition with unrelated geometry. Do not turn it into a literal chart or add labels.',
    'Visual mapping: warm umber is bass, slate teal is mids, muted gold is treble, the charcoal envelope is overall loudness, and terracotta accents are beats or sudden transients.',
    `Track signature ${signature.seed}. Mood ${metrics.mood}; tempo ${Math.round(metrics.tempoEstimate)} BPM; spectral centroid ${Math.round(metrics.centroid)} Hz.`,
    `Amplitude timeline 0-9: ${encodeTimeline(signature.amplitudeEnvelope)}.`,
    `Bass timeline 0-9: ${encodeTimeline(signature.bassTimeline)}.`,
    `Mid timeline 0-9: ${encodeTimeline(signature.midTimeline)}.`,
    `Treble timeline 0-9: ${encodeTimeline(signature.trebleTimeline)}.`,
    `Transient timeline 0-9: ${encodeTimeline(signature.transientTimeline)}.`,
    'Use the AI only to add artistic material, texture, depth, and finish around that fixed musical structure.',
    'Return a high quality image with no text, no watermark, and no framing device.',
    promptNotes.trim()
  ]
    .filter(Boolean)
    .join(' ');
};
