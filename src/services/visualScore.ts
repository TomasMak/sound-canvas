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

export interface CompositionPoint {
  x: number;
  y: number;
  value: number;
  amplitude: number;
  transient: number;
  timelineRatio: number;
}

export interface VisualComposition {
  bass: CompositionPoint[];
  mids: CompositionPoint[];
  treble: CompositionPoint[];
  fields: CompositionPoint[];
  transients: CompositionPoint[];
}

interface CompositionConfig {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  phase: number;
  turns: number;
  drift: number;
  minimumDimension: number;
}

const TAU = Math.PI * 2;

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
};

const getCompositionConfig = (
  snapshot: AudioAnalysisSnapshot,
  width: number,
  height: number
): CompositionConfig => {
  const random = createSeededRandom(`${snapshot.signature.seed}-layout`);
  const landscape = width >= height;

  return {
    centerX: width * (0.47 + (random() - 0.5) * 0.08),
    centerY: height * (0.5 + (random() - 0.5) * 0.07),
    radiusX: width * (landscape ? 0.33 : 0.37),
    radiusY: height * (landscape ? 0.34 : 0.31),
    phase: random() * TAU,
    turns: 0.86 + clamp(snapshot.metrics.tempoEstimate / 190) * 0.52 + random() * 0.18,
    drift: (random() - 0.5) * 0.2,
    minimumDimension: Math.min(width, height)
  };
};

const getSpinePoint = (
  timelineRatio: number,
  config: CompositionConfig
): { x: number; y: number } => {
  const angle =
    config.phase +
    timelineRatio * TAU * config.turns +
    Math.sin(timelineRatio * Math.PI * 5 + config.phase) * 0.16;
  const radiusPulse =
    0.82 +
    timelineRatio * 0.12 +
    Math.sin(timelineRatio * TAU * 3 + config.phase * 0.7) * 0.09;

  return {
    x:
      config.centerX +
      Math.cos(angle) * config.radiusX * radiusPulse +
      Math.sin(angle * 2.15 + config.phase) * config.radiusX * 0.17 +
      config.radiusX * config.drift * (timelineRatio - 0.5),
    y:
      config.centerY +
      Math.sin(angle) * config.radiusY * radiusPulse +
      Math.cos(angle * 1.62 - config.phase) * config.radiusY * 0.18
  };
};

const getNormal = (
  timelineRatio: number,
  config: CompositionConfig
): { x: number; y: number } => {
  const before = getSpinePoint(clamp(timelineRatio - 0.002), config);
  const after = getSpinePoint(clamp(timelineRatio + 0.002), config);
  const deltaX = after.x - before.x;
  const deltaY = after.y - before.y;
  const length = Math.hypot(deltaX, deltaY) || 1;

  return {
    x: -deltaY / length,
    y: deltaX / length
  };
};

const getValue = (values: number[], index: number): number =>
  clamp(values[index] ?? values[values.length - 1] ?? 0);

const buildBandPoints = (
  values: number[],
  band: 'bass' | 'mids' | 'treble',
  snapshot: AudioAnalysisSnapshot,
  config: CompositionConfig
): CompositionPoint[] => {
  const { signature } = snapshot;
  const bandDirection = band === 'bass' ? 1 : band === 'treble' ? -1 : 0;
  const baseSeparation = band === 'mids' ? 0 : 0.042;
  const energySeparation = band === 'bass' ? 0.055 : band === 'treble' ? 0.044 : 0.025;

  return values.map((rawValue, index) => {
    const timelineRatio = index / Math.max(values.length - 1, 1);
    const value = clamp(rawValue);
    const amplitude = getValue(signature.amplitudeEnvelope, index);
    const transient = getValue(signature.transientTimeline, index);
    const spine = getSpinePoint(timelineRatio, config);
    const normal = getNormal(timelineRatio, config);
    const weave =
      Math.sin(timelineRatio * TAU * (band === 'mids' ? 2.4 : 1.7) + config.phase) *
      config.minimumDimension *
      (band === 'mids' ? 0.025 : 0.012);
    const separation =
      bandDirection *
        config.minimumDimension *
        (baseSeparation + value * energySeparation) +
      weave;

    return {
      x: spine.x + normal.x * separation,
      y: spine.y + normal.y * separation,
      value,
      amplitude,
      transient,
      timelineRatio
    };
  });
};

