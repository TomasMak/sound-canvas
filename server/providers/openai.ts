const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

interface OpenAiGenerationArgs {
  apiKey: string;
  prompt: string;
  imageSize: '1024x1024' | '1536x1024' | '1024x1536';
}

export const generateWithOpenAi = async ({
  apiKey,
  prompt,
  imageSize
}: OpenAiGenerationArgs): Promise<string> => {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: imageSize
    })
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
