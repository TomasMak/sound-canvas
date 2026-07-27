import { useEffect, useRef } from 'react';
import { drawVisualScore } from '../services/visualScore';
import type { ArtStyleId } from '../types/art';
import type { AudioAnalysisSnapshot } from '../types/audio';

interface VisualScoreCanvasProps {
  snapshot: AudioAnalysisSnapshot;
  style: ArtStyleId;
  progress?: number;
}

export const VisualScoreCanvas = ({
  snapshot,
  style,
  progress = 1
}: VisualScoreCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    drawVisualScore(context, canvas.width, canvas.height, snapshot, style, { progress });
  }, [progress, snapshot, style]);

  return (
    <canvas
      ref={canvasRef}
      className="visual-score-canvas"
      width={960}
      height={560}
      aria-label="Track-specific visual score derived from the audio analysis"
      role="img"
    />
  );
};
