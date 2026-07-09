import { useState } from 'react';

interface TrackUploadPanelProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  onTrackSelected: (element: HTMLAudioElement, label: string) => Promise<void>;
}

export const TrackUploadPanel = ({ audioRef, onTrackSelected }: TrackUploadPanelProps) => {
  const [trackName, setTrackName] = useState('No track selected');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    const audioElement = audioRef.current;
    if (!file || !audioElement) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    audioElement.src = objectUrl;
    audioElement.load();
    setTrackName(file.name);
    await onTrackSelected(audioElement, file.name);
  };

  return (
    <section className="panel" data-reveal>
      <div className="panel__header">
        <p className="eyebrow">Track upload</p>
        <h2>Analyze a file</h2>
      </div>
      <label className="upload-box">
        <input type="file" accept="audio/*" onChange={handleFileChange} />
        <span>Choose audio file</span>
        <small>{trackName}</small>
      </label>
      <audio ref={audioRef} controls className="audio-player" />
    </section>
  );
};
