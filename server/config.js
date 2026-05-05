const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, 'settings.json');

const defaults = {
  dataDir: path.join('C:', 'Users', 'willi', 'AppData', 'Local', 'FPVTrackside', 'events'),
  port: 3000,
  tracksideUrl: 'http://localhost:8080',
  ffmpegPath: 'ffmpeg',
};

function loadSaved() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function buildConfig() {
  const saved = loadSaved();
  return {
    dataDir: process.env.FPVTRACKSIDE_DATA_DIR || saved.dataDir || defaults.dataDir,
    port: parseInt(process.env.PORT, 10) || saved.port || defaults.port,
    tracksideUrl: process.env.TRACKSIDE_URL || saved.tracksideUrl || defaults.tracksideUrl,
    ffmpegPath: process.env.FFMPEG_PATH || saved.ffmpegPath || defaults.ffmpegPath,
  };
}

const config = buildConfig();

config.save = function (updates) {
  const saved = loadSaved();
  Object.assign(saved, updates);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(saved, null, 2));
  Object.assign(config, buildConfig());
};

config.CONFIG_FILE = CONFIG_FILE;

module.exports = config;
