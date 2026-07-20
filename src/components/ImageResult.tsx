import { useEffect, useState } from 'react';
import { PaintPreviewCanvas } from './PaintPreviewCanvas';
import { downloadImage } from '../utils/download';
import type { AudioAnalysisSnapshot } from '../types/audio';
import type { ArtStyleId, GeneratedImageResult } from '../types/art';

interface ImageResultProps {
  result: GeneratedImageResult | null;
  isGenerating: boolean;
  error: string | null;
  snapshot: AudioAnalysisSnapshot | null;
  style: ArtStyleId;
}

export const ImageResult = ({ result, isGenerating, error, snapshot, style }: ImageResultProps) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [revealedResultKey, setRevealedResultKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationProgress(0);
      return;
    }

    setGenerationProgress(6);
    const interval = window.setInterval(() => {
      setGenerationProgress((current) => {
        if (current >= 92) {
          return current;
        }

        const step = current < 42 ? 8 : current < 70 ? 5 : 2;
        return Math.min(92, current + step);
      });
    }, 220);

    return () => window.clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    if (!result) {
      return;
    }

    setRevealedResultKey(null);
    const timeout = window.setTimeout(() => {
      setRevealedResultKey(result.createdAt);
    }, 40);

    return () => window.clearTimeout(timeout);
  }, [result]);

  return (
    <>
      <section className="panel result-panel" data-reveal>
        <div className="panel__header panel__header--row">
          <div>
            <p className="eyebrow">Generated art</p>
            <h2>Image output</h2>
          </div>
          <button
            type="button"
            className="info-button"
            aria-label="Learn how the artwork is generated"
            onClick={() => setIsInfoOpen(true)}
          >
            i
          </button>
        </div>

        {isGenerating && (
          <div className="generation-preview">
            <div className="generation-preview__frame">
              <PaintPreviewCanvas snapshot={snapshot} style={style} progress={generationProgress} />
              <div
                className="generation-preview__reveal"
                style={{ ['--generation-progress' as string]: `${generationProgress}%` }}
              />
            </div>
            <div className="generation-preview__meta">
              <strong>Painting the composition</strong>
              <p>
                Laying down brush paths, tonal masses, and finer marks from the track before the final
                image resolves.
              </p>
              <span>{generationProgress}% visual pass complete</span>
            </div>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}

        {!isGenerating && !result && !error && (
          <p>Once audio is analyzed, generate a piece and download the final image.</p>
        )}

        {result && !isGenerating && (
          <>
            <div className={`result-image-wrap ${revealedResultKey === result.createdAt ? 'result-image-wrap--revealed' : ''}`}>
              <img className="result-image" src={result.imageUrl} alt="Generated music-inspired artwork" />
            </div>
            <div className="result-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => downloadImage(result.imageUrl, `sound-canvas-${Date.now()}.png`)}
              >
                Download image
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setIsViewerOpen(true)}
              >
                Open full size
              </button>
            </div>
          </>
        )}
      </section>

      {isInfoOpen && (
        <div className="info-modal" role="dialog" aria-modal="true" aria-label="How Sound Canvas creates art">
          <div className="info-modal__backdrop" onClick={() => setIsInfoOpen(false)} />
          <div className="info-modal__panel">
            <button
              type="button"
              className="info-modal__close"
              aria-label="Close"
              onClick={() => setIsInfoOpen(false)}
            >
              x
            </button>
            <p className="eyebrow">How it works</p>
            <h3>How the artwork reflects the music</h3>
            <p>
              Sound Canvas listens to the song and looks at qualities like energy, rhythm, brightness,
              and the balance of low, mid, and high sounds.
            </p>
            <p>
              Those details are turned into creative guidance for the image model. Fast or intense music
              can lead to more movement and contrast, while softer or calmer music can produce smoother
              shapes and gentler compositions.
            </p>
            <p>
              The selected art style shapes the final look. That means the same song can become a bold
              abstract piece, a retro pixel composition, or a glowing spectral artwork.
            </p>
            <p>
              The waveform preview helps visualize the sound, while the generated image is based on the
              music summary built from the audio analysis.
            </p>
          </div>
        </div>
      )}

      {isViewerOpen && result && (
        <div className="viewer-modal" role="dialog" aria-modal="true" aria-label="Full artwork view">
          <div className="viewer-modal__backdrop" onClick={() => setIsViewerOpen(false)} />
          <div className="viewer-modal__panel">
            <div className="viewer-modal__topbar">
              <div>
                <p className="eyebrow">Artwork detail</p>
                <h3>Full artwork view</h3>
              </div>
              <button
                type="button"
                className="info-modal__close"
                aria-label="Close full artwork view"
                onClick={() => setIsViewerOpen(false)}
              >
                x
              </button>
            </div>

            <p className="viewer-modal__summary">
              A clean full-size view of the generated piece.
            </p>

            <div className="viewer-modal__artwork">
              <img
                className="viewer-modal__image"
                src={result.imageUrl}
                alt="Generated music-inspired artwork in full view"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
