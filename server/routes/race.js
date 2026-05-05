const express = require('express');
const router = express.Router();
const config = require('../config');
const dataReader = require('../services/dataReader');

router.get('/:eventId/races/:raceId', async (req, res) => {
  try {
    const race = await dataReader.getRace(config.dataDir, req.params.eventId, req.params.raceId);
    res.json(race);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId/races/:raceId/videos', async (req, res) => {
  try {
    const videos = await dataReader.getVideoFiles(config.dataDir, req.params.eventId, req.params.raceId);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
