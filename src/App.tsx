import { useMemo, useState } from 'react';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ImageResult } from './components/ImageResult';
import { LiveListenPanel } from './components/LiveListenPanel';
import { PromptEditor } from './components/PromptEditor';
import { ProviderSelector } from './components/ProviderSelector';
import { StyleSelector } from './components/StyleSelector';
import { TrackUploadPanel } from './components/TrackUploadPanel';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';
import { generateImageFromAudio } from './services/imageGeneration';
import type { GeneratedImageResult, GenerationSettings } from './types/art';

const defaultSettings: GenerationSettings = {
  provider: 'openai',
  style: 'abstract',
  promptNotes: '',
  imageSize: '1024x1024'
};

function App() {
  const { audioRef, snapshot, error: audioError, isListening, startMicrophone, stopMicrophone, connectAudioElement } =
    useAudioAnalysis();
  const [settings, setSettings] = useState<GenerationSettings>(defaultSettings);
  const [result, setResult] = useState<GeneratedImageResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = useMemo(() => Boolean(snapshot) && !isGenerating, [snapshot, isGenerating]);

  const handleGenerate = async (): Promise<void> => {
    if (!snapshot) {
      return;
    }

    try {
      setGenerationError(null);
      setIsGenerating(true);
      const nextResult = await generateImageFromAudio(snapshot, settings);
      setResult(nextResult);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to generate an image.';
      setGenerationError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Sound Canvas</p>
          <h1>Turn songs into visual art shaped by waveform, rhythm, and texture.</h1>
          <p>
            Listen live through the microphone or upload a track, analyze its sound signature in the
            browser, then generate downloadable artwork with OpenAI or Google Gemini.
          </p>
        </div>
        <div className="hero__meta">
          <div>
            <span>Modes</span>
            <strong>Live listen + Upload</strong>
          </div>
          <div>
            <span>Styles</span>
            <strong>Abstract, Pixel, Spectral</strong>
          </div>
          <div>
            <span>Output</span>
            <strong>Image download</strong>
          </div>
        </div>
      </header>

      {(audioError || generationError) && (
        <div className="status-banner">
          {audioError && <p>{audioError}</p>}
          {generationError && <p>{generationError}</p>}
        </div>
      )}

      <main className="layout-grid">
        <div className="stack">
          <LiveListenPanel isListening={isListening} onStart={startMicrophone} onStop={stopMicrophone} />
          <TrackUploadPanel audioRef={audioRef} onTrackSelected={connectAudioElement} />
          <AnalysisPanel snapshot={snapshot} />
        </div>

        <div className="stack">
          <ProviderSelector
            value={settings.provider}
            onChange={(provider) => setSettings((current) => ({ ...current, provider }))}
          />
          <StyleSelector
            value={settings.style}
            onChange={(style) => setSettings((current) => ({ ...current, style }))}
          />
          <PromptEditor
            value={settings.promptNotes}
            onChange={(promptNotes) => setSettings((current) => ({ ...current, promptNotes }))}
            imageSize={settings.imageSize}
            onImageSizeChange={(imageSize) => setSettings((current) => ({ ...current, imageSize }))}
          />
          <section className="panel">
            <div className="panel__header">
              <p className="eyebrow">Generate</p>
              <h2>Create the artwork</h2>
            </div>
            <p className="supporting-copy">
              Image generation now runs through the backend API so browser CORS and provider keys stay out of the client.
            </p>
            <button type="button" className="button button--primary button--wide" disabled={!canGenerate} onClick={handleGenerate}>
              {isGenerating ? 'Generating...' : 'Generate art'}
            </button>
          </section>
          <ImageResult result={result} isGenerating={isGenerating} error={generationError} />
        </div>
      </main>
    </div>
  );
}

export default App;
