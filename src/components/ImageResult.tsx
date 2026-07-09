import type { GeneratedImageResult } from '../types/art';
import { downloadImage } from '../utils/download';

interface ImageResultProps {
  result: GeneratedImageResult | null;
  isGenerating: boolean;
  error: string | null;
}

export const ImageResult = ({ result, isGenerating, error }: ImageResultProps) => (
  <section className="panel result-panel">
    <div className="panel__header">
      <p className="eyebrow">Generated art</p>
      <h2>Image output</h2>
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
          <a href={result.imageUrl} target="_blank" rel="noreferrer" className="button button--ghost">
            Open full size
          </a>
        </div>
      </>
    )}
  </section>
);
