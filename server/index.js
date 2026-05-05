const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const eventsRouter = require('./routes/events');
const racesRouter = require('./routes/races');
const raceRouter = require('./routes/race');
const lapsRouter = require('./routes/laps');
const videoRouter = require('./routes/video');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const auditRouter = require('./routes/audit');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client-react', 'dist')));
app.use('/legacy', express.static(path.join(__dirname, '..', 'client')));

app.use('/api/auth', authRouter);
app.use('/api/audit', auditRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events', racesRouter);
app.use('/api/events', raceRouter);
app.use('/api/events', lapsRouter);
app.use('/api/video', videoRouter);
app.use('/api/settings', settingsRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client-react', 'dist', 'index.html'));
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`FPV Trackside DVR Review running on http://0.0.0.0:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
});
