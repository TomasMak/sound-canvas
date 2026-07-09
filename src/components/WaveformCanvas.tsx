import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  waveform: number[];
  spectrum: number[];
}

const drawBars = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  spectrum: number[]
): void => {
  const barWidth = width / Math.max(spectrum.length, 1);
  spectrum.forEach((value, index) => {
    const barHeight = value * height * 0.45;
    const x = index * barWidth;
    context.fillRect(x, height - barHeight, Math.max(barWidth - 1, 1), barHeight);
  });
};

export const WaveformCanvas = ({ waveform, spectrum }: WaveformCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f6c667');
    gradient.addColorStop(0.5, '#ef6f6c');
    gradient.addColorStop(1, '#33658a');

    context.fillStyle = 'rgba(10, 19, 25, 0.9)';
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(246, 198, 103, 0.2)';
    drawBars(context, width, height, spectrum.slice(0, 80));

    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.beginPath();

    waveform.forEach((value, index) => {
      const x = (index / Math.max(waveform.length - 1, 1)) * width;
      const y = height / 2 + (value - 0.5) * height * 0.55;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  }, [waveform, spectrum]);

  return <canvas ref={canvasRef} className="waveform" width={880} height={280} />;
};