export const buildVisualComposition = (
  snapshot: AudioAnalysisSnapshot,
  width: number,
  height: number
): VisualComposition => {
  const { signature } = snapshot;
  const config = getCompositionConfig(snapshot, width, height);
  const bass = buildBandPoints(signature.bassTimeline, 'bass', snapshot, config);
  const mids = buildBandPoints(signature.midTimeline, 'mids', snapshot, config);
  const treble = buildBandPoints(signature.trebleTimeline, 'treble', snapshot, config);
  const fields = signature.amplitudeEnvelope.map((rawValue, index) => {
    const timelineRatio = index / Math.max(signature.amplitudeEnvelope.length - 1, 1);
    const spine = getSpinePoint(timelineRatio, config);

    return {
      ...spine,
      value: clamp(rawValue),
      amplitude: clamp(rawValue),
      transient: getValue(signature.transientTimeline, index),
      timelineRatio
    };
  });
  const transients = signature.transientTimeline.map((rawValue, index) => {
    const timelineRatio = index / Math.max(signature.transientTimeline.length - 1, 1);
    const middlePoint = mids[index] ?? fields[index];
    const radialX = middlePoint.x - config.centerX;
    const radialY = middlePoint.y - config.centerY;
    const radialLength = Math.hypot(radialX, radialY) || 1;
    const direction = index % 2 === 0 ? 1 : -1;
    const offset =
      direction * config.minimumDimension * (0.025 + clamp(rawValue) * 0.075);

    return {
      x: middlePoint.x + (radialX / radialLength) * offset,
      y: middlePoint.y + (radialY / radialLength) * offset,
      value: clamp(rawValue),
      amplitude: getValue(signature.amplitudeEnvelope, index),
      transient: clamp(rawValue),
      timelineRatio
    };
  });

  return { bass, mids, treble, fields, transients };
};

const getVisiblePoints = (
  points: CompositionPoint[],
  progress: number
): CompositionPoint[] => points.slice(0, Math.max(2, Math.ceil(points.length * progress)));

const traceSmoothPath = (
  context: CanvasRenderingContext2D,
  points: CompositionPoint[]
): void => {
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

const drawBackground = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string,
  style: ArtStyleId
): void => {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, style === 'spectral-bloom' ? '#e7eee9' : '#f3ece2');
  background.addColorStop(0.52, style === 'pixelated' ? '#e4ded4' : '#e8ded1');
  background.addColorStop(1, style === 'spectral-bloom' ? '#d3dfdc' : '#d9e0dc');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const ambient = context.createRadialGradient(
    width * 0.18,
    height * 0.16,
    0,
    width * 0.18,
    height * 0.16,
    width * 0.48
  );
  ambient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  ambient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = ambient;
  context.fillRect(0, 0, width, height);

  const random = createSeededRandom(`${seed}-grain`);
  context.save();
  context.fillStyle = VISUAL_SCORE_COLORS.waveform;
  for (let index = 0; index < 420; index += 1) {
    const radius = 0.25 + random() * 0.8;
    context.globalAlpha = 0.015 + random() * 0.035;
    context.beginPath();
    context.arc(random() * width, random() * height, radius, 0, TAU);
    context.fill();
  }
  context.restore();
};

const drawEnergyFields = (
  context: CanvasRenderingContext2D,
  points: CompositionPoint[],
  width: number,
  height: number,
  progress: number,
  style: ArtStyleId,
  seed: string
): void => {
  const random = createSeededRandom(`${seed}-${style}-fields`);
  const visiblePoints = getVisiblePoints(points, progress);
  const minimumDimension = Math.min(width, height);

  visiblePoints.forEach((point, index) => {
    if (index % 6 !== 0 && point.value < 0.68) {
      return;
    }

    const radius = minimumDimension * (0.045 + point.value * 0.11);
    const stretch = 0.72 + random() * 1.2;
    const rotation = random() * Math.PI;
    const color =
      index % 3 === 0
        ? VISUAL_SCORE_COLORS.bass
        : index % 3 === 1
          ? VISUAL_SCORE_COLORS.mids
          : VISUAL_SCORE_COLORS.treble;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(rotation);

    if (style === 'pixelated') {
      const unit = Math.max(7, Math.round(minimumDimension * 0.018));
      context.globalAlpha = 0.08 + point.value * 0.09;
      context.fillStyle = color;
      context.fillRect(
        Math.round((-radius * stretch) / unit) * unit,
        Math.round((-radius * 0.55) / unit) * unit,
        Math.max(unit, Math.round((radius * stretch * 2) / unit) * unit),
        Math.max(unit, Math.round((radius * 1.1) / unit) * unit)
      );
    } else {
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(
        0,
        style === 'spectral-bloom' ? `${color}3d` : `${color}2e`
      );
      gradient.addColorStop(0.58, `${color}17`);
      gradient.addColorStop(1, `${color}00`);
      context.scale(stretch, 0.72 + random() * 0.5);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, radius, 0, TAU);
      context.fill();
    }

    context.restore();
  });
};

const drawPixelBand = (
  context: CanvasRenderingContext2D,
  points: CompositionPoint[],
  color: string,
  minimumDimension: number,
  seed: string
): void => {
  const random = createSeededRandom(seed);
  const unit = Math.max(5, Math.round(minimumDimension * 0.014));

  context.save();
  context.fillStyle = color;
  points.forEach((point, index) => {
    if (index % 2 !== 0 && point.value < 0.48) {
      return;
    }

    const scale = 1 + Math.round(point.value * 2.5);
    const size = unit * scale;
    context.globalAlpha = 0.28 + point.value * 0.55;
    context.fillRect(
      Math.round((point.x + (random() - 0.5) * unit * 2) / unit) * unit,
      Math.round((point.y + (random() - 0.5) * unit * 2) / unit) * unit,
      size,
      index % 3 === 0 ? size * 0.5 : size
    );
  });
  context.restore();
};

