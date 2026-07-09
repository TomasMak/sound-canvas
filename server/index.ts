import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { buildArtPrompt } from '../shared/promptBuilder.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenAi } from './providers/openai.js';
import type { AudioAnalysisSnapshot } from '../src/types/audio.js';
import type { GenerationSettings, GeneratedImageResult } from '../src/types/art.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface GenerateImageRequestBody {
  snapshot: AudioAnalysisSnapshot;
  settings: GenerationSettings;
}

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, date: new Date().toISOString() });
});

app.post(
  '/api/generate-image',
  async (
    request: express.Request<object, GeneratedImageResult | { error: string }, GenerateImageRequestBody>,
    response: express.Response<GeneratedImageResult | { error: string }>
  ) => {
    try {
      const { snapshot, settings } = request.body;

      if (!snapshot || !settings) {
        response.status(400).json({ error: 'Missing snapshot or settings.' });
        return;
      }

      if (settings.provider === 'openai' && !process.env.OPENAI_API_KEY?.trim()) {
        response.status(500).json({ error: 'Missing OPENAI_API_KEY on the server.' });
        return;
      }

      if (settings.provider === 'gemini' && !process.env.GEMINI_API_KEY?.trim()) {
        response.status(500).json({ error: 'Missing GEMINI_API_KEY on the server.' });
        return;
      }

      const prompt = buildArtPrompt(snapshot, settings.style, settings.promptNotes);
      const imageUrl =
        settings.provider === 'openai'
          ? await generateWithOpenAi({
              apiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
              prompt,
              imageSize: settings.imageSize
            })
          : await generateWithGemini({
              apiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
              prompt,
              imageSize: settings.imageSize
            });

      response.json({
        imageUrl,
        provider: settings.provider,
        prompt,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed.';
      response.status(500).json({ error: message });
    }
  }
);

app.listen(port, () => {
  console.log(`Sound Canvas API listening on http://localhost:${port}`);
});
