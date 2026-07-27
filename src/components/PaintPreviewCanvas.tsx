import { useEffect, useRef } from 'react';
import { drawVisualScore, VISUAL_SCORE_COLORS } from '../services/visualScore';
import type { AudioAnalysisSnapshot } from '../types/audio';
import type { ArtStyleId } from '../types/art';

interface PaintPreviewCanvasProps {
  snapshot: AudioAnalysisSnapshot | null;
  style: ArtStyleId;
  progress: number;
}

interface ScoreParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  originX: number;
}

const WIDTH = 960;
const HEIGHT = 560;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const createSeededRandom = (seed: string): (() => number) => {
  let state = Number.parseInt(seed, 16) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
};

const buildParticles = (snapshot: AudioAnalysisSnapshot): ScoreParticle[] => {
  const { signature } = snapshot;
  const random = createSeededRandom(signature.seed);
  const bands = [
    {
      values: signature.bassTimeline,
      baseline: 0.68,
      amplitude: 0.22,
      color: VISUAL_SCORE_COLORS.bass
    },
    {
      values: signature.midTimeline,
      baseline: 0.5,
      amplitude: 0.2,
      color: VISUAL_SCORE_COLORS.mids
    },
    {
      values: signature.trebleTimeline,
      baseline: 0.31,
      amplitude: 0.18,
      color: VISUAL_SCORE_COLORS.treble
    }
  ];
  const particles: ScoreParticle[] = [];

  bands.forEach((band, bandIndex) => {
    band.values.forEach((value, index) => {
      const transient = signature.transientTimeline[index] ?? 0;
      const originX =
        WIDTH * 0.07 + (index / Math.max(band.values.length - 1, 1)) * WIDTH * 0.86;
      const originY =
        HEIGHT * band.baseline + (0.5 - value) * HEIGHT * band.amplitude;
      const count = 1 + Math.round(value * 2 + transient * 2);

      for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
        const angle = random() * Math.PI * 2;
        const speed = 0.25 + value * 0.9 + transient * 1.6;
        particles.push({
          x: originX + (random() - 0.5) * 14,
          y: originY + (random() - 0.5) * 14,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.4 + random() * 2.8 + transient * 2,
          color: transient > 0.58 ? VISUAL_SCORE_COLORS.transient : band.color,
          originX
        });
      }
    });

    if (bandIndex === 1) {
      signature.transientTimeline.forEach((value, index) => {
        if (value < 0.42) {
          return;
        }
        const originX =
          WIDTH * 0.07 +
          (index / Math.max(signature.transientTimeline.length - 1, 1)) * WIDTH * 0.86;
        particles.push({
          x: originX,
          y: HEIGHT * (index % 2 === 0 ? 0.35 : 0.65),
          vx: (random() - 0.5) * (1 + value * 2),
          vy: (random() - 0.5) * (1 + value * 2),
          radius: 2 + value * 4,
          color: VISUAL_SCORE_COLORS.transient,
          originX
        });
      });
    }
  });

  return particles;
};

const drawParticles = (
  context: CanvasRenderingContext2D,
  particles: ScoreParticle[],
  visibleX: number,
  activity: number
): void => {
  const activeParticles: ScoreParticle[] = [];

  particles.forEach((particle) => {
    if (particle.originX > visibleX) {
      return;
    }
    activeParticles.push(particle);
    particle.x += particle.vx * activity;
    particle.y += particle.vy * activity;

    if (particle.x < 0 || particle.x > WIDTH) {
      particle.vx *= -1;
      particle.x = clamp(particle.x, 0, WIDTH);
    }
    if (particle.y < 0 || particle.y > HEIGHT) {
      particle.vy *= -1;
      particle.y = clamp(particle.y, 0, HEIGHT);
    }

    const returnStrength = 0.0008 + activity * 0.0007;
    particle.vx += (particle.originX - particle.x) * returnStrength;
  });

  const cellSize = 28;
  const grid = new Map<string, number[]>();
  activeParticles.forEach((particle, index) => {
    const key = `${Math.floor(particle.x / cellSize)}:${Math.floor(particle.y / cellSize)}`;
    const bucket = grid.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      grid.set(key, [index]);
    }
  });

  activeParticles.forEach((particle, index) => {
    const cellX = Math.floor(particle.x / cellSize);
    const cellY = Math.floor(particle.y / cellSize);

    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
        const nearby = grid.get(`${cellX + xOffset}:${cellY + yOffset}`) ?? [];
        nearby.forEach((compareIndex) => {
          if (compareIndex <= index) {
            return;
          }

          const other = activeParticles[compareIndex];
          const distance = Math.hypot(other.x - particle.x, other.y - particle.y);
          if (distance === 0 || distance > 26) {
            return;
          }

          context.save();
          context.globalAlpha = (1 - distance / 26) * 0.12;
          context.strokeStyle = particle.color;
          context.lineWidth = 0.8;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.stroke();
          context.restore();

          if (distance < particle.radius + other.radius + 2) {
            [particle.vx, other.vx] = [other.vx, particle.vx];
            [particle.vy, other.vy] = [other.vy, particle.vy];
          }
        });
      }
    }

    context.save();
    context.globalAlpha = 0.2 + activity * 0.2;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.12;
    context.strokeStyle = particle.color;
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(particle.x - particle.vx * 8, particle.y - particle.vy * 8);
    context.stroke();
    context.restore();
  });
};

export const PaintPreviewCanvas = ({
  snapshot,
  style,
  progress
}: PaintPreviewCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ScoreParticle[]>([]);

  useEffect(() => {
    particlesRef.current = snapshot ? buildParticles(snapshot) : [];
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !snapshot) {
      return;
    }

    let animationFrame = 0;
    const render = (): void => {
      const progressRatio = clamp(progress / 100, 0.02, 1);
      drawVisualScore(context, WIDTH, HEIGHT, snapshot, style, {
        progress: progressRatio
      });
      const visibleX = WIDTH * (0.07 + progressRatio * 0.86);
      drawParticles(
        context,
        particlesRef.current,
        visibleX,
        0.35 + snapshot.metrics.tempoEstimate / 180
      );
      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [progress, snapshot, style]);

  return (
    <canvas
      ref={canvasRef}
      className="paint-preview-canvas"
      width={WIDTH}
      height={HEIGHT}
      aria-label="Animated reveal of the track-specific visual score"
      role="img"
    />
  );
};
