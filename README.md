# FPV Trackside DVR Review

A companion web app for [FPV Trackside](https://fpvtrackside.com) that lets race directors and pilots review DVR footage synchronized with race data.

## Features

- **Event Browser** — Browse events from your FPV Trackside data directory, sorted by most recently opened
- **Race Review** — Watch DVR recordings alongside lap data with synchronized playback
- **Video Player** — Stream MKV/MP4/AVI/WebM files with seek bar and record-info metadata
- **Lap Table** — View lap times, positions, and pilot information for each race
- **Audit Log** — Track review activity with a built-in audit trail
- **Authentication** — JWT-based login to restrict access
- **Configurable** — Settings UI to point at your FPV Trackside data directory, configure ffmpeg path, and more

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [FFmpeg](https://ffmpeg.org/) (for video streaming/transcoding)
- FPV Trackside event data (typically located at `%LOCALAPPDATA%\FPVTrackside\events`)

## Installation

```bash
git clone https://github.com/wjmccann/fpvtrackside-dvr-review.git
cd fpvtrackside-dvr-review
npm install
```

## Usage

```bash
npm start
```

The app will be available at `http://localhost:3000`.

### Development

```bash
npm run dev
```

This starts the server with file watching enabled for automatic restarts.

## Configuration

Configuration can be set via environment variables, the Settings page in the UI, or a `server/settings.json` file:

| Setting | Env Variable | Default |
|---------|-------------|---------|
| Data directory | `FPVTRACKSIDE_DATA_DIR` | `%LOCALAPPDATA%\FPVTrackside\events` |
| Port | `PORT` | `3000` |
| Trackside URL | `TRACKSIDE_URL` | `http://localhost:8080` |
| FFmpeg path | `FFMPEG_PATH` | `ffmpeg` |

## Tech Stack

- **Backend** — Node.js, Express, better-sqlite3
- **Frontend** — React, TypeScript, Vite
- **Auth** — bcryptjs, JSON Web Tokens

## License

MIT
