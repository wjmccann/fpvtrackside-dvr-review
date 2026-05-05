const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const config = require('../config');

router.get('/', async (req, res) => {
  const { existsSync } = require('fs');
  const valid = existsSync(config.dataDir);
  res.json({
    dataDir: config.dataDir,
    tracksideUrl: config.tracksideUrl,
    ffmpegPath: config.ffmpegPath,
    dataDirValid: valid,
    activeVideoConfig: config.activeVideoConfig || 0,
  });
});

router.put('/', (req, res) => {
  const { dataDir, tracksideUrl, ffmpegPath, activeVideoConfig } = req.body;
  const updates = {};
  if (dataDir !== undefined) updates.dataDir = dataDir;
  if (tracksideUrl !== undefined) updates.tracksideUrl = tracksideUrl;
  if (ffmpegPath !== undefined) updates.ffmpegPath = ffmpegPath;
  if (activeVideoConfig !== undefined) updates.activeVideoConfig = activeVideoConfig;

  config.save(updates);
  res.json({ success: true, dataDir: config.dataDir, tracksideUrl: config.tracksideUrl, ffmpegPath: config.ffmpegPath, activeVideoConfig: config.activeVideoConfig });
});

router.get('/video-config', async (req, res) => {
  try {
    const candidates = [
      path.join(config.dataDir, '..', 'data', 'VideoSettings.xml'),
      path.join(process.env.LOCALAPPDATA || '', 'FPVTrackside', 'data', 'VideoSettings.xml'),
    ];
    let xml;
    for (const candidate of candidates) {
      try {
        xml = await fs.readFile(candidate, 'utf-8');
        break;
      } catch { /* try next */ }
    }
    if (!xml) throw new Error('VideoSettings.xml not found in any known location');

    const configs = [];
    const configBlocks = xml.split('<VideoConfig>').slice(1);
    for (const block of configBlocks) {
      const getName = (tag) => {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        return m ? m[1].trim() : null;
      };
      const deviceName = getName('DeviceName');
      const splits = getName('Splits');

      const bounds = [];
      const vbOuter = block.match(/<VideoBounds>([\s\S]*?)<\/VideoBounds>\s*<\/VideoConfig>/);
      if (vbOuter) {
        const inner = vbOuter[1];
        const entries = inner.split('<VideoBounds>').slice(1);
        for (const entry of entries) {
          const get = (tag) => {
            const m = entry.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
            return m ? m[1].trim() : null;
          };
          bounds.push({
            Channel: get('Channel'),
            SourceType: get('SourceType'),
            RelativeSourceBounds: {
              X: parseFloat(get('X') || '0'),
              Y: parseFloat(get('Y') || '0'),
              Width: parseFloat(get('Width') || '1'),
              Height: parseFloat(get('Height') || '1'),
            },
          });
        }
      }

      configs.push({ deviceName, splits, bounds });
    }

    res.json(configs);
  } catch (err) {
    res.status(404).json({ error: 'VideoSettings.xml not found', detail: err.message });
  }
});

module.exports = router;
