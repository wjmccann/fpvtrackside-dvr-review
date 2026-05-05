import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({ dataDir: '', tracksideUrl: '', ffmpegPath: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

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
    </div>
  );
}
