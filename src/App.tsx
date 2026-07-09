import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, []);

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
      <header className="hero" data-reveal>
        <div className="hero__copy">
          <p className="eyebrow">Sound Canvas</p>
          <h1>Music becomes image in a quieter, sharper visual language.</h1>
          <p>
            Built for music fans and creators, Sound Canvas listens to a track, studies its rhythm and
            texture, then translates those details into collectible visual artwork.
          </p>
        </div>
        <div className="hero__meta">
          <div>
            <span>Capture</span>
            <strong>Live room audio or uploaded tracks</strong>
          </div>
          <div>
            <span>Interpretation</span>
            <strong>Waveform, tempo, tone, and mood</strong>
          </div>
          <div>
            <span>Result</span>
            <strong>Downloadable artwork with explainable mapping</strong>
          </div>
        </div>
      </header>

      {(audioError || generationError) && (
        <div className="status-banner" data-reveal>
          {audioError && <p>{audioError}</p>}
          {generationError && <p>{generationError}</p>}
        </div>
      )}

      <main className="layout-grid">
        <div className="stack">
          <section className="section-intro" data-reveal>
            <p className="eyebrow">Listening</p>
            <h2>Bring in a song and let the system read its shape.</h2>
          </section>
          <LiveListenPanel isListening={isListening} onStart={startMicrophone} onStop={stopMicrophone} />
          <TrackUploadPanel audioRef={audioRef} onTrackSelected={connectAudioElement} />
          <AnalysisPanel snapshot={snapshot} />
        </div>

        <div className="stack">
          <section className="section-intro" data-reveal>
            <p className="eyebrow">Composition</p>
            <h2>Choose the rendering voice and refine the visual outcome.</h2>
          </section>
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
          <section className="panel" data-reveal>
            <div className="panel__header">
              <p className="eyebrow">Generate</p>
              <h2>Create the artwork</h2>
            </div>
            <p className="supporting-copy">
              Generation runs through the backend so the experience stays clean while the provider keys
              stay off the client.
            </p>
            <button type="button" className="button button--primary button--wide" disabled={!canGenerate} onClick={handleGenerate}>
              {isGenerating ? 'Generating...' : 'Generate art'}
            </button>
          </section>
          <ImageResult
            result={result}
            isGenerating={isGenerating}
            error={generationError}
            snapshot={snapshot}
            style={settings.style}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