const drawPainterlyBand = (
  context: CanvasRenderingContext2D,
  points: CompositionPoint[],
  color: string,
  lineWidth: number,
  style: ArtStyleId
): void => {
  if (points.length < 2) {
    return;
  }

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = color;

  if (style === 'spectral-bloom') {
    context.globalAlpha = 0.16;
    context.lineWidth = lineWidth * 2.4;
    context.shadowColor = color;
    context.shadowBlur = lineWidth * 2.2;
    traceSmoothPath(context, points);
    context.stroke();
    context.shadowBlur = 0;

    context.globalAlpha = 0.78;
    context.lineWidth = Math.max(1.2, lineWidth * 0.45);
    traceSmoothPath(context, points);
    context.stroke();
    context.restore();
    return;
  }

  context.globalAlpha = 0.13;
  context.lineWidth = lineWidth * 2.15;
  traceSmoothPath(context, points);
  context.stroke();

  context.globalAlpha = 0.66;
  context.lineWidth = lineWidth;
  traceSmoothPath(context, points);
  context.stroke();

  context.globalAlpha = 0.48;
  context.lineWidth = Math.max(1, lineWidth * 0.16);
  context.setLineDash([lineWidth * 0.5, lineWidth * 0.28]);
  traceSmoothPath(context, points);
  context.stroke();
  context.restore();
};

const drawBand = (
  context: CanvasRenderingContext2D,
  points: CompositionPoint[],
  color: string,
  lineWidth: number,
  style: ArtStyleId,
  seed: string,
  minimumDimension: number
): void => {
  if (style === 'pixelated') {
    drawPixelBand(context, points, color, minimumDimension, seed);
    return;
  }

  drawPainterlyBand(context, points, color, lineWidth, style);
};

const drawTransients = (
  context: CanvasRenderingContext2D,
  points: CompositionPoint[],
  minimumDimension: number,
  style: ArtStyleId
): void => {
  context.save();
  context.fillStyle = VISUAL_SCORE_COLORS.transient;
  context.strokeStyle = VISUAL_SCORE_COLORS.transient;

  points.forEach((point, index) => {
    if (point.value < 0.42) {
      return;
    }

    const radius = minimumDimension * (0.006 + point.value * 0.015);
    context.globalAlpha = 0.38 + point.value * 0.52;
    if (style === 'pixelated') {
      const size = Math.max(5, radius * 2.2);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(index % 2 === 0 ? 0 : Math.PI / 4);
      context.fillRect(-size / 2, -size / 2, size, size);
      context.restore();
      return;
    }

    context.save();
    context.translate(point.x, point.y);
    context.rotate((index * 0.73) % Math.PI);
    if (style === 'spectral-bloom') {
      context.shadowColor = VISUAL_SCORE_COLORS.transient;
      context.shadowBlur = radius * 2.8;
    }
    context.beginPath();
    context.arc(0, 0, radius * 0.46, 0, TAU);
    context.fill();
    context.lineWidth = Math.max(1, radius * 0.22);
    context.beginPath();
    context.moveTo(-radius * 2.8, 0);
    context.lineTo(radius * 2.8, 0);
    context.moveTo(0, -radius * 1.35);
    context.lineTo(0, radius * 1.35);
    context.stroke();
    context.restore();
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
  const progress = clamp(options.progress ?? 1);
  const composition = buildVisualComposition(snapshot, width, height);
  const minimumDimension = Math.min(width, height);

  context.clearRect(0, 0, width, height);
  if (options.background !== false) {
    drawBackground(context, width, height, snapshot.signature.seed, style);
  }

  drawEnergyFields(
    context,
    composition.fields,
    width,
    height,
    progress,
    style,
    snapshot.signature.seed
  );
  drawBand(
    context,
    getVisiblePoints(composition.bass, progress),
    VISUAL_SCORE_COLORS.bass,
    minimumDimension * (0.024 + average(snapshot.signature.bassTimeline) * 0.052),
    style,
    `${snapshot.signature.seed}-bass`,
    minimumDimension
  );
  drawBand(
    context,
    getVisiblePoints(composition.mids, progress),
    VISUAL_SCORE_COLORS.mids,
    minimumDimension * (0.016 + average(snapshot.signature.midTimeline) * 0.036),
    style,
    `${snapshot.signature.seed}-mids`,
    minimumDimension
  );
  drawBand(
    context,
    getVisiblePoints(composition.treble, progress),
    VISUAL_SCORE_COLORS.treble,
    minimumDimension * (0.009 + average(snapshot.signature.trebleTimeline) * 0.02),
    style,
    `${snapshot.signature.seed}-treble`,
    minimumDimension
  );
  drawTransients(
    context,
    getVisiblePoints(composition.transients, progress),
    minimumDimension,
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
    throw new Error('Could not create the audio composition map.');
  }

  drawVisualScore(context, width, height, snapshot, style);
  return canvas.toDataURL('image/png');
};
