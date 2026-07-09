import type { AudioAnalysisSnapshot } from '../types/audio';
import { formatBpm, formatHz, formatPercent } from '../utils/format';
import { WaveformCanvas } from './WaveformCanvas';

interface AnalysisPanelProps {
  snapshot: AudioAnalysisSnapshot | null;
}

export const AnalysisPanel = ({ snapshot }: AnalysisPanelProps) => {
  if (!snapshot) {
    return (
      <section className="panel panel--empty" data-reveal>
        <div className="panel__header">
          <p className="eyebrow">Audio analysis</p>
          <h2>No signal yet</h2>
        </div>
        <p>Upload a track or start live listening to extract waveform and spectral features.</p>
      </section>
    );
  }

  const { metrics } = snapshot;

  return (
    <section className="panel" data-reveal>
      <div className="panel__header">
        <p className="eyebrow">Audio analysis</p>
        <h2>{snapshot.trackLabel}</h2>
      </div>

      <WaveformCanvas waveform={snapshot.waveform} spectrum={snapshot.spectrum} />

      <div className="metric-grid">
        <article className="metric-card">
          <span>Tempo</span>
          <strong>{formatBpm(metrics.tempoEstimate)}</strong>
        </article>
        <article className="metric-card">
          <span>Mood</span>
          <strong>{metrics.mood}</strong>
        </article>
        <article className="metric-card">
          <span>Centroid</span>
          <strong>{formatHz(metrics.centroid)}</strong>
        </article>
        <article className="metric-card">
          <span>Dynamic range</span>
          <strong>{formatPercent(metrics.dynamicRange)}</strong>
        </article>
        <article className="metric-card">
          <span>Bass</span>
          <strong>{formatPercent(metrics.bassEnergy)}</strong>
        </article>
        <article className="metric-card">
          <span>Treble</span>
          <strong>{formatPercent(metrics.trebleEnergy)}</strong>
        </article>
      </div>
    </section>
  );
};
