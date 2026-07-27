import { useEffect, useState } from 'react';
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
  const {
    audioRef,
    snapshot,
    error: audioError,
    isListening,
    isAnalyzing,
    startMicrophone,
    stopMicrophone,
    connectAudioElement
  } = useAudioAnalysis();
  const [settings, setSettings] = useState<GenerationSettings>(defaultSettings);
  const [result, setResult] = useState<GeneratedImageResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = Boolean(snapshot) && !isGenerating && !isAnalyzing;

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
      <header className="top-layout" data-reveal>
        <div className="primary-actions">
          <TrackUploadPanel
            audioRef={audioRef}
            isAnalyzing={isAnalyzing}
            onTrackSelected={connectAudioElement}
          />
          <LiveListenPanel isListening={isListening} onStart={startMicrophone} onStop={stopMicrophone} />
        </div>

        <div className="hero-compact">
          <p className="eyebrow">Sound Canvas</p>
          <h1>Turn a track into visual art without digging through the page first.</h1>
          <p>
            Upload a file or listen live, review the analysis, then generate artwork from the music's
            rhythm, tone, and energy.
          </p>
          <div className="hero-compact__meta">
            <div>
              <span>Capture</span>
              <strong>Upload or live listening</strong>
            </div>
            <div>
              <span>Output</span>
              <strong>Generated artwork + analysis</strong>
            </div>
          </div>
          <details className="about-toggle">
            <summary>Read more about how it works</summary>
            <div className="about-toggle__content">
              <p>
                The app studies the full waveform and follows how bass, mids, treble,
                loudness, and sudden beats change from the start of the track to the end.
              </p>
              <p>
                Those changes become a visual score that you can inspect first. The same
                score is then supplied to the chosen image model as the structure for the
                final artwork.
              </p>
            </div>
          </details>
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
          <AnalysisPanel snapshot={snapshot} style={settings.style} />
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
          <section className="panel" data-reveal>
            <div className="panel__header">
              <p className="eyebrow">Generate</p>
              <h2>Create the artwork</h2>
            </div>
            <p className="supporting-copy">
              The track's visual score fixes the composition; the selected provider adds
              artistic material and finish through the backend.
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
