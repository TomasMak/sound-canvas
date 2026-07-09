const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

interface GeminiGenerationArgs {
  apiKey: string;
  prompt: string;
  imageSize: '1024x1024' | '1536x1024' | '1024x1536';
}

const mapAspectRatio = (imageSize: GeminiGenerationArgs['imageSize']): string => {
  if (imageSize === '1536x1024') {
    return '3:2';
  }

  if (imageSize === '1024x1536') {
    return '2:3';
  }

  return '1:1';
};

export const generateWithGemini = async ({
  apiKey,
  prompt,
  imageSize
}: GeminiGenerationArgs): Promise<string> => {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-image',
      input: prompt,
      response_format: {
        type: 'image',
        aspect_ratio: mapAspectRatio(imageSize),
        image_size: '1K'
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini image generation failed: ${message}`);
  }

  const payload = (await response.json()) as {
    output?: Array<{ data?: string; mime_type?: string }>;
  };

  const imagePart = payload.output?.find((part) => part.data);
  if (!imagePart?.data) {
    throw new Error('Gemini did not return an image payload.');
  }

  return `data:${imagePart.mime_type ?? 'image/png'};base64,${imagePart.data}`;
};
