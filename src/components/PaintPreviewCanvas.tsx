import { useEffect, useMemo, useRef } from 'react';
import type { AudioAnalysisSnapshot } from '../types/audio';
import type { ArtStyleId } from '../types/art';

interface PaintPreviewCanvasProps {
  snapshot: AudioAnalysisSnapshot | null;
  style: ArtStyleId;
  progress: number;
}

interface StrokePlan {
  color: string;
  width: number;
  alpha: number;
  points: Array<{ x: number; y: number }>;
  mode: 'stroke' | 'blocks' | 'bloom';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

const paletteByStyle: Record<ArtStyleId, string[]> = {
  abstract: ['#6e5743', '#b39272', '#d8c5ab', '#7f8b92'],
  pixelated: ['#5f4c3e', '#b19a7f', '#d7ccbc', '#7b8894'],
  'spectral-bloom': ['#75879a', '#c4ac90', '#e0d2c4', '#95a8b8']
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const particleCountByStyle: Record<ArtStyleId, number> = {
  abstract: 96,
  pixelated: 144,
  'spectral-bloom': 120
};

const buildStrokePlans = (
  snapshot: AudioAnalysisSnapshot | null,
  style: ArtStyleId,
  width: number,
  height: number
): StrokePlan[] => {
  const waveform = snapshot?.waveform ?? Array.from({ length: 64 }, (_, index) => 0.5 + Math.sin(index / 6) * 0.1);
  const spectrum = snapshot?.spectrum ?? Array.from({ length: 64 }, (_, index) => Math.abs(Math.sin(index / 8)) * 0.6);
  const metrics = snapshot?.metrics;
  const bass = metrics?.bassEnergy ?? 0.45;
  const mids = metrics?.midEnergy ?? 0.5;
  const treble = metrics?.trebleEnergy ?? 0.42;
  const tempo = metrics?.tempoEstimate ?? 108;
  const palette = paletteByStyle[style];

  const makePoints = (offsetY: number, amplitude: number, phase: number): Array<{ x: number; y: number }> =>
    waveform.slice(0, 56).map((sample, index) => ({
      x: (index / 55) * width,
      y:
        offsetY +
        (sample - 0.5) * height * amplitude +
        Math.sin(index / (4 + phase)) * (tempo / 180) * 14
    }));

  const basePlans: StrokePlan[] = [
    {
      color: palette[0],
      width: 18 + bass * 24,
      alpha: 0.28 + bass * 0.22,
      points: makePoints(height * 0.7, 0.24 + bass * 0.12, 2),
      mode: style === 'pixelated' ? 'blocks' : 'stroke'
    },
    {
      color: palette[1],
      width: 12 + mids * 18,
      alpha: 0.24 + mids * 0.2,
      points: makePoints(height * 0.48, 0.2 + mids * 0.1, 3),
      mode: style === 'spectral-bloom' ? 'bloom' : style === 'pixelated' ? 'blocks' : 'stroke'
    },
    {
      color: palette[2],
      width: 8 + treble * 10,
      alpha: 0.16 + treble * 0.18,
      points: makePoints(height * 0.24, 0.14 + treble * 0.08, 5),
      mode: style === 'spectral-bloom' ? 'bloom' : 'stroke'
    },
    {
      color: palette[3],
      width: 6 + treble * 8,
      alpha: 0.12 + treble * 0.12,
      points: spectrum.slice(0, 28).map((value, index) => ({
        x: width * 0.08 + index * (width * 0.03),
        y: height * 0.88 - value * height * 0.4
      })),
      mode: style === 'pixelated' ? 'blocks' : 'stroke'
    }
  ];

  const extraPlans: StrokePlan[] = Array.from({ length: 6 }, (_, layerIndex) => {
    const band = spectrum.slice(layerIndex * 8, layerIndex * 8 + 22);
    const amplitude = 0.08 + (layerIndex % 3) * 0.03;
    const offsetY = height * (0.18 + layerIndex * 0.1);
    const color = palette[layerIndex % palette.length];
    const points = band.map((value, index) => ({
      x: width * 0.06 + index * (width * 0.04),
      y:
        offsetY +
        Math.sin(index / (2.4 + layerIndex * 0.35)) * 14 +
        (0.5 - value) * height * amplitude
    }));

    return {
      color,
      width: 4 + (layerIndex % 3) * 3 + bass * 4,
      alpha: 0.08 + (layerIndex % 4) * 0.04,
      points,
      mode:
        style === 'pixelated' && layerIndex % 2 === 0
          ? 'blocks'
          : style === 'spectral-bloom' && layerIndex % 3 === 0
            ? 'bloom'
            : 'stroke'
    };
  });

  return [...basePlans, ...extraPlans];
};

const drawStroke = (
  context: CanvasRenderingContext2D,
  plan: StrokePlan,
  progressRatio: number
): void => {
  const visibleCount = clamp(Math.floor(plan.points.length * progressRatio), 2, plan.points.length);
  const visiblePoints = plan.points.slice(0, visibleCount);

  context.save();
  context.globalAlpha = plan.alpha;
  context.strokeStyle = plan.color;
  context.fillStyle = plan.color;
  context.lineWidth = plan.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (plan.mode === 'blocks') {
    visiblePoints.forEach((point, index) => {
      const size = plan.width * (index % 2 === 0 ? 0.72 : 0.95);
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
      if (index % 3 === 0) {
        context.globalAlpha = plan.alpha * 0.45;
        context.fillRect(point.x + size * 0.6, point.y - size * 0.2, size * 0.55, size * 0.55);
        context.globalAlpha = plan.alpha;
      }
    });
    context.restore();
    return;
  }

  if (plan.mode === 'bloom') {
    visiblePoints.forEach((point, index) => {
      const radius = Math.max(10, plan.width * (0.5 + (index % 5) * 0.12));
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `${plan.color}`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
    return;
  }

  context.beginPath();
  visiblePoints.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      const previous = visiblePoints[index - 1];
      const controlX = (previous.x + point.x) / 2;
      const controlY = (previous.y + point.y) / 2;
      context.quadraticCurveTo(previous.x, previous.y, controlX, controlY);
    }
  });
  context.stroke();

  visiblePoints.forEach((point, index) => {
    if (index % 3 !== 0) {
      return;
    }

    context.beginPath();
    context.globalAlpha = plan.alpha * 0.55;
    context.arc(point.x, point.y, Math.max(2, plan.width * 0.18), 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
};

const buildParticles = (
  snapshot: AudioAnalysisSnapshot | null,
  style: ArtStyleId,
  width: number,
  height: number
): Particle[] => {
  const metrics = snapshot?.metrics;
  const bass = metrics?.bassEnergy ?? 0.45;
  const treble = metrics?.trebleEnergy ?? 0.42;
  const tempo = metrics?.tempoEstimate ?? 108;
  const palette = paletteByStyle[style];
  const count = particleCountByStyle[style];

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / Math.max(count - 1, 1);
    const angle = ratio * Math.PI * 2;
    const speed = 0.35 + (tempo / 180) * 0.9 + (index % 5) * 0.08;
    return {
      x: width * (0.14 + (ratio * 0.74)),
      y: height * (0.2 + (Math.sin(angle * 1.8) * 0.24 + 0.24)),
      vx: Math.cos(angle) * speed * (0.7 + bass * 0.8),
      vy: Math.sin(angle * 1.4) * speed * (0.55 + treble * 0.9),
      radius: 2.5 + (index % 4) * 1.4 + bass * 2.2,
      color: palette[index % palette.length],
      alpha: 0.16 + (index % 3) * 0.05
    };
  });
};

const drawParticles = (
  context: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  progress: number
): void => {
  const collisionDistance = 56;
  const activeRatio = clamp(progress / 100, 0.12, 1);

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    particle.x += particle.vx * activeRatio;
    particle.y += particle.vy * activeRatio;

    if (particle.x < particle.radius || particle.x > width - particle.radius) {
      particle.vx *= -1;
      particle.x = clamp(particle.x, particle.radius, width - particle.radius);
    }

    if (particle.y < particle.radius || particle.y > height - particle.radius) {
      particle.vy *= -1;
      particle.y = clamp(particle.y, particle.radius, height - particle.radius);
    }

    for (let compareIndex = index + 1; compareIndex < particles.length; compareIndex += 1) {
      const other = particles[compareIndex];
      const dx = other.x - particle.x;
      const dy = other.y - particle.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 0 && distance < collisionDistance) {
        const swapVx = particle.vx;
        const swapVy = particle.vy;
        particle.vx = other.vx * 0.92;
        particle.vy = other.vy * 0.92;
        other.vx = swapVx * 0.92;
        other.vy = swapVy * 0.92;

        context.save();
        context.globalAlpha = 0.06 + (1 - distance / collisionDistance) * 0.12;
        context.strokeStyle = particle.color;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(other.x, other.y);
        context.stroke();
        context.restore();
      }
    }

    context.save();
    context.globalAlpha = particle.alpha + activeRatio * 0.08;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = particle.alpha * 0.4;
    context.strokeStyle = particle.color;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(
      particle.x - particle.vx * (8 + activeRatio * 12),
      particle.y - particle.vy * (8 + activeRatio * 12)
    );
    context.stroke();
    context.restore();
  }
};

