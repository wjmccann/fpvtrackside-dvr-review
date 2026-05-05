const express = require('express');
const router = express.Router();
const config = require('../config');
const dataReader = require('../services/dataReader');
const dataWriter = require('../services/dataWriter');
const { formatDate } = dataWriter;
const { v4: uuidv4 } = require('uuid');
const { authRequired } = require('../middleware/auth');
const auditLogger = require('../services/auditLogger');

function notifyTrackside() {
  if (!config.tracksideUrl) return;
  fetch(`${config.tracksideUrl}/api/refresh`, { method: 'POST' }).catch(() => {});
}

router.post('/:eventId/races/:raceId/laps', authRequired, async (req, res) => {
  try {
    const { eventId, raceId } = req.params;
    const { pilotId, time, lapNumber, timingSystemType } = req.body;
    const race = await dataReader.getRace(config.dataDir, eventId, raceId);

    const pilotChannel = race.PilotChannels.find(pc => pc.Pilot === pilotId);
    if (!pilotChannel) return res.status(400).json({ error: 'Pilot not in this race' });

    const pilotDetections = race.Detections
      .filter(d => d.Pilot === pilotId && d.Valid)
      .sort((a, b) => new Date(a.Time) - new Date(b.Time));

    const detLapNumber = lapNumber != null ? lapNumber
      : pilotDetections.length === 0 ? 0
      : Math.max(...pilotDetections.map(d => d.LapNumber)) + 1;

    const detectionId = uuidv4();
    const detection = {
      ID: detectionId,
      Pilot: pilotId,
      Channel: pilotChannel.Channel,
      Time: time,
      LapNumber: detLapNumber,
      TimingSystemIndex: 0,
      TimingSystemType: timingSystemType || 'Manual',
      IsLapEnd: true,
      Valid: true,
      ValidityType: 'ManualOverride',
      Peak: 0,
      RaceSector: (detLapNumber * 100),
      IsHoleshot: detLapNumber === 0,
    };

    const lastDetection = pilotDetections[pilotDetections.length - 1];
    const startTime = lastDetection ? lastDetection.Time : race.Start;
    const lengthSeconds = (new Date(time) - new Date(startTime)) / 1000;

    const lap = {
      ID: uuidv4(),
      Detection: detectionId,
      LapNumber: detLapNumber,
      StartTime: startTime,
      EndTime: time,
      LengthSeconds: lengthSeconds,
    };

    race.Detections.push(detection);
    race.Laps.push(lap);
    recalculateLaps(race, pilotId);
    await dataWriter.writeRace(config.dataDir, eventId, raceId, race);
    notifyTrackside();

    auditLogger.log({
      user: req.user, eventId, raceId, action: 'add_lap',
      detectionId: detection.ID, before: null, after: { detection, lap },
    });

    res.json({ detection, lap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:eventId/races/:raceId/laps/:detectionId', authRequired, async (req, res) => {
  try {
    const { eventId, raceId, detectionId } = req.params;
    const race = await dataReader.getRace(config.dataDir, eventId, raceId);

    const detection = race.Detections.find(d => d.ID === detectionId);
    if (!detection) return res.status(404).json({ error: 'Detection not found' });

    const before = { Valid: detection.Valid, ValidityType: detection.ValidityType };
    detection.Valid = false;
    detection.ValidityType = 'ManualOverride';
    recalculateLaps(race, detection.Pilot);
    await dataWriter.writeRace(config.dataDir, eventId, raceId, race);
    notifyTrackside();

    auditLogger.log({
      user: req.user, eventId, raceId, action: 'invalidate',
      detectionId, before, after: { Valid: false, ValidityType: 'ManualOverride' },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:eventId/races/:raceId/laps/:detectionId', authRequired, async (req, res) => {
  try {
    const { eventId, raceId, detectionId } = req.params;
    const race = await dataReader.getRace(config.dataDir, eventId, raceId);

    const detection = race.Detections.find(d => d.ID === detectionId);
    if (!detection) return res.status(404).json({ error: 'Detection not found' });

    const before = { Valid: detection.Valid, ValidityType: detection.ValidityType };
    if (req.body.valid !== undefined) {
      detection.Valid = req.body.valid;
      detection.ValidityType = 'ManualOverride';
    }
    recalculateLaps(race, detection.Pilot);
    await dataWriter.writeRace(config.dataDir, eventId, raceId, race);
    notifyTrackside();

    auditLogger.log({
      user: req.user, eventId, raceId, action: 'revalidate',
      detectionId, before, after: { Valid: detection.Valid, ValidityType: 'ManualOverride' },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:eventId/races/:raceId/laps/:detectionId', authRequired, async (req, res) => {
  try {
    const { eventId, raceId, detectionId } = req.params;
    const race = await dataReader.getRace(config.dataDir, eventId, raceId);

    const detection = race.Detections.find(d => d.ID === detectionId);
    if (!detection) return res.status(404).json({ error: 'Detection not found' });

    const before = { Time: detection.Time, ValidityType: detection.ValidityType };
    detection.Time = req.body.time;
    detection.ValidityType = 'ManualOverride';

    const lap = race.Laps.find(l => l.Detection === detectionId);
    if (lap) lap.EndTime = req.body.time;

    recalculateLaps(race, detection.Pilot);
    await dataWriter.writeRace(config.dataDir, eventId, raceId, race);
    notifyTrackside();

    auditLogger.log({
      user: req.user, eventId, raceId, action: 'edit_time',
      detectionId, before, after: { Time: req.body.time, ValidityType: 'ManualOverride' },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function recalculateLaps(race, pilotId) {
  const detections = race.Detections
    .filter(d => d.Pilot === pilotId && d.Valid)
    .sort((a, b) => new Date(a.Time) - new Date(b.Time));

  let lapNumber = 0;
  let hasHadHoleshot = (race.PrimaryTimingSystemLocation === 'EndOfLap');

  for (const d of detections) {
    if (d.IsLapEnd && hasHadHoleshot) {
      lapNumber++;
    }
    d.LapNumber = lapNumber;
    d.RaceSector = (lapNumber * 100) + d.TimingSystemIndex;
    d.IsHoleshot = d.Valid && d.IsLapEnd && lapNumber === 0;
    if (d.IsLapEnd) {
      hasHadHoleshot = true;
    }
  }

  const laps = race.Laps
    .filter(l => {
      const det = race.Detections.find(d => d.ID === l.Detection);
      return det && det.Pilot === pilotId && det.Valid;
    })
    .sort((a, b) => new Date(a.EndTime) - new Date(b.EndTime));

  let lapStart = new Date(race.Start);
  for (const lap of laps) {
    lap.StartTime = formatDate(lapStart);
    const endTime = new Date(lap.EndTime);
    lap.LengthSeconds = (endTime - lapStart) / 1000;
    lapStart = endTime;

    const det = race.Detections.find(d => d.ID === lap.Detection);
    if (det) {
      lap.LapNumber = det.LapNumber;
    }
  }
}

module.exports = router;
