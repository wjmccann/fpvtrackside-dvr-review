import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Event, Race, Pilot, Round } from '../api';

export default function EventBrowser() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [setupDir, setSetupDir] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSettings().then((s: any) => {
      if (!s.dataDirValid) {
        setSetupDir(s.dataDir);
        setSetupNeeded(true);
        setLoading(false);
      } else {
        api.listEvents().then((evts) => {
          setEvents(evts);
          setLoading(false);
        });
      }
    });
  }, []);

  const selectEvent = async (evt: Event) => {
    setLoading(true);
    const [eventDetail, p, rds, rcs] = await Promise.all([
      api.getEvent(evt.ID),
      api.getPilots(evt.ID),
      api.getRounds(evt.ID),
      api.getRaces(evt.ID),
    ]);
    setSelectedEvent(eventDetail);
    setPilots(p);
    setRounds(rds);
    setRaces(rcs);
    setLoading(false);
  };

  const goBack = () => {
    setSelectedEvent(null);
    setRaces([]);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupSaving(true);
    await api.updateSettings({ dataDir: setupDir });
    const s = await api.getSettings() as any;
    if (s.dataDirValid) {
      setSetupNeeded(false);
      setLoading(true);
      const evts = await api.listEvents();
      setEvents(evts);
      setLoading(false);
    } else {
      setSetupSaving(false);
    }
  };

  if (setupNeeded) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <h2 className="text-2xl font-semibold mb-4">Welcome to FPV Trackside DVR Review</h2>
        <p className="text-text-secondary mb-6">
          Please set the path to your FPV Trackside events directory to get started.
        </p>
        <form onSubmit={handleSetup} className="glass p-6 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Events Directory</label>
            <input
              type="text"
              value={setupDir}
              onChange={(e) => setSetupDir(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
              placeholder="C:\\Users\\You\\AppData\\Local\\FPVTrackside\\events"
            />
            <p className="text-xs text-text-muted mt-1">
              This is typically located at %LOCALAPPDATA%\FPVTrackside\events
            </p>
          </div>
          <button
            type="submit"
            disabled={setupSaving}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white font-medium transition-colors disabled:opacity-50"
          >
            {setupSaving ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Events</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((evt) => {
            const startDate = evt.Start
              ? new Date(evt.Start.replace(/\//g, '-')).toLocaleDateString()
              : '';
            return (
              <button
                key={evt.ID}
                onClick={() => selectEvent(evt)}
                className="glass glass-hover p-5 text-left transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-text-primary">{evt.Name}</h3>
                  {evt.EventType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                      {evt.EventType}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">
                  {startDate} &bull; {evt.PilotsRegistered || 0} pilots &bull;{' '}
                  {evt.RaceCount || 0} races
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const roundMap: Record<string, Round> = {};
  for (const r of rounds) roundMap[r.ID] = r;

  const byRound: Record<string, Race[]> = {};
  for (const race of races) {
    const rk = race.Round || 'none';
    if (!byRound[rk]) byRound[rk] = [];
    byRound[rk].push(race);
  }

  const sortedRoundKeys = Object.keys(byRound).sort((a, b) => {
    const ra = roundMap[a], rb = roundMap[b];
    return (ra ? ra.Order : 9999) - (rb ? rb.Order : 9999);
  });

  return (
    <div>
      <button
        onClick={goBack}
        className="text-sm text-text-secondary hover:text-text-primary mb-4 transition-colors"
      >
        ← Back to Events
      </button>
      <h2 className="text-2xl font-semibold mb-6">{selectedEvent.Name}</h2>

      {sortedRoundKeys.map((rk) => {
        const round = roundMap[rk];
        const roundLabel = round ? `Round ${round.RoundNumber}` : 'Unassigned';
        const sortedRaces = byRound[rk].sort(
          (a, b) => (a.RaceNumber || 0) - (b.RaceNumber || 0)
        );

        return (
          <div key={rk} className="mb-6">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
              {roundLabel}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedRaces.map((race) => {
                const pilotNames = (race.PilotChannels || [])
                  .map((pc) => {
                    const p = pilots.find((pl) => pl.ID === pc.Pilot);
                    return p ? p.Name : 'Unknown';
                  })
                  .join(', ');

                return (
                  <button
                    key={race.ID}
                    onClick={() => navigate(`/race/${selectedEvent.ID}/${race.ID}`)}
                    className="glass glass-hover p-4 text-left transition-all hover:scale-[1.01] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary">
                        Race {race.RaceNumber || '?'}
                      </span>
                      {race.Bracket && race.Bracket !== 'None' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-active text-text-secondary">
                          {race.Bracket}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary truncate">{pilotNames}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
