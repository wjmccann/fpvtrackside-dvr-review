import { useVideoCache } from '../hooks/useVideoCache';

interface Props {
  videoUrl: string | null;
}

export default function VideoCacheButton({ videoUrl }: Props) {
  const { status, download, remove } = useVideoCache(videoUrl);
  const cacheSupported = 'caches' in window && 'serviceWorker' in navigator && window.isSecureContext;

  if (!videoUrl) return null;

  if (status.isDownloading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <span className="text-xs text-text-muted">
          {status.downloadedMB.toFixed(0)} MB
        </span>
      </div>
    );
  }

  if (status.isCached) {
    return (
      <button
        onClick={remove}
        className="text-xs px-2 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        title="Remove cached video"
      >
        Cached
      </button>
    );
  }

  if (cacheSupported) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={download}
          className="text-xs px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
        >
          Download
        </button>
        {status.error && <span className="text-xs text-red-400">{status.error}</span>}
      </div>
    );
  }

  // Fallback: direct download link when Cache API not available (HTTP, not HTTPS)
  return (
    <a
      href={videoUrl}
      download
      className="text-xs px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
    >
      Save Video
    </a>
  );
}
