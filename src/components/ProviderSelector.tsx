import { providerLabels } from '../constants/providers';
import type { ImageProviderId } from '../types/art';

interface ProviderSelectorProps {
  value: ImageProviderId;
  onChange: (provider: ImageProviderId) => void;
}

export const ProviderSelector = ({ value, onChange }: ProviderSelectorProps) => (
  <section className="panel">
    <div className="panel__header">
      <p className="eyebrow">AI provider</p>
      <h2>Pick an image engine</h2>
    </div>
    <div className="provider-row">
      {(Object.keys(providerLabels) as ImageProviderId[]).map((provider) => (
        <label key={provider} className={`provider-pill ${value === provider ? 'provider-pill--active' : ''}`}>
          <input
            type="radio"
            name="provider"
            checked={value === provider}
            onChange={() => onChange(provider)}
          />
          <span>{providerLabels[provider]}</span>
        </label>
      ))}
    </div>
  </section>
);
