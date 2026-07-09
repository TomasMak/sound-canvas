import { useState } from 'react';
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

interface ArtworkHotspot {
  id: string;
  title: string;
  description: string;
  left: string;
  top: string;
  color: string;
}

const energyLabel = (value: number): string => {
  if (value > 0.68) {
    return 'strong';
  }

  if (value > 0.4) {
    return 'balanced';
  }

  return 'soft';
};

const rhythmLabel = (tempo: number): string => {
  if (tempo > 132) {
    return 'fast';
  }

  if (tempo > 96) {
    return 'steady';
  }

  return 'slow';
};

const styleNoun: Record<ArtStyleId, string> = {
  abstract: 'strokes',
  pixelated: 'pixel clusters',
  'spectral-bloom': 'glowing forms'
};

const buildHotspots = (
  snapshot: AudioAnalysisSnapshot | null,
  style: ArtStyleId
): ArtworkHotspot[] => {
  if (!snapshot) {
    return [];
  }

  const { metrics } = snapshot;
  const noun = styleNoun[style];

  return [
    {
      id: 'bass',
      title: 'Bass energy',
      description: `${energyLabel(metrics.bassEnergy)} low-end sounds shape these warmer ${noun} and the heavier visual weight.`,
      left: '24%',
      top: '68%',
      color: '#ef6f6c'
    },
    {
      id: 'mid',
      title: 'Midrange texture',
      description: `Vocals, melody, and body in the mids drive these central ${noun} and the main structure of the piece.`,
      left: '51%',
      top: '44%',
      color: '#f6c667'
    },
    {
      id: 'treble',
      title: 'High-frequency shimmer',
      description: `${energyLabel(metrics.trebleEnergy)} treble details influence these brighter accents and finer surface detail.`,
      left: '76%',
      top: '22%',
      color: '#6fb1d6'
    },
    {
      id: 'rhythm',
      title: 'Rhythm and pace',
      description: `The track feels ${rhythmLabel(metrics.tempoEstimate)} at about ${Math.round(metrics.tempoEstimate)} BPM, which affects how active and directional these marks feel.`,
      left: '70%',
      top: '72%',
      color: '#33658a'
    },
    {
      id: 'dynamics',
      title: 'Mood and contrast',
      description: `This area reflects the song's ${metrics.mood} mood and dynamic contrast, giving the artwork its overall tension and flow.`,
      left: '17%',
      top: '28%',
      color: '#c8553d'
    }
  ];
};

export const ImageResult = ({ result, isGenerating, error, snapshot, style }: ImageResultProps) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const hotspots = buildHotspots(snapshot, style);

  return (
    <>
      <section className="panel result-panel">
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

        {isGenerating && <p>Generating artwork...</p>}
        {error && <p className="error-text">{error}</p>}

        {!isGenerating && !result && !error && (
          <p>Once audio is analyzed, generate a piece and download the final image.</p>
        )}

        {result && (
          <>
            <img className="result-image" src={result.imageUrl} alt="Generated music-inspired artwork" />
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
                <h3>Interactive sound map</h3>
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
              Hover the markers to see how different parts of the track influenced the artwork.
            </p>

            <div className="viewer-modal__artwork">
              <img
                className="viewer-modal__image"
                src={result.imageUrl}
                alt="Generated music-inspired artwork in full view"
              />
              {hotspots.map((hotspot) => (
                <div
                  key={hotspot.id}
                  className="artwork-hotspot"
                  style={{
                    left: hotspot.left,
                    top: hotspot.top,
                    ['--hotspot-color' as string]: hotspot.color
                  }}
                >
                  <button type="button" className="artwork-hotspot__dot" aria-label={hotspot.title}>
                    <span />
                  </button>
                  <div className="artwork-hotspot__card">
                    <strong>{hotspot.title}</strong>
                    <p>{hotspot.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
