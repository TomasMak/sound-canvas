import type { AudioAnalysisSnapshot } from '../types/audio';
import type { GeneratedImageResult, GenerationSettings } from '../types/art';
import { createVisualScoreDataUrl } from './visualScore';

export const generateImageFromAudio = async (
  snapshot: AudioAnalysisSnapshot,
  settings: GenerationSettings,
  signal?: AbortSignal
): Promise<GeneratedImageResult> => {
  const visualScore = createVisualScoreDataUrl(
    snapshot,
    settings.style,
    settings.imageSize
  );
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      snapshot,
      settings,
      visualScore
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Failed to generate image.');
  }

  return (await response.json()) as GeneratedImageResult;
};
