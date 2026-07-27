import type { ArtStyleId, GenerationSettings } from '../types/art';
import type { AudioAnalysisSnapshot } from '../types/audio';

export const VISUAL_SCORE_COLORS = {
  bass: '#8c5e42',
  mids: '#3f6b70',
  treble: '#c89b53',
  waveform: '#24211d',
  transient: '#b85c4b'
} as const;

interface VisualScoreOptions {
  progress?: number;
  background?: boolean;
}

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const getPoint = (
  values: number[],
  index: number,
  width: number,
  height: number,
  baseline: number,
  amplitude: number
): { x: number; y: number } => ({
  x: width * 0.07 + (index / Math.max(values.length - 1, 1)) * width * 0.86,
  y: height * baseline + (0.5 - values[index]) * height * amplitude
});

const traceSignal = (
  context: CanvasRenderingContext2D,
  values: number[],
  width: number,
  height: number,
  baseline: number,
  amplitude: number,
  visibleCount: number
): void => {
  const points = values
    .slice(0, visibleCount)
    .map((_, index) => getPoint(values, index, width, height, baseline, amplitude));

  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const midpointX = (previous.x + point.x) / 2;
    const midpointY = (previous.y + point.y) / 2;
    context.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY);
  });
  context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
};

const drawBand = (
  context: CanvasRenderingContext2D,
  values: number[],
  width: number,
  height: number,
  baseline: number,
  amplitude: number,
  color: string,
  lineWidth: number,
  visibleCount: number,
  style: ArtStyleId
): void => {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.globalAlpha = 0.84;
  context.lineWidth = lineWidth;
  context.lineCap = style === 'pixelated' ? 'square' : 'round';
  context.lineJoin = 'round';

  if (style === 'pixelated') {
    values.slice(0, visibleCount).forEach((value, index) => {
      const point = getPoint(values, index, width, height, baseline, amplitude);
      const blockWidth = Math.max(5, (width * 0.82) / Math.max(values.length, 1));
      const blockHeight = Math.max(5, lineWidth * (0.55 + value * 0.55));
      context.fillRect(
        Math.round(point.x / blockWidth) * blockWidth,
        Math.round(point.y / blockHeight) * blockHeight,
        blockWidth * 0.85,
        blockHeight
      );
    });
    context.restore();
    return;
  }

  if (style === 'spectral-bloom') {
    context.shadowColor = color;
    context.shadowBlur = lineWidth * 1.2;
  }

  traceSignal(
    context,
    values,
    width,
    height,
    baseline,
    amplitude,
    visibleCount
  );
  context.stroke();
  context.restore();
};

const drawAmplitudeShape = (
  context: CanvasRenderingContext2D,
  values: number[],
  width: number,
  height: number,
  visibleCount: number
): void => {
  const visibleValues = values.slice(0, visibleCount);
  if (visibleValues.length < 2) {
    return;
  }

  const startX = width * 0.07;
  const usableWidth = width * 0.86;
  const centerY = height * 0.5;
  const maxHeight = height * 0.23;

  context.save();
  context.beginPath();
  visibleValues.forEach((value, index) => {
    const x = startX + (index / Math.max(values.length - 1, 1)) * usableWidth;
    const y = centerY - value * maxHeight;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  [...visibleValues].reverse().forEach((value, reversedIndex) => {
    const sourceIndex = visibleValues.length - 1 - reversedIndex;
    const x = startX + (sourceIndex / Math.max(values.length - 1, 1)) * usableWidth;
    context.lineTo(x, centerY + value * maxHeight);
  });
  context.closePath();

  const gradient = context.createLinearGradient(0, centerY - maxHeight, 0, centerY + maxHeight);
  gradient.addColorStop(0, 'rgba(36, 33, 29, 0.03)');
  gradient.addColorStop(0.5, 'rgba(36, 33, 29, 0.13)');
  gradient.addColorStop(1, 'rgba(36, 33, 29, 0.03)');
  context.fillStyle = gradient;
  context.fill();
  context.strokeStyle = VISUAL_SCORE_COLORS.waveform;
  context.globalAlpha = 0.28;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
};

const drawTransients = (
  context: CanvasRenderingContext2D,
  values: number[],
  width: number,
  height: number,
  visibleCount: number,
  style: ArtStyleId
): void => {
  context.save();
  context.fillStyle = VISUAL_SCORE_COLORS.transient;
  context.strokeStyle = VISUAL_SCORE_COLORS.transient;

  values.slice(0, visibleCount).forEach((value, index) => {
    if (value < 0.42) {
      return;
    }

    const x = width * 0.07 + (index / Math.max(values.length - 1, 1)) * width * 0.86;
    const radius = height * (0.006 + value * 0.012);
    const direction = index % 2 === 0 ? -1 : 1;
    const y = height * (0.5 + direction * (0.12 + value * 0.16));

    context.globalAlpha = 0.35 + value * 0.55;
    if (style === 'pixelated') {
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x, y - radius * 2.8);
      context.lineTo(x, y + radius * 2.8);
      context.lineWidth = Math.max(1, radius * 0.22);
      context.stroke();
    }
  });
  context.restore();
};

export const drawVisualScore = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: AudioAnalysisSnapshot,
  style: ArtStyleId,
  options: VisualScoreOptions = {}
): void => {
  const { signature } = snapshot;
  const progress = clamp(options.progress ?? 1);
  const visibleCount = Math.max(
    2,
    Math.ceil(signature.amplitudeEnvelope.length * progress)
  );

  context.clearRect(0, 0, width, height);
  if (options.background !== false) {
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#f3ece2');
    background.addColorStop(0.52, '#e8ded1');
    background.addColorStop(1, '#d9e0dc');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255, 255, 255, 0.42)';
    context.beginPath();
    context.arc(width * 0.16, height * 0.14, width * 0.2, 0, Math.PI * 2);
    context.fill();
  }

  drawAmplitudeShape(
    context,
    signature.amplitudeEnvelope,
    width,
    height,
    visibleCount
  );
  drawBand(
    context,
    signature.bassTimeline,
    width,
    height,
    0.68,
    0.22,
    VISUAL_SCORE_COLORS.bass,
    height * (0.016 + average(signature.bassTimeline) * 0.035),
    visibleCount,
    style
  );
  drawBand(
    context,
    signature.midTimeline,
    width,
    height,
    0.5,
    0.2,
    VISUAL_SCORE_COLORS.mids,
    height * (0.012 + average(signature.midTimeline) * 0.026),
    visibleCount,
    style
  );
  drawBand(
    context,
    signature.trebleTimeline,
    width,
    height,
    0.31,
    0.18,
    VISUAL_SCORE_COLORS.treble,
    height * (0.008 + average(signature.trebleTimeline) * 0.018),
    visibleCount,
    style
  );
  drawTransients(
    context,
    signature.transientTimeline,
    width,
    height,
    visibleCount,
    style
  );
};

const getCanvasDimensions = (
  imageSize: GenerationSettings['imageSize']
): { width: number; height: number } => {
  if (imageSize === '1536x1024') {
    return { width: 768, height: 512 };
  }
  if (imageSize === '1024x1536') {
    return { width: 512, height: 768 };
  }
  return { width: 640, height: 640 };
};

export const createVisualScoreDataUrl = (
  snapshot: AudioAnalysisSnapshot,
  style: ArtStyleId,
  imageSize: GenerationSettings['imageSize']
): string => {
  const canvas = document.createElement('canvas');
  const { width, height } = getCanvasDimensions(imageSize);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not create the audio visual score.');
  }

  drawVisualScore(context, width, height, snapshot, style);
  return canvas.toDataURL('image/png');
};
