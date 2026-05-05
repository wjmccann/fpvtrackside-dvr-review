const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const auditLogger = require('../services/auditLogger');
const dataReader = require('../services/dataReader');
const dataWriter = require('../services/dataWriter');
const config = require('../config');

router.get('/', authRequired, (req, res) => {
  try {
    const entries = auditLogger.getAll(req.query);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/race/:raceId', authRequired, (req, res) => {
  try {
    const entries = auditLogger.getForRace(req.params.raceId);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/rollback', authRequired, async (req, res) => {
  try {
    const entry = auditLogger.getById(parseInt(req.params.id));
    if (!entry) return res.status(404).json({ error: 'Audit entry not found' });
    if (entry.rolled_back) return res.status(400).json({ error: 'Already rolled back' });
    if (!entry.before_value) return res.status(400).json({ error: 'No previous state to restore' });

    const before = JSON.parse(entry.before_value);
    const race = await dataReader.getRace(config.dataDir, entry.event_id, entry.race_id);

    if (entry.action === 'add_lap') {
      const det = race.Detections.find(d => d.ID === entry.detection_id);
      if (det) det.Valid = false;
      race.Laps = race.Laps.filter(l => l.Detection !== entry.detection_id);
    } else if (entry.action === 'invalidate' || entry.action === 'delete_lap') {
      const det = race.Detections.find(d => d.ID === entry.detection_id);
      if (det) {
        det.Valid = before.Valid;
        det.ValidityType = before.ValidityType;
      }
    } else if (entry.action === 'revalidate') {
      const det = race.Detections.find(d => d.ID === entry.detection_id);
      if (det) {
        det.Valid = before.Valid;
        det.ValidityType = before.ValidityType;
      }
    } else if (entry.action === 'edit_time') {
      const det = race.Detections.find(d => d.ID === entry.detection_id);
      if (det) det.Time = before.Time;
      const lap = race.Laps.find(l => l.Detection === entry.detection_id);
      if (lap) lap.EndTime = before.Time;
    }

    await dataWriter.writeRace(config.dataDir, entry.event_id, entry.race_id, race);
    auditLogger.markRolledBack(entry.id);

    auditLogger.log({
      user: req.user,
      eventId: entry.event_id,
      raceId: entry.race_id,
      action: 'rollback',
      detectionId: entry.detection_id,
      before: JSON.parse(entry.after_value || '{}'),
      after: before,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
