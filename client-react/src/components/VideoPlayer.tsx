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

  if (bounds && (bounds.Width < 1 || bounds.Height < 1)) {
    const scaleX = 1 / bounds.Width;
    const scaleY = 1 / bounds.Height;
    // Transform origin at the center of the desired crop region
    const originX = (bounds.X + bounds.Width / 2) * 100;
    const originY = (bounds.Y + bounds.Height / 2) * 100;

    return (
      <div className="w-full h-full overflow-hidden cursor-pointer" onClick={onClickVideo}>
        <video
          ref={videoRef}
          src={videoData.url}
          muted
          preload="metadata"
          className="w-full h-full"
          style={{
            objectFit: 'fill',
            transformOrigin: `${originX}% ${originY}%`,
            transform: `scale(${scaleX}, ${scaleY})`,
          }}
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoData.url}
      muted
      preload="metadata"
      className="w-full h-full object-contain cursor-pointer"
      onClick={onClickVideo}
    />
  );
}
