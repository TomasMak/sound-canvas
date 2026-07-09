interface LiveListenPanelProps {
  isListening: boolean;
  onStart: () => Promise<void>;
  onStop: () => void;
}

export const LiveListenPanel = ({ isListening, onStart, onStop }: LiveListenPanelProps) => (
  <section className="panel" data-reveal>
    <div className="panel__header">
      <p className="eyebrow">Live listening</p>
      <h2>Capture nearby music</h2>
    </div>
    <p className="supporting-copy">
      Use your microphone to listen to a song in the room, Shazam-style, and convert its sound profile into visuals.
    </p>
    <div className="action-row">
      <button type="button" className="button button--primary" onClick={onStart} disabled={isListening}>
        Start listening
      </button>
      <button type="button" className="button button--ghost" onClick={onStop} disabled={!isListening}>
        Stop
      </button>
    </div>
  </section>
);
