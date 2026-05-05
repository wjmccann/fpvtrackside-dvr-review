const express = require('express');
const router = express.Router();
const config = require('../config');
const dataReader = require('../services/dataReader');

router.get('/:eventId/races', async (req, res) => {
  try {
    const races = await dataReader.getRaces(config.dataDir, req.params.eventId);
    res.json(races);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
