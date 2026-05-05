import { useState, useEffect, useCallback } from 'react';

const VIDEO_CACHE = 'video-cache-v1';

export interface CacheStatus {
  isCached: boolean;
  isDownloading: boolean;
  progress: number;
  downloadedMB: number;
  totalMB: number;
  error: string | null;
}

export function useVideoCache(videoUrl: string | null) {
  const [status, setStatus] = useState<CacheStatus>({
    isCached: false,
    isDownloading: false,
    progress: 0,
    downloadedMB: 0,
    totalMB: 0,
    error: null,
  });

  const cacheKey = videoUrl ? new URL(videoUrl, window.location.origin).href : null;

  useEffect(() => {
    if (!cacheKey || !('caches' in window)) return;
    caches.open(VIDEO_CACHE).then(cache =>
      cache.match(cacheKey).then(resp => {
        if (resp) setStatus(s => ({ ...s, isCached: true }));
      })
    );
  }, [cacheKey]);

  const download = useCallback(async () => {
    if (!videoUrl || !cacheKey || !('caches' in window)) return;
    setStatus(s => ({ ...s, isDownloading: true, progress: 0, error: null }));

    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = parseInt(response.headers.get('Content-Length') || '0');
      const totalMB = contentLength / (1024 * 1024);
      const contentType = response.headers.get('Content-Type') || 'video/mp4';

      if (!response.body) {
        const blob = await response.blob();
        const cache = await caches.open(VIDEO_CACHE);
        await cache.put(cacheKey, new Response(blob, {
          headers: { 'Content-Type': contentType, 'Content-Length': String(blob.size) },
        }));
        setStatus({ isCached: true, isDownloading: false, progress: 100, downloadedMB: totalMB, totalMB, error: null });
        return;
      }

      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const progress = contentLength ? (received / contentLength) * 100 : 0;
        setStatus(s => ({
          ...s,
          progress,
          downloadedMB: received / (1024 * 1024),
          totalMB,
        }));
      }

      const blob = new Blob(chunks);
      const cache = await caches.open(VIDEO_CACHE);
      await cache.put(cacheKey, new Response(blob, {
        headers: { 'Content-Type': contentType, 'Content-Length': String(blob.size) },
      }));
      setStatus({ isCached: true, isDownloading: false, progress: 100, downloadedMB: blob.size / (1024 * 1024), totalMB, error: null });
    } catch (err: any) {
      const msg = err?.name === 'QuotaExceededError'
        ? 'Not enough storage space'
        : err?.message || 'Download failed';
      setStatus(s => ({ ...s, isDownloading: false, error: msg }));
    }
  }, [videoUrl, cacheKey]);

  const remove = useCallback(async () => {
    if (!cacheKey || !('caches' in window)) return;
    const cache = await caches.open(VIDEO_CACHE);
    await cache.delete(cacheKey);
    setStatus({ isCached: false, isDownloading: false, progress: 0, downloadedMB: 0, totalMB: 0, error: null });
  }, [cacheKey]);

  return { status, download, remove };
}
