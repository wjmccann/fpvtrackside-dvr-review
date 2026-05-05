import { useEffect, useRef } from 'react';
import type { VideoData } from '../hooks/useVideoSync';

interface Bounds {
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

interface VideoPlayerProps {
  videoData: VideoData;
  pilotId: string;
  bounds?: Bounds | null;
  onRegister: (id: string, el: HTMLVideoElement, data: VideoData) => void;
  onUnregister: (id: string) => void;
  onClickVideo: () => void;
}

export default function VideoPlayer({ videoData, pilotId, bounds, onRegister, onUnregister, onClickVideo }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    onRegister(pilotId, el, videoData);
    return () => onUnregister(pilotId);
  }, [pilotId, videoData, onRegister, onUnregister]);

  const style: React.CSSProperties = {};
  if (bounds && (bounds.Width < 1 || bounds.Height < 1)) {
    const pctX = bounds.X * 100;
    const pctY = bounds.Y * 100;
    const pctW = bounds.Width * 100;
    const pctH = bounds.Height * 100;
    style.objectFit = 'cover';
    style.objectPosition = `${pctX + pctW / 2}% ${pctY + pctH / 2}%`;
    style.clipPath = `inset(${pctY}% ${100 - pctX - pctW}% ${100 - pctY - pctH}% ${pctX}%)`;
  }

  return (
    <video
      ref={videoRef}
      src={videoData.url}
      muted
      preload="metadata"
      className="w-full h-full object-contain cursor-pointer"
      style={style}
      onClick={onClickVideo}
    />
  );
}
