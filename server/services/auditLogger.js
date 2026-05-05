const db = require('../db');

const insert = db.prepare(`
  INSERT INTO audit_log (user_id, user_name, event_id, race_id, action, detection_id, before_value, after_value, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function log({ user, eventId, raceId, action, detectionId, before, after }) {
  const userId = user ? user.id : 'system';
  const userName = user ? user.name : 'System';
  insert.run(
    userId,
    userName,
    eventId || null,
    raceId || null,
    action,
    detectionId || null,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    new Date().toISOString()
  );
}

function getForRace(raceId) {
  return db.prepare('SELECT * FROM audit_log WHERE race_id = ? ORDER BY timestamp DESC').all(raceId);
}

function getAll(filters = {}) {
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];

  if (filters.raceId) { sql += ' AND race_id = ?'; params.push(filters.raceId); }
  if (filters.userId) { sql += ' AND user_id = ?'; params.push(filters.userId); }
  if (filters.action) { sql += ' AND action = ?'; params.push(filters.action); }
  if (filters.from) { sql += ' AND timestamp >= ?'; params.push(filters.from); }
  if (filters.to) { sql += ' AND timestamp <= ?'; params.push(filters.to); }

  sql += ' ORDER BY timestamp DESC LIMIT 200';
  return db.prepare(sql).all(...params);
}

function getById(id) {
  return db.prepare('SELECT * FROM audit_log WHERE id = ?').get(id);
}

function markRolledBack(id) {
  db.prepare('UPDATE audit_log SET rolled_back = 1 WHERE id = ?').run(id);
}

module.exports = { log, getForRace, getAll, getById, markRolledBack };
