const express = require('express');
const router = express.Router();
const config = require('../config');
const dataReader = require('../services/dataReader');

router.get('/', async (req, res) => {
  try {
    const events = await dataReader.listEvents(config.dataDir);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId', async (req, res) => {
  try {
    const event = await dataReader.getEvent(config.dataDir, req.params.eventId);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId/pilots', async (req, res) => {
  try {
    const pilots = await dataReader.getPilots(config.dataDir, req.params.eventId);
    res.json(pilots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:eventId/rounds', async (req, res) => {
  try {
    const rounds = await dataReader.getRounds(config.dataDir, req.params.eventId);
    res.json(rounds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
