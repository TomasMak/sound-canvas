import { useEffect, useRef, useState } from 'react';

interface TrackUploadPanelProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isAnalyzing: boolean;
  onTrackSelected: (element: HTMLAudioElement, label: string, file: File) => Promise<void>;
}

export const TrackUploadPanel = ({
  audioRef,
  isAnalyzing,
  onTrackSelected
}: TrackUploadPanelProps) => {
  const [trackName, setTrackName] = useState('No track selected');
  const objectUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    []
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    const audioElement = audioRef.current;
    if (!file || !audioElement) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    audioElement.src = objectUrl;
    audioElement.load();
    setTrackName(file.name);
    await onTrackSelected(audioElement, file.name, file);
  };

  return (
    <section className="panel" data-reveal>
      <div className="panel__header">
        <p className="eyebrow">Track upload</p>
        <h2>Analyze a file</h2>
      </div>
      <label className="upload-box">
        <input type="file" accept="audio/*" onChange={handleFileChange} />
        <span>{isAnalyzing ? 'Reading the full track...' : 'Choose audio file'}</span>
        <small>{isAnalyzing ? 'Building its waveform and frequency signature' : trackName}</small>
      </label>
      <audio ref={audioRef} controls className="audio-player" />
    </section>
  );
};
