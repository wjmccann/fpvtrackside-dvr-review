const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');

function parseXmlSimple(xml, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const matches = [];
  let m;
  while ((m = regex.exec(xml)) !== null) matches.push(m[1].trim());
  return matches;
}

function parseXmlAttr(xml, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = regex.exec(xml);
  return m ? m[1].trim() : null;
}

async function parseRecordInfo(xmlPath) {
  const xml = await fsPromises.readFile(xmlPath, 'utf-8');

  const filePath = parseXmlAttr(xml, 'FilePath');
  const deviceLatency = parseFloat(parseXmlAttr(xml, 'DeviceLatency') || '0');

  const frameTimes = [];
  const ftBlocks = parseXmlSimple(xml, 'FrameTime');
  for (const block of ftBlocks) {
    frameTimes.push({
      Frame: parseInt(parseXmlAttr(block, 'Frame') || '0'),
      Time: parseXmlAttr(block, 'Time'),
      Seconds: parseFloat(parseXmlAttr(block, 'Seconds') || '0'),
    });
  }

  const channelBounds = [];
  const vbBlocks = parseXmlSimple(xml, 'VideoBounds');
  for (const block of vbBlocks) {
    channelBounds.push({
      Channel: parseXmlAttr(block, 'Channel'),
      SourceType: parseXmlAttr(block, 'SourceType'),
      ShowInGrid: parseXmlAttr(block, 'ShowInGrid') === 'true',
      Crop: parseXmlAttr(block, 'Crop') === 'true',
      RelativeSourceBounds: {
        X: parseFloat(parseXmlAttr(block, 'X') || '0'),
        Y: parseFloat(parseXmlAttr(block, 'Y') || '0'),
        Width: parseFloat(parseXmlAttr(block, 'Width') || '1'),
        Height: parseFloat(parseXmlAttr(block, 'Height') || '1'),
      },
    });
  }

  const firstFrame = parseXmlAttr(xml, 'FirstFrame');

  return { filePath, deviceLatency, frameTimes, channelBounds, firstFrame };
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  return 'video/x-matroska';
}

async function streamDirect(filePath, req, res) {
  const stat = await fsPromises.stat(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getContentType(filePath);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

async function streamTranscoded(filePath, dataDir, eventId, raceId, filename, req, res) {
  const mp4Name = filename.replace(/\.mkv$/i, '.mp4');
  const mp4Path = path.join(dataDir, eventId, raceId, mp4Name);

  try {
    await fsPromises.access(mp4Path);
    const stat = await fsPromises.stat(mp4Path);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(mp4Path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(mp4Path).pipe(res);
    }
    return;
  } catch {
    // no cached mp4, transcode
  }

  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Transfer-Encoding': 'chunked' });

  const ffmpeg = spawn(config.ffmpegPath, [
    '-i', filePath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-movflags', '+faststart+frag_keyframe+empty_moov',
    '-f', 'mp4',
    'pipe:1',
  ]);

  ffmpeg.stdout.pipe(res);
  ffmpeg.stderr.on('data', () => {});
  ffmpeg.on('error', () => res.end());

  // Also save to cache file in background
  const cacheStream = fs.createWriteStream(mp4Path + '.tmp');
  ffmpeg.stdout.pipe(cacheStream);
  ffmpeg.on('close', async (code) => {
    if (code === 0) {
      try {
        await fsPromises.rename(mp4Path + '.tmp', mp4Path);
      } catch { /* ignore */ }
    } else {
      try { await fsPromises.unlink(mp4Path + '.tmp'); } catch { /* ignore */ }
    }
  });
}

// Track active transcode jobs: key = `${eventId}/${raceId}`, value = { status, progress, error }
const transcodeJobs = new Map();

function transcodeKey(eventId, raceId) {
  return `${eventId}/${raceId}`;
}

async function startTranscode(dataDir, eventId, raceId) {
  const key = transcodeKey(eventId, raceId);
  const existing = transcodeJobs.get(key);
  if (existing && existing.status === 'running') return existing;

  const raceDir = path.join(dataDir, eventId, raceId);
  const entries = await fsPromises.readdir(raceDir);
  const mkvFiles = entries.filter(f => /\.mkv$/i.test(f));

  if (mkvFiles.length === 0) {
    const job = { status: 'done', progress: 100, total: 0, completed: 0, error: null };
    transcodeJobs.set(key, job);
    return job;
  }

  const job = { status: 'running', progress: 0, total: mkvFiles.length, completed: 0, error: null };
  transcodeJobs.set(key, job);

  (async () => {
    for (const mkv of mkvFiles) {
      const inputPath = path.join(raceDir, mkv);
      const outputName = mkv.replace(/\.mkv$/i, '_1080p.mp4');
      const outputPath = path.join(raceDir, outputName);
      const tmpPath = outputPath + '.tmp';

      try {
        await fsPromises.access(outputPath);
        job.completed++;
        job.progress = Math.round((job.completed / job.total) * 100);
        continue;
      } catch { /* needs transcoding */ }

      try {
        await new Promise((resolve, reject) => {
          const proc = spawn(config.ffmpegPath, [
            '-i', inputPath,
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'fast',
            '-vf', 'scale=-2:1080',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            '-y',
            tmpPath,
          ]);
          proc.stderr.on('data', () => {});
          proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
          proc.on('error', reject);
        });
        await fsPromises.rename(tmpPath, outputPath);
      } catch (err) {
        try { await fsPromises.unlink(tmpPath); } catch { /* ignore */ }
        job.status = 'error';
        job.error = `Failed to transcode ${mkv}: ${err.message}`;
        transcodeJobs.set(key, job);
        return;
      }

      job.completed++;
      job.progress = Math.round((job.completed / job.total) * 100);
    }

    job.status = 'done';
    job.progress = 100;
  })();

  return job;
}

function getTranscodeStatus(eventId, raceId) {
  return transcodeJobs.get(transcodeKey(eventId, raceId)) || { status: 'idle', progress: 0, total: 0, completed: 0, error: null };
}

module.exports = { streamDirect, streamTranscoded, parseRecordInfo, startTranscode, getTranscodeStatus };
