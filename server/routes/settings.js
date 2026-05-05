const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', (req, res) => {
  res.json({
    dataDir: config.dataDir,
    tracksideUrl: config.tracksideUrl,
    ffmpegPath: config.ffmpegPath,
  });
});

router.put('/', (req, res) => {
  const { dataDir, tracksideUrl, ffmpegPath } = req.body;
  const updates = {};
  if (dataDir !== undefined) updates.dataDir = dataDir;
  if (tracksideUrl !== undefined) updates.tracksideUrl = tracksideUrl;
  if (ffmpegPath !== undefined) updates.ffmpegPath = ffmpegPath;

  config.save(updates);
  res.json({ success: true, dataDir: config.dataDir, tracksideUrl: config.tracksideUrl, ffmpegPath: config.ffmpegPath });
});

module.exports = router;
