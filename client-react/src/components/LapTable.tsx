import { useMemo } from 'react';
import type { Race, Pilot, Detection } from '../api';

interface LapTableProps {
  race: Race;
  pilots: Pilot[];
  pilotColors: Record<string, string>;
  raceStartMs: number;
  currentDetectionIds: Map<string, string | null>;
  showInvalid: boolean;
  onDetectionClick: (det: Detection) => void;
  onInvalidate: (detectionId: string) => void;
  onValidate: (detectionId: string) => void;
  onAddLap: (pilotId: string) => void;
}

function formatTime(ms: number): string {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${neg ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export default function LapTable({
  race, pilots, pilotColors, raceStartMs, currentDetectionIds, showInvalid,
  onDetectionClick, onInvalidate, onValidate, onAddLap,
}: LapTableProps) {
  const pilotChannels = race.PilotChannels || [];
  const detections = race.Detections || [];
  const laps = race.Laps || [];

  const allValidLaps = useMemo(() => {
    return laps.filter(l => {
      const det = detections.find(d => d.ID === l.Detection);
      return det && det.Valid && l.LapNumber > 0;
    });
  }, [laps, detections]);

  const overallBest = allValidLaps.length > 0
    ? Math.min(...allValidLaps.map(l => l.LengthSeconds!))
    : null;

  return (
    <div className="space-y-4">
      {pilotChannels.map((pc) => {
        const pilot = pilots.find(p => p.ID === pc.Pilot);
        const pilotName = pilot ? pilot.Name : 'Unknown';
        const color = pilotColors[pc.Pilot] || '#ffffff';

        const pilotDets = detections
          .filter(d => d.Pilot === pc.Pilot)
          .sort((a, b) => new Date(a.Time.replace(/\//g, '-')).getTime() - new Date(b.Time.replace(/\//g, '-')).getTime());

        const pilotLaps = laps
          .filter(l => {
            const det = pilotDets.find(d => d.ID === l.Detection);
            if (!det) return false;
            if (!showInvalid && !det.Valid) return false;
            return true;
          })
          .sort((a, b) => new Date(a.EndTime!.replace(/\//g, '-')).getTime() - new Date(b.EndTime!.replace(/\//g, '-')).getTime());

        const validPilotLaps = pilotLaps.filter(l => {
          const det = pilotDets.find(d => d.ID === l.Detection);
          return det && det.Valid && l.LapNumber > 0;
        });
        const personalBest = validPilotLaps.length > 0
          ? Math.min(...validPilotLaps.map(l => l.LengthSeconds!))
          : null;

        const currentDetId = currentDetectionIds.get(pc.Pilot);

        return (
          <div key={pc.Pilot} className="glass p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {pilotName}
              </h3>
              <button
                onClick={() => onAddLap(pc.Pilot)}
                className="text-xs px-3 py-1.5 sm:px-2 sm:py-1 rounded bg-surface-hover text-text-secondary hover:text-text-primary active:bg-surface-active transition-colors"
              >
                + Add Lap
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-xs uppercase">
                    <th className="text-left py-1 px-2">#</th>
                    <th className="text-left py-1 px-2">Time</th>
                    <th className="text-left py-1 px-2">Length</th>
                    <th className="text-left py-1 px-2">Source</th>
                    <th className="text-right py-1 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotLaps.map((lap) => {
                    const det = pilotDets.find(d => d.ID === lap.Detection);
                    if (!det) return null;

                    const detTimeMs = new Date(det.Time.replace(/\//g, '-')).getTime();
                    const elapsed = detTimeMs - raceStartMs;
                    const isOB = det.Valid && lap.LapNumber > 0 && overallBest !== null && Math.abs(lap.LengthSeconds! - overallBest) < 0.001;
                    const isPB = det.Valid && lap.LapNumber > 0 && personalBest !== null && Math.abs(lap.LengthSeconds! - personalBest) < 0.001 && !isOB;
                    const isCurrent = det.ID === currentDetId;

                    return (
                      <tr
                        key={det.ID}
                        className={`border-t border-border/30 transition-colors ${
                          !det.Valid ? 'opacity-40 line-through' : ''
                        } ${isCurrent ? 'bg-accent/10' : ''} ${
                          isOB ? 'text-gold' : isPB ? 'text-success' : ''
                        }`}
                      >
                        <td className="py-1.5 px-2">{lap.LapNumber === 0 ? 'HS' : lap.LapNumber}</td>
                        <td
                          className="py-1.5 px-2 cursor-pointer hover:text-accent transition-colors"
                          onClick={() => onDetectionClick(det)}
                        >
                          {formatTime(elapsed)}
                        </td>
                        <td className="py-1.5 px-2">{lap.LengthSeconds!.toFixed(3)}s</td>
                        <td className="py-1.5 px-2">
                          {det.TimingSystemType || ''}
                          {det.TimingSystemType === 'Manual' && (
                            <span className="ml-1 text-xs px-1 rounded bg-accent/20 text-accent">M</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {det.Valid ? (
                            <button
                              onClick={() => onInvalidate(det.ID)}
                              className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                              ✗
                            </button>
                          ) : (
                            <button
                              onClick={() => onValidate(det.ID)}
                              className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                            >
                              ✓
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="sm:hidden space-y-2">
              {pilotLaps.map((lap) => {
                const det = pilotDets.find(d => d.ID === lap.Detection);
                if (!det) return null;

                const detTimeMs = new Date(det.Time.replace(/\//g, '-')).getTime();
                const elapsed = detTimeMs - raceStartMs;
                const isOB = det.Valid && lap.LapNumber > 0 && overallBest !== null && Math.abs(lap.LengthSeconds! - overallBest) < 0.001;
                const isPB = det.Valid && lap.LapNumber > 0 && personalBest !== null && Math.abs(lap.LengthSeconds! - personalBest) < 0.001 && !isOB;
                const isCurrent = det.ID === currentDetId;

                return (
                  <div
                    key={det.ID}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/20 ${
                      !det.Valid ? 'opacity-40' : ''
                    } ${isCurrent ? 'bg-accent/10' : 'bg-surface/50'} ${
                      isOB ? 'text-gold' : isPB ? 'text-success' : ''
                    }`}
                    onClick={() => onDetectionClick(det)}
                  >
                    <span className="text-sm font-mono w-8 text-center flex-shrink-0">
                      {lap.LapNumber === 0 ? 'HS' : lap.LapNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-mono ${!det.Valid ? 'line-through' : ''}`}>
                        {lap.LengthSeconds!.toFixed(3)}s
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {formatTime(elapsed)}
                        {det.TimingSystemType === 'Manual' && (
                          <span className="ml-1 px-1 rounded bg-accent/20 text-accent">M</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        det.Valid ? onInvalidate(det.ID) : onValidate(det.ID);
                      }}
                      className={`min-w-[36px] h-9 flex items-center justify-center rounded text-sm ${
                        det.Valid
                          ? 'bg-red-500/20 text-red-400 active:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 active:bg-green-500/30'
                      }`}
                    >
                      {det.Valid ? '✗' : '✓'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
