import { useRef, useEffect, useCallback, useState } from 'react';

interface Marker {
  time: number;
  color: string;
  detectionId: string;
  pilotId: string;
}

interface SeekBarProps {
  startTime: number;
  endTime: number;
  raceStart: number;
  raceEnd: number;
  currentTime: number;
  markers: Marker[];
  onSeek: (timeMs: number) => void;
  onMarkerClick?: (marker: Marker, event: React.MouseEvent) => void;
}

export default function SeekBar({
  startTime, endTime, raceStart, raceEnd, currentTime, markers, onSeek, onMarkerClick,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const duration = endTime - startTime;
  const pct = duration > 0 ? Math.max(0, Math.min(100, ((currentTime - startTime) / duration) * 100)) : 0;
  const raceStartPct = duration > 0 ? ((raceStart - startTime) / duration) * 100 : 0;
  const raceEndPct = duration > 0 ? ((raceEnd - startTime) / duration) * 100 : 0;

  const seekFromClientX = useCallback((clientX: number) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(startTime + p * duration);
  }, [startTime, duration, onSeek]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => seekFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, seekFromClientX]);

  return (
    <div className="px-4 py-2">
      <div
        ref={barRef}
        className="relative h-8 rounded-full bg-surface cursor-pointer group"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).dataset.marker) return;
          setDragging(true);
          seekFromClientX(e.clientX);
        }}
      >
        {/* Progress fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-accent/30"
          style={{ width: `${pct}%` }}
        />
        {/* Scrubber */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent shadow-lg shadow-accent/50 transition-transform group-hover:scale-125"
          style={{ left: `${pct}%` }}
        />
        {/* Race start/end lines */}
        <div className="absolute top-0 h-full w-0.5 bg-success/60" style={{ left: `${raceStartPct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-accent/60" style={{ left: `${raceEndPct}%` }} />
        {/* Detection markers */}
        {markers.map((m, i) => {
          const mPct = duration > 0 ? ((m.time - startTime) / duration) * 100 : 0;
          if (mPct < 0 || mPct > 100) return null;
          return (
            <div
              key={i}
              data-marker="true"
              className="absolute top-0 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent cursor-pointer hover:scale-150 transition-transform"
              style={{ left: `${mPct}%`, borderBottomColor: m.color, marginTop: '2px' }}
              onClick={(e) => {
                e.stopPropagation();
                onMarkerClick?.(m, e);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
