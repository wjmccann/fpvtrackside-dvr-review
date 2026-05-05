import { useEffect, useState } from 'react';
import { api } from '../api';

interface AuditEntry {
  id: number;
  user_id: string;
  user_name: string;
  event_id: string;
  race_id: string;
  action: string;
  detection_id: string;
  before_value: string | null;
  after_value: string | null;
  timestamp: string;
  rolled_back: number;
}

const ACTION_LABELS: Record<string, string> = {
  add_lap: 'Added Lap',
  invalidate: 'Invalidated Lap',
  revalidate: 'Revalidated Lap',
  edit_time: 'Edited Time',
  delete_lap: 'Deleted Lap',
  rollback: 'Rollback',
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', userId: '' });

  useEffect(() => {
    loadEntries();
  }, [filter]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter.action) params.action = filter.action;
      if (filter.userId) params.userId = filter.userId;
      const data = await api.getAuditLog(params);
      setEntries(data);
    } catch {
      // auth might fail if not logged in
    }
    setLoading(false);
  };

  const handleRollback = async (id: number) => {
    if (!confirm('Are you sure you want to rollback this change?')) return;
    await api.rollback(id);
    loadEntries();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6">Audit Log</h2>

      {/* Filters */}
      <div className="glass p-4 mb-4 flex gap-4 flex-wrap">
        <select
          value={filter.action}
          onChange={(e) => setFilter({ ...filter, action: e.target.value })}
          className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border text-text-primary text-sm"
        >
          <option value="">All Actions</option>
          <option value="add_lap">Add Lap</option>
          <option value="invalidate">Invalidate</option>
          <option value="revalidate">Revalidate</option>
          <option value="edit_time">Edit Time</option>
          <option value="rollback">Rollback</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="glass p-8 text-center text-text-muted">No audit entries found</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`glass p-4 flex items-center justify-between ${entry.rolled_back ? 'opacity-50' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-primary">
                    {ACTION_LABELS[entry.action] || entry.action}
                  </span>
                  {entry.rolled_back === 1 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">Rolled Back</span>
                  )}
                </div>
                <div className="text-xs text-text-secondary">
                  by <span className="text-text-primary">{entry.user_name}</span>
                  {' • '}
                  {new Date(entry.timestamp).toLocaleString()}
                  {entry.race_id && <span className="text-text-muted"> • Race: {entry.race_id.slice(0, 8)}...</span>}
                </div>
                {entry.before_value && entry.after_value && (
                  <div className="mt-2 text-xs font-mono text-text-muted">
                    <span className="text-red-400">- {entry.before_value.slice(0, 80)}</span>
                    <br />
                    <span className="text-green-400">+ {entry.after_value.slice(0, 80)}</span>
                  </div>
                )}
              </div>
              {!entry.rolled_back && entry.action !== 'rollback' && entry.before_value && (
                <button
                  onClick={() => handleRollback(entry.id)}
                  className="ml-4 text-xs px-3 py-1.5 rounded bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
                >
                  Rollback
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
