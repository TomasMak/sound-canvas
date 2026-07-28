# Sound Canvas

Sound Canvas is a React + TypeScript + SCSS app that listens to live audio or uploaded tracks, analyzes waveform and frequency data in the browser, and generates downloadable artwork with either OpenAI or Google Gemini image models.

## Features

- Upload an audio track and analyze its full duration in the browser
- Listen live through the microphone in a Shazam-style flow
- Visualize waveform, spectrum data, and the track-specific abstract composition map
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

## How It Works

Sound Canvas turns music into artwork through a track-specific abstract composition map:

1. An uploaded file is decoded and sampled across its full duration. Live microphone mode builds the same kind of signature over a rolling listening window.
2. The app measures the changing amplitude, bass, mids, treble, and sudden transients at points across that timeline.
3. Those timelines are folded around a deterministic, off-axis composition. The same analyzed track produces the same map and signature ID.
4. The map is sent to OpenAI or Gemini as a reference image together with a structured transformation prompt.
5. The model preserves the map's balance, relative weight, density, negative space, and accent rhythm while transforming its visible paths into a finished art form.

The visual mapping is:

- Overall loudness controls the size and pressure of translucent color fields.
- Warm umber bass becomes broad, weighty masses and strokes.
- Slate teal mids become connective gestures through the composition.
- Muted gold treble becomes finer surface detail and lighter marks.
- Terracotta accents mark sudden beats or transients.

The chronology is deliberately folded through the canvas rather than shown as a left-to-right waveform. The provider is explicitly told not to trace the map or create a waveform, equalizer, chart, or data visualization. It can deconstruct, overlap, widen, dissolve, and merge the source geometry, but the final artwork remains anchored to the track-derived distribution of energy instead of a general mood prompt. The composition map shown in the interface is the same reference image supplied to the provider.

## Notes

- The app performs audio analysis locally with the Web Audio API.
- Raw audio is not sent to OpenAI or Gemini. Only the analysis, text instructions, and generated composition map are sent.
- OpenAI and Gemini requests now run on the backend, which avoids browser CORS issues and keeps provider keys out of the client bundle.
- The live listening mode captures microphone audio for analysis. It does not identify the song title or artist.