export const PaintPreviewCanvas = ({ snapshot, style, progress }: PaintPreviewCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plans = useMemo(() => buildStrokePlans(snapshot, style, 960, 540), [snapshot, style]);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    particlesRef.current = buildParticles(snapshot, style, width, height);

    let frameId = 0;

    const renderFrame = () => {
      context.clearRect(0, 0, width, height);

      const base = context.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, '#f4ede4');
      base.addColorStop(1, '#e7ddcf');
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);

      const wash = context.createRadialGradient(
        width * 0.18,
        height * 0.22,
        0,
        width * 0.18,
        height * 0.22,
        width * 0.3
      );
      wash.addColorStop(0, 'rgba(255,255,255,0.55)');
      wash.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = wash;
      context.fillRect(0, 0, width, height);

      const washTwo = context.createRadialGradient(
        width * 0.76,
        height * 0.3,
        0,
        width * 0.76,
        height * 0.3,
        width * 0.26
      );
      washTwo.addColorStop(0, 'rgba(194,178,156,0.18)');
      washTwo.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = washTwo;
      context.fillRect(0, 0, width, height);

      drawParticles(context, particlesRef.current, width, height, progress);

      plans.forEach((plan, index) => {
        const stageOffset = index * 0.055;
        const localProgress = clamp((progress / 100 - stageOffset) / 0.72, 0, 1);
        drawStroke(context, plan, localProgress);
      });

      context.save();
      context.globalAlpha = 0.14;
      for (let index = 0; index < 180; index += 1) {
        const x = (index * 53) % width;
        const y = (index * 97) % height;
        context.fillStyle = index % 2 === 0 ? 'rgba(58,44,30,0.05)' : 'rgba(255,255,255,0.04)';
        context.fillRect(x, y, 2, 2);
      }
      context.restore();

      frameId = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => window.cancelAnimationFrame(frameId);
  }, [plans, progress, snapshot, style]);

  return <canvas ref={canvasRef} className="paint-preview-canvas" width={960} height={540} />;
};
