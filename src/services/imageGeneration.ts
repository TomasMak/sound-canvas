import type { AudioAnalysisSnapshot } from '../types/audio';
import type { GeneratedImageResult, GenerationSettings } from '../types/art';

export const generateImageFromAudio = async (
  snapshot: AudioAnalysisSnapshot,
  settings: GenerationSettings
): Promise<GeneratedImageResult> => {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      snapshot,
      settings
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Failed to generate image.');
  }

  return (await response.json()) as GeneratedImageResult;
};
