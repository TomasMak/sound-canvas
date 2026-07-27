const OPENAI_API_URL = 'https://api.openai.com/v1/images/edits';

interface OpenAiGenerationArgs {
  apiKey: string;
  prompt: string;
  imageSize: '1024x1024' | '1536x1024' | '1024x1536';
  visualScore: string;
}

export const generateWithOpenAi = async ({
  apiKey,
  prompt,
  imageSize,
  visualScore
}: OpenAiGenerationArgs): Promise<string> => {
  const dataUrlMatch = visualScore.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!dataUrlMatch) {
    throw new Error('The audio visual score is not a valid image.');
  }

  const formData = new FormData();
  formData.append('model', 'gpt-image-2');
  formData.append('prompt', prompt);
  formData.append('size', imageSize);
  formData.append(
    'image[]',
    new Blob([Buffer.from(dataUrlMatch[2], 'base64')], { type: dataUrlMatch[1] }),
    'sound-canvas-visual-score.png'
  );

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI image generation failed: ${message}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const image = payload.data?.[0];

  if (!image?.b64_json && !image?.url) {
    throw new Error('OpenAI did not return an image payload.');
  }

  return image.url ?? `data:image/png;base64,${image.b64_json}`;
};
