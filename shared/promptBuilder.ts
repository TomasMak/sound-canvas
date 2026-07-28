import type { AudioAnalysisSnapshot } from '../src/types/audio.js';
import type { ArtStyleId } from '../src/types/art.js';

const styleInstructions: Record<ArtStyleId, string> = {
  abstract:
    'Contemporary mixed-media abstract painting. Build broad gestural pigment masses, translucent washes, scraped edges, dry-brush texture, and a restrained mineral surface. Use asymmetry, overlap, depth, and deliberate negative space so the result feels composed rather than decorative.',
  pixelated:
    'Contemporary neo-geometric digital mosaic. Recompose the energy into clustered modules at varied scales, layered color planes, stepped silhouettes, broken grids, and crisp interruptions. It should feel like gallery-grade digital abstraction, not a retro game screen or audio equalizer.',
  'spectral-bloom':
    'Luminous biomorphic generative print. Form translucent membranes, diffused halos, overlapping organic blooms, fine filament accents, and atmospheric depth. Keep the light restrained and sculptural rather than producing a neon audio visualization.'
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
    `GOAL\nCreate one standalone, gallery-quality abstract artwork from the supplied audio composition map for "${trackLabel}".`,
    `ART DIRECTION\n${styleInstructions[style]}`,
    `REFERENCE ROLE\nThe supplied image is deterministic compositional DNA extracted from ${signature.durationSeconds.toFixed(1)} seconds of ${sourceKind} audio. Use its center of gravity, asymmetry, color balance, relative mass, density, negative space, and sequence of calm versus energetic regions. It is a structural source, not a picture to trace.`,
    'TRANSFORMATION\nDeconstruct, widen, overlap, rotate, crop, dissolve, and merge the map into a unified art composition. Convert bass paths into large weighty forms, mids into connective gestures, treble into fine surface detail, loud passages into greater visual mass, and terracotta transients into sparse sharp accents. The final forms may depart from the source lines as long as the same musical balance and energy distribution remain legible.',
    'MUST CHANGE\nDo not leave the source paths visibly intact. Do not produce a waveform, sound-wave silhouette, frequency graph, equalizer, oscilloscope, parallel audio tracks, labeled diagram, data visualization, UI, or technical illustration.',
    `AUDIO CHARACTER\nTrack signature ${signature.seed}; mood ${metrics.mood}; tempo ${Math.round(metrics.tempoEstimate)} BPM; spectral centroid ${Math.round(metrics.centroid)} Hz.`,
    `ANALYSIS CONTROL DATA\nAmplitude 0-9: ${encodeTimeline(signature.amplitudeEnvelope)}. Bass 0-9: ${encodeTimeline(signature.bassTimeline)}. Mids 0-9: ${encodeTimeline(signature.midTimeline)}. Treble 0-9: ${encodeTimeline(signature.trebleTimeline)}. Transients 0-9: ${encodeTimeline(signature.transientTimeline)}. Use these values to control visual weight, scale, layering, density, and accents; never render the digits or timelines literally.`,
    `USER DIRECTION\n${promptNotes.trim() || 'No additional direction.'}`,
    'OUTPUT\nOne finished high-quality artwork, edge to edge, with no text, watermark, mockup, border, mat, frame, or explanatory labels.'
  ]
    .filter(Boolean)
    .join('\n\n');
};
