const fs = require('fs').promises;
const path = require('path');
const { parseRecordInfo } = require('./videoServer');

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listEvents(dataDir) {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  const events = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !GUID_REGEX.test(entry.name)) continue;
    const eventPath = path.join(dataDir, entry.name, 'Event.json');
    try {
      const data = JSON.parse(await fs.readFile(eventPath, 'utf-8'));
      const evt = Array.isArray(data) ? data[0] : data;
      events.push({
        ID: evt.ID,
        Name: evt.Name,
        EventType: evt.EventType,
        Start: evt.Start,
        End: evt.End,
        LastOpened: evt.LastOpened,
        Enabled: evt.Enabled,
        PilotsRegistered: evt.PilotsRegistered,
        RaceCount: evt.Races ? evt.Races.length : 0,
      });
    } catch {
      // skip directories without valid Event.json
    }
  }

  events.sort((a, b) => {
    const da = a.LastOpened ? new Date(a.LastOpened) : new Date(0);
    const db = b.LastOpened ? new Date(b.LastOpened) : new Date(0);
    return db - da;
  });

  return events;
}

async function getEvent(dataDir, eventId) {
  const eventPath = path.join(dataDir, eventId, 'Event.json');
  const data = JSON.parse(await fs.readFile(eventPath, 'utf-8'));
  return Array.isArray(data) ? data[0] : data;
}

async function getRaces(dataDir, eventId) {
  const event = await getEvent(dataDir, eventId);
  const races = [];

  if (!event.Races) return races;

  for (const raceId of event.Races) {
    try {
      const race = await getRace(dataDir, eventId, raceId);
      races.push(race);
    } catch {
      // skip races whose Race.json is missing
    }
  }

  return races;
}

async function getRace(dataDir, eventId, raceId) {
  const racePath = path.join(dataDir, eventId, raceId, 'Race.json');
  const data = JSON.parse(await fs.readFile(racePath, 'utf-8'));
  return Array.isArray(data) ? data[0] : data;
}

async function getPilots(dataDir, eventId) {
  const pilotsPath = path.join(dataDir, eventId, 'Pilots.json');
  return JSON.parse(await fs.readFile(pilotsPath, 'utf-8'));
}

async function getRounds(dataDir, eventId) {
  const roundsPath = path.join(dataDir, eventId, 'Rounds.json');
  return JSON.parse(await fs.readFile(roundsPath, 'utf-8'));
}

async function getVideoFiles(dataDir, eventId, raceId) {
  const raceDir = path.join(dataDir, eventId, raceId);
  const entries = await fs.readdir(raceDir);
  const videos = [];

  const videoFiles = entries.filter(f => /\.(mkv|mp4|avi|webm)$/i.test(f));
  const infoFiles = entries.filter(f => f.toLowerCase().endsWith('.recordinfo.xml'));

  for (const vf of videoFiles) {
    const video = { filename: vf, url: `/api/video/${eventId}/${raceId}/${vf}` };
    const matchingInfo = infoFiles.find(f =>
      f === vf + '.recordinfo.xml' ||
      f === vf.replace(/\.[^.]+$/, '.recordinfo.xml') ||
      f === vf.replace(/\.[^.]+$/, '') + '.' + vf.split('.').pop() + '.recordinfo.xml'
    );
    if (matchingInfo) {
      try {
        video.recordInfo = await parseRecordInfo(path.join(raceDir, matchingInfo));
      } catch { /* ignore */ }
    }
    videos.push(video);
  }

  // Check recordinfo files that reference videos via relative path
  for (const inf of infoFiles) {
    try {
      const info = await parseRecordInfo(path.join(raceDir, inf));
      if (info.filePath) {
        const basename = path.basename(info.filePath);
        const existing = videos.find(v => v.filename === basename);
        if (existing) {
          if (!existing.recordInfo) existing.recordInfo = info;
          continue;
        }
        // Video file not in raceDir — check FPVTrackside root-relative path
        const fullPath = path.join(dataDir, '..', info.filePath);
        try {
          await fs.access(fullPath);
          videos.push({
            filename: basename,
            url: `/api/video/${eventId}/${raceId}/${basename}`,
            actualPath: fullPath,
            recordInfo: info,
          });
        } catch { /* file doesn't exist */ }
      }
    } catch { /* ignore */ }
  }

  return videos;
}

module.exports = { listEvents, getEvent, getRaces, getRace, getPilots, getRounds, getVideoFiles };
