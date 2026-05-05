import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface Props {
  eventId: string;
  raceId: string;
  onComplete?: () => void;
}

interface TranscodeStatus {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: number;
  total: number;
  completed: number;
  error: string | null;
}

export default function TranscodeButton({ eventId, raceId, onComplete }: Props) {
  const [status, setStatus] = useState<TranscodeStatus>({ status: 'idle', progress: 0, total: 0, completed: 0, error: null });
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api.getTranscodeStatus(eventId, raceId).then(setStatus).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [eventId, raceId]);

  useEffect(() => {
    if (status.status === 'running' && !pollRef.current) {
      pollRef.current = window.setInterval(() => {
        api.getTranscodeStatus(eventId, raceId).then((s) => {
          setStatus(s);
          if (s.status !== 'running') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            if (s.status === 'done' && onComplete) onComplete();
          }
        });
      }, 2000);
    }
  }, [status.status, eventId, raceId, onComplete]);

  const startTranscode = async () => {
    const job = await api.startTranscode(eventId, raceId);
    setStatus(job);
  };

  if (status.status === 'done' && status.total > 0) {
    return (
      <span className="text-xs px-2 py-1.5 rounded bg-green-500/20 text-green-400">
        1080p Ready
      </span>
    );
  }

  if (status.status === 'running') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-2 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <span className="text-xs text-text-muted">
          {status.completed}/{status.total}
        </span>
      </div>
    );
  }

  if (status.status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400">{status.error}</span>
        <button
          onClick={startTranscode}
          className="text-xs px-2 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startTranscode}
      className="text-xs px-3 py-1.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
      title="Transcode video to 1080p for smooth playback"
    >
      Transcode 1080p
    </button>
  );
}
