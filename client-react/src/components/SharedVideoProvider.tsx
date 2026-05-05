import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { VideoData } from '../hooks/useVideoSync';

interface SharedVideoContextType {
  videoElement: HTMLVideoElement | null;
  videoData: VideoData | null;
}

const SharedVideoContext = createContext<SharedVideoContextType>({ videoElement: null, videoData: null });

export function useSharedVideo() {
  return useContext(SharedVideoContext);
}

interface Props {
  videoData: VideoData | null;
  onRegister: (id: string, el: HTMLVideoElement, data: VideoData) => void;
  onUnregister: (id: string) => void;
  children: React.ReactNode;
}

export default function SharedVideoProvider({ videoData, onRegister, onUnregister, children }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoData) return;
    const id = '__shared__';
    onRegister(id, el, videoData);
    setReady(true);
    return () => {
      onUnregister(id);
      setReady(false);
    };
  }, [videoData, onRegister, onUnregister]);

  return (
    <SharedVideoContext.Provider value={{ videoElement: ready ? videoRef.current : null, videoData }}>
      <video
        ref={videoRef}
        src={videoData?.url}
        muted
        preload="metadata"
        className="hidden"
      />
      {children}
    </SharedVideoContext.Provider>
  );
}
