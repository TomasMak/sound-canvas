interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  imageSize: '1024x1024' | '1536x1024' | '1024x1536';
  onImageSizeChange: (value: '1024x1024' | '1536x1024' | '1024x1536') => void;
}

export const PromptEditor = ({
  value,
  onChange,
  imageSize,
  onImageSizeChange
}: PromptEditorProps) => (
  <section className="panel" data-reveal>
    <div className="panel__header">
      <p className="eyebrow">Prompt shaping</p>
      <h2>Guide the generated piece</h2>
    </div>
    <textarea
      className="prompt-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Optional details, palette notes, scene cues, or constraints."
      rows={6}
    />
    <div className="size-picker">
      <span>Output size</span>
      <select value={imageSize} onChange={(event) => onImageSizeChange(event.target.value as PromptEditorProps['imageSize'])}>
        <option value="1024x1024">Square 1024 x 1024</option>
        <option value="1536x1024">Landscape 1536 x 1024</option>
        <option value="1024x1536">Portrait 1024 x 1536</option>
      </select>
    </div>
  </section>
);
