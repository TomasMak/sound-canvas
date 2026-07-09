export type ArtStyleId = 'abstract' | 'pixelated' | 'spectral-bloom';

export interface ArtStyleOption {
  id: ArtStyleId;
  label: string;
  description: string;
}

export type ImageProviderId = 'openai' | 'gemini';

export interface GenerationSettings {
  provider: ImageProviderId;
  style: ArtStyleId;
  promptNotes: string;
  imageSize: '1024x1024' | '1536x1024' | '1024x1536';
}

export interface GeneratedImageResult {
  imageUrl: string;
  provider: ImageProviderId;
  prompt: string;
  createdAt: string;
}
