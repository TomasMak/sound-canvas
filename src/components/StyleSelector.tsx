import { artStyleOptions } from '../constants/artStyles';
import type { ArtStyleId } from '../types/art';

interface StyleSelectorProps {
  value: ArtStyleId;
  onChange: (style: ArtStyleId) => void;
}

export const StyleSelector = ({ value, onChange }: StyleSelectorProps) => (
  <section className="panel" data-reveal>
    <div className="panel__header">
      <p className="eyebrow">Art direction</p>
      <h2>Choose a visual language</h2>
    </div>
    <div className="choice-grid">
      {artStyleOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`choice-card ${value === option.id ? 'choice-card--selected' : ''}`}
          onClick={() => onChange(option.id)}
        >
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </button>
      ))}
    </div>
  </section>
);
