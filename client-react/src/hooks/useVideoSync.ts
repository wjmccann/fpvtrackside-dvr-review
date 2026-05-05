import { useRef, useCallback } from 'react';

interface FrameTime {
  Seconds: number;
  Time: string;
}

interface RecordInfo {
  frameTimes?: FrameTime[];
  deviceLatency?: number;
  channelBounds?: Array<{
    Channel: string;
    RelativeSourceBounds?: { X: number; Y: number; Width: number; Height: number };
  }>;
}

export interface VideoData {
  filename: string;
  url: string;
  recordInfo?: RecordInfo;
  channel?: string;
}

export function useVideoSync(raceStartMs: number) {
  const videoRefs = useRef<Map<string, { element: HTMLVideoElement; videoData: VideoData }>>(new Map());

  const mediaTimeToWallClock = useCallback((videoData: VideoData, mediaSeconds: number): number => {
    const ft = videoData.recordInfo?.frameTimes;
    if (!ft || ft.length === 0) return raceStartMs + mediaSeconds * 1000;

    const deviceLatency = videoData.recordInfo?.deviceLatency || 0;
    let closest = ft[0];
    let closestDist = Math.abs(ft[0].Seconds - mediaSeconds);
    for (let i = 1; i < ft.length; i++) {
      const dist = Math.abs(ft[i].Seconds - mediaSeconds);
      if (dist < closestDist) { closest = ft[i]; closestDist = dist; }
    }
    const diff = mediaSeconds - closest.Seconds;
    return new Date(closest.Time).getTime() + diff * 1000 - deviceLatency * 1000;
  }, [raceStartMs]);

  const wallClockToMediaTime = useCallback((videoData: VideoData, wallClockMs: number): number => {
    const ft = videoData.recordInfo?.frameTimes;
    if (!ft || ft.length === 0) return (wallClockMs - raceStartMs) / 1000;

    const deviceLatency = videoData.recordInfo?.deviceLatency || 0;
    let closest = ft[0];
    let closestDist = Math.abs(new Date(ft[0].Time).getTime() - wallClockMs);
    for (let i = 1; i < ft.length; i++) {
      const dist = Math.abs(new Date(ft[i].Time).getTime() - wallClockMs);
      if (dist < closestDist) { closest = ft[i]; closestDist = dist; }
    }
    const diffMs = wallClockMs - new Date(closest.Time).getTime();
    return closest.Seconds + diffMs / 1000 + deviceLatency;
  }, [raceStartMs]);

  const seekToWallClock = useCallback((wallClockMs: number) => {
    videoRefs.current.forEach(({ element, videoData }) => {
      const mediaTime = wallClockToMediaTime(videoData, wallClockMs);
      if (mediaTime >= 0 && mediaTime <= (element.duration || Infinity)) {
        element.currentTime = mediaTime;
      }
    });
  }, [wallClockToMediaTime]);

  const getCurrentWallClock = useCallback((): number => {
    const first = videoRefs.current.values().next().value;
    if (!first) return raceStartMs;
    return mediaTimeToWallClock(first.videoData, first.element.currentTime);
  }, [raceStartMs, mediaTimeToWallClock]);

  const playAll = useCallback(() => {
    videoRefs.current.forEach(({ element }) => element.play());
  }, []);

  const pauseAll = useCallback(() => {
    videoRefs.current.forEach(({ element }) => element.pause());
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    videoRefs.current.forEach(({ element }) => { element.playbackRate = rate; });
  }, []);

  const stepFrame = useCallback((direction: number) => {
    const step = direction / 30;
    videoRefs.current.forEach(({ element }) => {
      element.currentTime = Math.max(0, element.currentTime + step);
    });
  }, []);

  const registerVideo = useCallback((id: string, element: HTMLVideoElement, videoData: VideoData) => {
    videoRefs.current.set(id, { element, videoData });
  }, []);

  const unregisterVideo = useCallback((id: string) => {
    videoRefs.current.delete(id);
  }, []);

  return {
    registerVideo,
    unregisterVideo,
    seekToWallClock,
    getCurrentWallClock,
    playAll,
    pauseAll,
    setPlaybackRate,
    stepFrame,
    mediaTimeToWallClock,
    wallClockToMediaTime,
  };
}
