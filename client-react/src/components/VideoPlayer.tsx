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

  const wrapperStyle: React.CSSProperties = {};
  const style: React.CSSProperties = {};
  if (bounds && (bounds.Width < 1 || bounds.Height < 1)) {
    const scaleX = 1 / bounds.Width;
    const scaleY = 1 / bounds.Height;
    const translateX = -bounds.X * scaleX * 100;
    const translateY = -bounds.Y * scaleY * 100;
    wrapperStyle.overflow = 'hidden';
    style.width = `${scaleX * 100}%`;
    style.height = `${scaleY * 100}%`;
    style.objectFit = 'cover';
    style.marginLeft = `${translateX}%`;
    style.marginTop = `${translateY}%`;
  }

  return (
    <div className="w-full h-full" style={wrapperStyle}>
      <video
        ref={videoRef}
        src={videoData.url}
        muted
        preload="metadata"
        className={`${bounds && bounds.Width < 1 ? '' : 'w-full h-full object-contain'} cursor-pointer`}
        style={style}
        onClick={onClickVideo}
      />
    </div>
  );
}
