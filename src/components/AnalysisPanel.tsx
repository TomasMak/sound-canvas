import type { AudioAnalysisSnapshot } from '../types/audio';
import type { ArtStyleId } from '../types/art';
import { VISUAL_SCORE_COLORS } from '../services/visualScore';
import { formatBpm, formatDecimal, formatHz, formatPercent } from '../utils/format';
import { VisualScoreCanvas } from './VisualScoreCanvas';
import { WaveformCanvas } from './WaveformCanvas';

interface AnalysisPanelProps {
  snapshot: AudioAnalysisSnapshot | null;
  style: ArtStyleId;
}

export const AnalysisPanel = ({ snapshot, style }: AnalysisPanelProps) => {
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
  const bandRows = [
    { label: 'Bass energy', value: metrics.bassEnergy },
    { label: 'Mid energy', value: metrics.midEnergy },
    { label: 'Treble energy', value: metrics.trebleEnergy },
    { label: 'Overall intensity', value: metrics.rms }
  ];

  return (
    <section className="panel" data-reveal>
      <div className="panel__header">
        <p className="eyebrow">Audio analysis</p>
        <h2>{snapshot.trackLabel}</h2>
      </div>

      <WaveformCanvas waveform={snapshot.waveform} spectrum={snapshot.spectrum} />

      <section className="visual-score">
        <div className="visual-score__header">
          <div>
            <p className="eyebrow">Track visual score</p>
            <h3>The composition sent to the image model</h3>
          </div>
          <span className="visual-score__seed">Signature {snapshot.signature.seed}</span>
        </div>
        <VisualScoreCanvas snapshot={snapshot} style={style} />
        <div className="visual-score__legend" aria-label="Visual score color mapping">
          <span style={{ ['--legend-color' as string]: VISUAL_SCORE_COLORS.bass }}>
            Bass
          </span>
          <span style={{ ['--legend-color' as string]: VISUAL_SCORE_COLORS.mids }}>
            Mids
          </span>
          <span style={{ ['--legend-color' as string]: VISUAL_SCORE_COLORS.treble }}>
            Treble
          </span>
          <span style={{ ['--legend-color' as string]: VISUAL_SCORE_COLORS.transient }}>
            Beats / transients
          </span>
        </div>
        <p className="visual-score__note">
          Time moves from left to right. The paths follow the track's changing frequency
          energy; the surrounding shape follows loudness, and the accents mark sudden
          hits.
        </p>
      </section>

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

      <div className="analysis-detail-grid">
        <section className="analysis-block">
          <div className="analysis-block__header">
            <span className="eyebrow">Energy map</span>
            <h3>How the track is distributed</h3>
          </div>
          <div className="analysis-bars">
            {bandRows.map((row) => (
              <div key={row.label} className="analysis-bars__row">
                <div className="analysis-bars__meta">
                  <strong>{row.label}</strong>
                  <span>{formatPercent(row.value)}</span>
                </div>
                <div className="analysis-bars__track">
                  <div className="analysis-bars__fill" style={{ width: formatPercent(row.value) }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="analysis-block">
          <div className="analysis-block__header">
            <span className="eyebrow">Signal details</span>
            <h3>What the system detected</h3>
          </div>
          <dl className="analysis-data-list">
            <div>
              <dt>Source</dt>
              <dd>{snapshot.sourceKind === 'microphone' ? 'Live microphone' : 'Uploaded track'}</dd>
            </div>
            <div>
              <dt>Captured</dt>
              <dd>{new Date(snapshot.capturedAt).toLocaleTimeString()}</dd>
            </div>
            <div>
              <dt>Analyzed duration</dt>
              <dd>{Math.round(snapshot.signature.durationSeconds)} sec</dd>
            </div>
            <div>
              <dt>RMS level</dt>
              <dd>{formatDecimal(metrics.rms)}</dd>
            </div>
            <div>
              <dt>Peak level</dt>
              <dd>{formatDecimal(metrics.peak)}</dd>
            </div>
            <div>
              <dt>Mid energy</dt>
              <dd>{formatPercent(metrics.midEnergy)}</dd>
            </div>
            <div>
              <dt>Zero crossing rate</dt>
              <dd>{formatDecimal(metrics.zeroCrossingRate)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
};
