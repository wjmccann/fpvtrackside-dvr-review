import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

interface CachedEntry {
  url: string;
  label: string;
  sizeMB: number;
}

interface VideoBound {
  Channel: string;
  SourceType: string;
  RelativeSourceBounds: { X: number; Y: number; Width: number; Height: number };
}

interface VideoConfig {
  deviceName: string;
  splits: string;
  bounds: VideoBound[];
}

export default function Settings() {
  const [settings, setSettings] = useState({ dataDir: '', tracksideUrl: '', ffmpegPath: '', activeVideoConfig: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cachedVideos, setCachedVideos] = useState<CachedEntry[]>([]);
  const [videoConfigs, setVideoConfigs] = useState<VideoConfig[]>([]);
  const [videoConfigError, setVideoConfigError] = useState<string | null>(null);

  const loadCachedVideos = useCallback(async () => {
    if (!('caches' in window)) return;
    const cache = await caches.open('video-cache-v1');
    const keys = await cache.keys();
    const entries: CachedEntry[] = [];
    for (const req of keys) {
      const resp = await cache.match(req);
      const size = resp ? parseInt(resp.headers.get('Content-Length') || '0') : 0;
      const pathname = new URL(req.url).pathname;
      const parts = pathname.split('/');
      const filename = parts[parts.length - 1];
      entries.push({ url: req.url, label: filename, sizeMB: size / (1024 * 1024) });
    }
    setCachedVideos(entries);
  }, []);

  useEffect(() => {
    api.getSettings().then(setSettings);
    loadCachedVideos();
    api.getVideoConfig()
      .then(setVideoConfigs)
      .catch((e: any) => setVideoConfigError(e?.response?.data?.error || 'Failed to load'));
  }, [loadCachedVideos]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.updateSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <form onSubmit={handleSave} className="glass p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Data Directory</label>
          <input
            type="text"
            value={settings.dataDir}
            onChange={(e) => setSettings({ ...settings, dataDir: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
          <p className="text-xs text-text-muted mt-1">Path to FPV Trackside events directory</p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Trackside URL</label>
          <input
            type="text"
            value={settings.tracksideUrl}
            onChange={(e) => setSettings({ ...settings, tracksideUrl: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">FFmpeg Path</label>
          <input
            type="text"
            value={settings.ffmpegPath}
            onChange={(e) => setSettings({ ...settings, ffmpegPath: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </form>
      {/* Video Channel Configuration */}
      <div className="glass p-6 space-y-4 mt-6">
        <h3 className="text-lg font-medium">Video Channel Splitting</h3>
        <p className="text-xs text-text-muted">
          Loaded from FPV Trackside VideoSettings.xml. Select which video source to use for channel splitting.
        </p>
        {videoConfigError && (
          <p className="text-sm text-red-400">{videoConfigError}</p>
        )}
        {videoConfigs.length > 1 && (
          <div>
            <label className="block text-sm text-text-secondary mb-1">Active Video Source</label>
            <select
              value={settings.activeVideoConfig}
              onChange={async (e) => {
                const val = parseInt(e.target.value);
                setSettings(s => ({ ...s, activeVideoConfig: val }));
                await api.updateSettings({ activeVideoConfig: val });
              }}
              className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              {videoConfigs.map((vc, idx) => (
                <option key={idx} value={idx}>{vc.deviceName} ({vc.splits})</option>
              ))}
            </select>
          </div>
        )}
        {videoConfigs.map((vc, idx) => (
          <div key={idx} className={`space-y-3 ${videoConfigs.length > 1 && idx !== settings.activeVideoConfig ? 'opacity-30' : ''}`}>
            <div className="text-sm text-text-secondary">
              <span className="font-medium">{vc.deviceName}</span>
              <span className="text-text-muted ml-2">({vc.splits})</span>
              {idx === settings.activeVideoConfig && videoConfigs.length > 1 && <span className="text-accent ml-2 text-xs">Active</span>}
            </div>
            {/* Visual grid preview */}
            <div className="relative w-full aspect-video bg-bg-secondary rounded border border-border">
              {vc.bounds.map((b, i) => (
                <div
                  key={i}
                  className="absolute border border-accent/50 flex items-center justify-center text-[10px] text-text-secondary bg-accent/5 hover:bg-accent/15 transition-colors"
                  style={{
                    left: `${b.RelativeSourceBounds.X * 100}%`,
                    top: `${b.RelativeSourceBounds.Y * 100}%`,
                    width: `${b.RelativeSourceBounds.Width * 100}%`,
                    height: `${b.RelativeSourceBounds.Height * 100}%`,
                  }}
                  title={`X: ${b.RelativeSourceBounds.X.toFixed(4)}, Y: ${b.RelativeSourceBounds.Y.toFixed(4)}, W: ${b.RelativeSourceBounds.Width.toFixed(4)}, H: ${b.RelativeSourceBounds.Height.toFixed(4)}`}
                >
                  {b.Channel}
                </div>
              ))}
            </div>
            {/* Table of values */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="text-left py-1 pr-2">Channel</th>
                    <th className="text-right py-1 px-2">X</th>
                    <th className="text-right py-1 px-2">Y</th>
                    <th className="text-right py-1 px-2">Width</th>
                    <th className="text-right py-1 px-2">Height</th>
                    <th className="text-left py-1 pl-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {vc.bounds.map((b, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1 pr-2 text-text-primary">{b.Channel}</td>
                      <td className="text-right py-1 px-2 font-mono">{b.RelativeSourceBounds.X.toFixed(4)}</td>
                      <td className="text-right py-1 px-2 font-mono">{b.RelativeSourceBounds.Y.toFixed(4)}</td>
                      <td className="text-right py-1 px-2 font-mono">{b.RelativeSourceBounds.Width.toFixed(4)}</td>
                      <td className="text-right py-1 px-2 font-mono">{b.RelativeSourceBounds.Height.toFixed(4)}</td>
                      <td className="py-1 pl-2 text-text-muted">{b.SourceType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {cachedVideos.length > 0 && (
        <div className="glass p-6 space-y-3 mt-6">
          <h3 className="text-lg font-medium">Cached Videos</h3>
          <p className="text-xs text-text-muted">Videos downloaded for offline playback</p>
          {cachedVideos.map((entry) => (
            <div key={entry.url} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <span className="text-sm text-text-primary">{entry.label}</span>
                <span className="text-xs text-text-muted ml-2">{entry.sizeMB.toFixed(1)} MB</span>
              </div>
              <button
                onClick={async () => {
                  const cache = await caches.open('video-cache-v1');
                  await cache.delete(entry.url);
                  loadCachedVideos();
                }}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={async () => {
              await caches.delete('video-cache-v1');
              setCachedVideos([]);
            }}
            className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
