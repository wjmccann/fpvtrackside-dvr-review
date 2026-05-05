import { useRef, useEffect, useCallback, useState } from 'react';

interface Marker {
  time: number;
  color: string;
  detectionId: string;
  pilotId: string;
  lapNumber?: number;
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
  pilotNames?: Record<string, string>;
  pilotOrder?: string[];
}

export default function SeekBar({
  startTime, endTime, raceStart, raceEnd, currentTime, markers, onSeek, onMarkerClick, pilotNames, pilotOrder,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState<{ marker: Marker; x: number; y: number } | null>(null);

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

  // Mouse drag
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => seekFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, seekFromClientX]);

  // Touch drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).dataset.marker) return;
    e.preventDefault();
    seekFromClientX(e.touches[0].clientX);
    setDragging(true);
  }, [seekFromClientX]);

  useEffect(() => {
    if (!dragging) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      seekFromClientX(e.touches[0].clientX);
    };
    const onTouchEnd = () => setDragging(false);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); };
  }, [dragging, seekFromClientX]);

  const lanes = pilotOrder || [...new Set(markers.map(m => m.pilotId))];
  const laneHeight = 24;
  const totalHeight = Math.max(lanes.length * laneHeight, 28);
  const showLabels = !!(pilotNames && lanes.length > 1);

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className={`flex items-stretch gap-2 ${showLabels ? '' : ''}`}>
        {/* Pilot labels column */}
        {showLabels && (
          <div className="flex flex-col flex-shrink-0 justify-center" style={{ width: '60px' }}>
            {lanes.map((pilotId) => (
              <div
                key={pilotId}
                className="text-[10px] sm:text-[11px] text-text-muted truncate text-right pr-1"
                style={{ height: `${laneHeight}px`, lineHeight: `${laneHeight}px` }}
                title={pilotNames[pilotId] || ''}
              >
                {pilotNames[pilotId] || ''}
              </div>
            ))}
          </div>
        )}
        {/* Timeline */}
        <div
          ref={barRef}
          className="relative bg-surface cursor-pointer group touch-none flex-1 min-w-0"
          style={{ height: `${totalHeight}px` }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).dataset.marker) return;
          setDragging(true);
          seekFromClientX(e.clientX);
        }}
        onTouchStart={handleTouchStart}
      >
        {/* Progress fill */}
        <div
          className="absolute top-0 left-0 h-full bg-accent/20"
          style={{ width: `${pct}%` }}
        />
        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-accent z-10"
          style={{ left: `${pct}%` }}
        />
        {/* Race start/end lines */}
        <div className="absolute top-0 h-full w-0.5 bg-success/60" style={{ left: `${raceStartPct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-red-400/60" style={{ left: `${raceEndPct}%` }} />

        {/* Swim lanes */}
        {lanes.map((pilotId, laneIdx) => {
          const laneMarkers = markers.filter(m => m.pilotId === pilotId);
          const top = laneIdx * laneHeight;
          return (
            <div key={pilotId} className="absolute left-0 right-0" style={{ top: `${top}px`, height: `${laneHeight}px` }}>
              {laneIdx > 0 && <div className="absolute top-0 left-0 right-0 h-px bg-white/5" />}
              {laneMarkers.map((m, i) => {
                const mPct = duration > 0 ? ((m.time - startTime) / duration) * 100 : 0;
                if (mPct < 0 || mPct > 100) return null;
                return (
                  <div
                    key={i}
                    data-marker="true"
                    className="absolute flex flex-col items-center cursor-pointer hover:z-20 transition-transform hover:scale-110 active:scale-125"
                    style={{ left: `${mPct}%`, top: '1px', transform: 'translateX(-50%)', padding: '0 4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkerClick?.(m, e);
                    }}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setHoveredMarker({ marker: m, x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredMarker(null)}
                  >
                    <div className="w-px" style={{ height: `${laneHeight - 10}px`, backgroundColor: m.color, opacity: 0.7 }} />
                    <span
                      className="text-[9px] sm:text-[10px] font-mono leading-none select-none"
                      style={{ color: m.color }}
                    >
                      {m.lapNumber === 0 ? 'H' : m.lapNumber ?? ''}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      </div>

      {/* Hover tooltip (desktop only) */}
      {hoveredMarker && (
        <div
          className="fixed z-50 px-2 py-1 rounded bg-black/90 text-xs text-white whitespace-nowrap pointer-events-none hidden sm:block"
          style={{ top: hoveredMarker.y - 28, left: hoveredMarker.x, transform: 'translateX(-50%)' }}
        >
          <span style={{ color: hoveredMarker.marker.color }}>
            {pilotNames?.[hoveredMarker.marker.pilotId] || 'Pilot'}
          </span>
          {' — '}
          {hoveredMarker.marker.lapNumber === 0 ? 'Holeshot' : `Lap ${hoveredMarker.marker.lapNumber ?? '?'}`}
        </div>
      )}
    </div>
  );
}
