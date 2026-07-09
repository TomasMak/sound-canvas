# Sound Canvas

Sound Canvas is a React + TypeScript + SCSS app that listens to live audio or uploaded tracks, analyzes waveform and frequency data in the browser, and generates downloadable artwork with either OpenAI or Google Gemini image models.

## Features

- Upload an audio track and analyze it in the browser
- Listen live through the microphone in a Shazam-style flow
- Visualize waveform and spectrum data
- Choose from three art directions: `Abstract Flow`, `Pixel Pulse`, and `Spectral Bloom`
- Generate artwork with either OpenAI Image or Google Gemini Image
- Download the generated image

## Setup

1. Install dependencies:

```bash
rtk npm install
```

2. Copy `.env.example` to `.env.local` or `.env` and provide at least one API key:

```bash
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
PORT=8787
```

3. Start the app:

```bash
rtk npm run dev
```

This runs:

- Vite on `http://localhost:5173`
- Express API on `http://localhost:8787`

Frontend requests to `/api/*` are proxied to the backend in development.

## Notes

- The app performs audio analysis locally with the Web Audio API.
- OpenAI and Gemini requests now run on the backend, which avoids browser CORS issues and keeps provider keys out of the client bundle.
- The live listening mode captures microphone audio for analysis. It does not identify the song title or artist.
