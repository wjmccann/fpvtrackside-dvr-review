import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Race, Pilot, Round, Event, Detection } from '../api';
import { useVideoSync } from '../hooks/useVideoSync';
import type { VideoData } from '../hooks/useVideoSync';
import VideoPlayer from '../components/VideoPlayer';
import VideoCacheButton from '../components/VideoCacheButton';
import SeekBar from '../components/SeekBar';
import LapTable from '../components/LapTable';

export default function RaceReview() {
  const { eventId, raceId } = useParams<{ eventId: string; raceId: string }>();
  const navigate = useNavigate();

  const [race, setRace] = useState<Race | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [playing, setPlaying] = useState(false);
  const [slowMotion, setSlowMotion] = useState(false);
  const [currentWallClock, setCurrentWallClock] = useState(0);
  const [showInvalid, setShowInvalid] = useState(false);
  const [currentDetectionIds] = useState<Map<string, string | null>>(new Map());
  const [actionPanel, setActionPanel] = useState<{ detectionId: string; x: number; y: number } | null>(null);
  const [focusedPilotId, setFocusedPilotId] = useState<string | null>(null);
  const [videoConfig, setVideoConfig] = useState<any[]>([]);

  const raceStartMs = race ? new Date(race.Start!.replace(/\//g, '-')).getTime() : 0;
  const raceEndMs = race
    ? (race.End ? new Date(race.End.replace(/\//g, '-')).getTime() : raceStartMs + 300000)
    : 0;

  const sync = useVideoSync(raceStartMs);
  const timeUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    if (!eventId || !raceId) return;
    Promise.all([
      api.getRace(eventId, raceId),
      api.getEvent(eventId),
      api.getPilots(eventId),
      api.getRounds(eventId),
      api.getVideos(eventId, raceId),
      api.getVideoConfig().catch(() => []),
      api.getSettings().catch(() => ({ activeVideoConfig: 0 })),
    ]).then(([r, e, p, rds, v, vc, s]) => {
      setRace(r);
      setEvent(e);
      setPilots(p);
      setRounds(rds);
      setVideos(v.map((vf: any) => ({
        ...vf,
        url: `/api/video/${eventId}/${raceId}/${vf.filename}`,
      })));
      const activeIdx = (s as any).activeVideoConfig || 0;
      setVideoConfig(vc.length > 0 ? [vc[activeIdx] || vc[0]] : []);
    });
  }, [eventId, raceId]);

  const startTimeUpdate = useCallback(() => {
    const tick = () => {
      setCurrentWallClock(sync.getCurrentWallClock());
      timeUpdateRef.current = requestAnimationFrame(tick);
    };
    timeUpdateRef.current = requestAnimationFrame(tick);
  }, [sync]);

  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateRef.current) cancelAnimationFrame(timeUpdateRef.current);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (playing) {
      sync.pauseAll();
      setPlaying(false);
      stopTimeUpdate();
      setCurrentWallClock(sync.getCurrentWallClock());
    } else {
      sync.playAll();
      setPlaying(true);
      startTimeUpdate();
    }
  }, [playing, sync, startTimeUpdate, stopTimeUpdate]);

  const toggleSlow = useCallback(() => {
    const next = !slowMotion;
    setSlowMotion(next);
    sync.setPlaybackRate(next ? 0.25 : 1);
  }, [slowMotion, sync]);

  const stepFrame = useCallback((dir: number) => {
    sync.stepFrame(dir);
    setCurrentWallClock(sync.getCurrentWallClock());
  }, [sync]);

  const handleSeek = useCallback((timeMs: number) => {
    sync.seekToWallClock(timeMs);
    setCurrentWallClock(timeMs);
  }, [sync]);

  const addLapFromCurrentPosition = useCallback(async (pilotId: string) => {
    if (!eventId || !raceId) return;
    const wc = sync.getCurrentWallClock();
    const d = new Date(wc);
    const timeStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    await api.addLap(eventId, raceId, { pilotId, time: timeStr });
    const updated = await api.getRace(eventId, raceId);
    setRace(updated);
  }, [eventId, raceId, sync]);

  const handleInvalidate = useCallback(async (detectionId: string) => {
    if (!eventId || !raceId) return;
    await api.invalidateLap(eventId, raceId, detectionId);
    const updated = await api.getRace(eventId, raceId);
    setRace(updated);
  }, [eventId, raceId]);

  const handleValidate = useCallback(async (detectionId: string) => {
    if (!eventId || !raceId) return;
    await api.validateLap(eventId, raceId, detectionId);
    const updated = await api.getRace(eventId, raceId);
    setRace(updated);
  }, [eventId, raceId]);

  const handleDetectionClick = useCallback((det: Detection) => {
    const timeMs = new Date(det.Time.replace(/\//g, '-')).getTime();
    sync.seekToWallClock(timeMs);
    setCurrentWallClock(timeMs);
  }, [sync]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) handleSeek(currentWallClock + 500);
          else stepFrame(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) handleSeek(currentWallClock - 500);
          else stepFrame(-1);
          break;
        case 'Escape':
          if (focusedPilotId) { setFocusedPilotId(null); e.preventDefault(); }
          break;
        default:
          if (e.code >= 'Digit1' && e.code <= 'Digit9' && !e.ctrlKey && !e.metaKey) {
            const idx = parseInt(e.code.replace('Digit', '')) - 1;
            const pcs = race?.PilotChannels || [];
            if (idx < pcs.length) {
              e.preventDefault();
              addLapFromCurrentPosition(pcs[idx].Pilot);
            }
          }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePlayPause, stepFrame, handleSeek, currentWallClock, race, addLapFromCurrentPosition, focusedPilotId]);

  // Dismiss action panel on outside click
  useEffect(() => {
    if (!actionPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.fixed.z-50') && !target.dataset.marker) {
        setActionPanel(null);
      }
    };
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [actionPanel]);

  // Cleanup
  useEffect(() => () => stopTimeUpdate(), [stopTimeUpdate]);

  if (!race || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const round = rounds.find(r => r.ID === race.Round);
  const title = [event.Name, round ? `Round ${round.RoundNumber}` : '', `Race ${race.RaceNumber || '?'}`].filter(Boolean).join(' — ');

  const pilotChannels = race.PilotChannels || [];
  const pilotColors: Record<string, string> = {};
  const colorPalette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  pilotChannels.forEach((pc, i) => { pilotColors[pc.Pilot] = colorPalette[i % colorPalette.length]; });

  const timelineStartMs = raceStartMs - 5000;
  const timelineEndMs = raceEndMs + 5000;

  const detectionMarkers = (race.Detections || [])
    .filter(d => d.Valid)
    .map(d => {
      const lap = (race.Laps || []).find(l => l.Detection === d.ID);
      return {
        time: new Date(d.Time.replace(/\//g, '-')).getTime(),
        color: pilotColors[d.Pilot] || '#ffffff',
        detectionId: d.ID,
        pilotId: d.Pilot,
        lapNumber: lap?.LapNumber,
      };
    });

  const pilotNames: Record<string, string> = {};
  pilotChannels.forEach(pc => {
    const pilot = pilots.find(p => p.ID === pc.Pilot);
    pilotNames[pc.Pilot] = pilot?.Name || 'Unknown';
  });
  const pilotOrder = pilotChannels.map(pc => pc.Pilot);

  const elapsed = currentWallClock - raceStartMs;
  const formatTimeDisplay = (ms: number) => {
    const neg = ms < 0;
    ms = Math.abs(ms);
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${neg ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  // Map channel GUIDs to VideoSettings bounds via display names
  // Event.Channels[i] (GUID) corresponds to Event.ChannelDisplayNames[i] (e.g. "R1")
  // VideoSettings uses full names like "Raceband 1"
  const channelGuidToName: Record<string, string> = {};
  const eventChannels = event.Channels || [];
  const eventDisplayNames = event.ChannelDisplayNames || [];
  const bandPrefixes: Record<string, string> = { R: 'Raceband', F: 'Fatshark', E: 'Band E', B: 'Band B', A: 'Band A' };
  for (let i = 0; i < eventChannels.length; i++) {
    const display = eventDisplayNames[i] || '';
    const bandChar = display.replace(/[0-9]/g, '');
    const num = display.replace(/[^0-9]/g, '');
    const fullName = `${bandPrefixes[bandChar] || bandChar} ${num}`;
    channelGuidToName[eventChannels[i]] = fullName;
  }

  const channelBoundsMap: Record<string, { X: number; Y: number; Width: number; Height: number }> = {};
  for (const vc of videoConfig) {
    for (const b of vc.bounds || []) {
      if (b.Channel && b.Channel !== 'None') {
        channelBoundsMap[b.Channel] = b.RelativeSourceBounds;
      }
    }
  }

  const gridCols = pilotChannels.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Back
        </button>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {/* Video Grid */}
      <div className={`grid ${focusedPilotId ? 'grid-cols-1' : gridCols} gap-2 transition-all`}>
        {pilotChannels.map((pc) => {
          const pilot = pilots.find(p => p.ID === pc.Pilot);
          const videoData = videos.length > 0 ? videos[0] : null;
          const channelName = channelGuidToName[pc.Channel] || pc.Channel;
          const pilotBounds = channelBoundsMap[channelName] || null;
          const color = pilotColors[pc.Pilot];
          const isFocused = focusedPilotId === pc.Pilot;
          const isDimmed = focusedPilotId !== null && !isFocused;

          return (
            <div
              key={pc.Pilot}
              className={`glass overflow-hidden relative transition-all duration-300 ${isDimmed ? 'opacity-30 scale-95 hidden' : ''} ${isFocused ? 'col-span-full' : ''}`}
              style={{ borderColor: color, borderWidth: '1px' }}
            >
              <div
                className="absolute top-2 left-2 z-10 text-xs px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm cursor-pointer hover:bg-black/80 transition-colors"
                style={{ color }}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedPilotId(isFocused ? null : pc.Pilot);
                }}
                title={isFocused ? 'Click to show all pilots (Esc)' : 'Click to enlarge'}
              >
                {pilot?.Name || 'Unknown'} [{channelName}] {isFocused ? '⤡' : '⤢'}
              </div>
              <div className={`${isFocused ? 'aspect-[16/7]' : 'aspect-video'} bg-bg-secondary transition-all`}>
                {videoData ? (
                  <VideoPlayer
                    videoData={videoData}
                    pilotId={pc.Pilot}
                    bounds={pilotBounds}
                    onRegister={sync.registerVideo}
                    onUnregister={sync.unregisterVideo}
                    onClickVideo={togglePlayPause}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">No video</div>
                )}
              </div>
              <button
                onClick={() => addLapFromCurrentPosition(pc.Pilot)}
                className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-accent/80 hover:bg-accent text-white text-lg flex items-center justify-center transition-colors"
                title={`Add lap for ${pilot?.Name}`}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {/* Playback Controls */}
      <div className="glass px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
        <button onClick={() => stepFrame(-1)} className="min-w-[40px] h-10 sm:h-8 flex items-center justify-center rounded bg-surface-hover text-text-secondary hover:text-text-primary active:bg-surface-active">⏮</button>
        <button onClick={togglePlayPause} className="min-w-[48px] h-10 sm:h-8 flex items-center justify-center rounded bg-accent/20 text-accent hover:bg-accent/30 active:bg-accent/40 font-bold">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => stepFrame(1)} className="min-w-[40px] h-10 sm:h-8 flex items-center justify-center rounded bg-surface-hover text-text-secondary hover:text-text-primary active:bg-surface-active">⏭</button>
        <button
          onClick={toggleSlow}
          className={`min-w-[40px] h-10 sm:h-8 flex items-center justify-center rounded text-xs ${slowMotion ? 'bg-accent/30 text-accent' : 'bg-surface-hover text-text-secondary'} active:bg-surface-active`}
        >
          0.25x
        </button>
        <span className="text-xs sm:text-sm font-mono text-text-secondary ml-auto">
          {formatTimeDisplay(elapsed)}
        </span>
        <VideoCacheButton videoUrl={videos.length > 0 ? videos[0].url : null} />
      </div>

      {/* Seek Bar */}
      <SeekBar
        startTime={timelineStartMs}
        endTime={timelineEndMs}
        raceStart={raceStartMs}
        raceEnd={raceEndMs}
        currentTime={currentWallClock}
        markers={detectionMarkers}
        onSeek={handleSeek}
        onMarkerClick={(m, e) => {
          handleSeek(m.time);
          setActionPanel({ detectionId: m.detectionId, x: e.clientX, y: e.clientY });
        }}
        pilotNames={pilotNames}
        pilotOrder={pilotOrder}
      />

      {/* Detection Action Panel */}
      {actionPanel && (() => {
        const det = (race.Detections || []).find(d => d.ID === actionPanel.detectionId);
        if (!det) return null;
        const pilot = pilots.find(p => p.ID === det.Pilot);
        const lap = (race.Laps || []).find(l => l.Detection === det.ID);
        const lapLabel = lap ? (lap.LapNumber === 0 ? 'Holeshot' : `Lap ${lap.LapNumber}`) : 'Detection';
        const lengthStr = lap?.LengthSeconds ? ` (${lap.LengthSeconds.toFixed(3)}s)` : '';

        return (
          <div
            className="fixed z-50 glass p-3 shadow-xl min-w-[200px]"
            style={{ top: actionPanel.y + 12, left: actionPanel.x - 100 }}
          >
            <div className="text-sm mb-2">
              <span style={{ color: pilotColors[det.Pilot] }}>{pilot?.Name || 'Unknown'}</span>
              <span className="text-text-secondary"> — {lapLabel}{lengthStr}</span>
            </div>
            <div className="flex gap-2">
              {det.Valid ? (
                <button
                  onClick={async () => {
                    await handleInvalidate(det.ID);
                    setActionPanel(null);
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Invalidate
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await handleValidate(det.ID);
                    setActionPanel(null);
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                >
                  Validate
                </button>
              )}
              <button
                onClick={() => setActionPanel(null)}
                className="text-xs px-2 py-1.5 rounded bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })()}

      {/* Quick Add Bar */}
      <div className="glass px-3 sm:px-4 py-2 sm:py-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted">Add Lap:</span>
        {pilotChannels.map((pc, i) => {
          const pilot = pilots.find(p => p.ID === pc.Pilot);
          return (
            <button
              key={pc.Pilot}
              onClick={() => addLapFromCurrentPosition(pc.Pilot)}
              className="text-xs px-3 py-2 sm:px-2 sm:py-1 rounded border transition-colors hover:bg-surface-hover active:bg-surface-active"
              style={{ borderColor: pilotColors[pc.Pilot], color: pilotColors[pc.Pilot] }}
            >
              <span className="opacity-50 mr-1">{i + 1}</span>{pilot?.Name || 'Unknown'}
            </button>
          );
        })}
      </div>

      {/* Lap Editor */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">Lap Data</h3>
        {(race.Detections || []).some(d => !d.Valid) && (
          <button
            onClick={() => setShowInvalid(!showInvalid)}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {showInvalid ? 'Hide' : 'Show'} invalid laps
          </button>
        )}
      </div>
      <LapTable
        race={race}
        pilots={pilots}
        pilotColors={pilotColors}
        raceStartMs={raceStartMs}
        currentDetectionIds={currentDetectionIds}
        showInvalid={showInvalid}
        onDetectionClick={handleDetectionClick}
        onInvalidate={handleInvalidate}
        onValidate={handleValidate}
        onAddLap={addLapFromCurrentPosition}
      />
    </div>
  );
}
