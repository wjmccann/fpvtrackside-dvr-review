const fs = require('fs').promises;
const path = require('path');

const writeQueue = new Map();

const FPVTS_DATE_RE = /^\d{4}\/\d{2}\/\d{2} \d{1,2}:\d{2}:\d{2}\.\d+$/;

function formatDate(date) {
  if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return date;
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = date.getHours();
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = date.getMilliseconds();
  const msStr = ms === 0 ? '0' : String(ms).replace(/0+$/, '');
  return `${y}/${mo}/${d} ${h}:${mi}:${s}.${msStr}`;
}

const DATE_FIELDS = new Set([
  'Start', 'End', 'Time', 'StartTime', 'EndTime', 'LastOpened',
]);

function dateReplacer(key, value) {
  if (DATE_FIELDS.has(key) && typeof value === 'string') {
    if (FPVTS_DATE_RE.test(value)) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return formatDate(d);
  }
  return value;
}

async function writeRace(dataDir, eventId, raceId, raceData) {
  const racePath = path.join(dataDir, eventId, raceId, 'Race.json');

  const queueKey = racePath;
  const prev = writeQueue.get(queueKey) || Promise.resolve();
  const task = prev.then(async () => {
    const backupPath = racePath + '.bak.' + Date.now();
    await fs.copyFile(racePath, backupPath);

    let json = JSON.stringify([raceData], dateReplacer, 2);
    // Preserve 0.0 for LengthSeconds (C# serializes as 0.0, JS as 0)
    json = json.replace(/"LengthSeconds": 0([,\r\n])/g, '"LengthSeconds": 0.0$1');
    json = json.replace(/\n/g, '\r\n');
    const tmpPath = racePath + '.tmp';
    await fs.writeFile(tmpPath, json, 'utf-8');
    await fs.rename(tmpPath, racePath);
  });

  writeQueue.set(queueKey, task);
  return task;
}

module.exports = { writeRace, formatDate };
