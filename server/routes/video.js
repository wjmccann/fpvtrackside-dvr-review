const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const videoServer = require('../services/videoServer');

router.post('/:eventId/:raceId/transcode', async (req, res) => {
  try {
    const { eventId, raceId } = req.params;
    const job = await videoServer.startTranscode(config.dataDir, eventId, raceId);
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId/:raceId/transcode-status', async (req, res) => {
  try {
    const { eventId, raceId } = req.params;
    res.json(videoServer.getTranscodeStatus(eventId, raceId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId/:raceId/:filename', async (req, res) => {
  try {
    const { eventId, raceId, filename } = req.params;
    const format = req.query.format;
    let filePath = path.join(config.dataDir, eventId, raceId, filename);

    // Also check FPVTrackside root-relative path (events/eventId/raceId/filename)
    if (!fs.existsSync(filePath)) {
      const rootRelative = path.join(config.dataDir, '..', 'events', eventId, raceId, filename);
      if (fs.existsSync(rootRelative)) {
        filePath = rootRelative;
      } else {
        return res.status(404).json({ error: 'Video file not found' });
      }
    }

    if (format === 'mp4') {
      await videoServer.streamTranscoded(filePath, config.dataDir, eventId, raceId, filename, req, res);
    } else {
      await videoServer.streamDirect(filePath, req, res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
