class RaceReplay {
  constructor(container, options = {}) {
    this.container = container;
    this.eventId = options.eventId;
    this.raceId = options.raceId;
    this.event = options.event;
    this.pilots = options.pilots;
    this.rounds = options.rounds || [];
    this.race = options.race;
    this.onBack = options.onBack || (() => {});
    this.onRaceUpdated = options.onRaceUpdated || (() => {});

    this.videos = [];
    this.videoElements = [];
    this.videoCells = [];
    this.playing = false;
    this.slowMotion = false;
    this.seekBar = null;
    this.lapEditor = null;
    this.videoGrid = null;
    this.raceStartMs = 0;
    this.raceEndMs = 0;
    this.timelineStartMs = 0;
    this.timelineEndMs = 0;
    this.undoStack = [];
    this.focusedPilotId = null;
    this.detectionMarkers = [];
  }

  async load() {
    this.container.innerHTML = '';
    this.race = await api.getRace(this.eventId, this.raceId);
    this.raceStartMs = new Date(this.race.Start.replace(/\//g, '-')).getTime();
    this.raceEndMs = this.race.End ? new Date(this.race.End.replace(/\//g, '-')).getTime() : this.raceStartMs + 300000;

    const videoData = await api.getVideos(this.eventId, this.raceId);
    this.videos = videoData;

    this.renderHeader();
    this.renderVideoGrid();
    this.renderPlaybackControls();
    this.renderSeekBar();
    this.renderLapEditor();
    this.setupKeyboard();
  }

  renderHeader() {
    const header = document.createElement('div');
    header.className = 'race-header';

    const left = document.createElement('div');
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.cleanup() || this.onBack());
    left.appendChild(backBtn);

    const title = document.createElement('h2');
    const round = this.rounds.find(r => r.ID === this.race.Round);
    const roundLabel = round ? `Round ${round.RoundNumber}` : '';
    const eventName = this.event.Name || '';
    const parts = [eventName, roundLabel, `Race ${this.race.RaceNumber || '?'}`].filter(Boolean);
    title.textContent = parts.join(' — ');
    left.appendChild(title);

    header.appendChild(left);
    this.container.appendChild(header);
  }

  renderVideoGrid() {
    this.videoGrid = document.createElement('div');
    this.videoGrid.className = 'video-grid';

    const pilotChannels = this.race.PilotChannels || [];

    for (const pc of pilotChannels) {
      const pilot = this.pilots.find(p => p.ID === pc.Pilot);
      const pilotName = pilot ? pilot.Name : 'Unknown';
      const card = PilotCard.create(pilot || { Name: pilotName }, pc.Channel, this.event);

      const cell = document.createElement('div');
      cell.className = 'video-cell';
      cell.style.borderColor = card.color;
      cell.dataset.pilotId = pc.Pilot;

      const label = document.createElement('div');
      label.className = 'pilot-label';
      label.style.color = card.color;
      const chIdx = this.event.Channels ? this.event.Channels.indexOf(pc.Channel) : -1;
      const chDisplay = (this.event.ChannelDisplayNames && chIdx >= 0) ? this.event.ChannelDisplayNames[chIdx] : card.channelInfo.displayName;
      label.textContent = `${pilotName} (${chDisplay}, ${card.channelInfo.frequency}MHz)`;
      label.style.cursor = 'pointer';
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePilotFocus(pc.Pilot);
      });
      cell.appendChild(label);

      const matchingVideo = this.findVideoForChannel(pc.Channel);
      if (matchingVideo) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.src = matchingVideo.url;
        video.addEventListener('click', () => this.togglePlayPause());
        this.setupTouchControls(video);

        const bounds = this.getChannelBounds(matchingVideo, pc.Channel);
        if (bounds) {
          const pctX = bounds.X * 100;
          const pctY = bounds.Y * 100;
          const pctW = bounds.Width * 100;
          const pctH = bounds.Height * 100;
          video.style.objectFit = 'cover';
          video.style.objectPosition = `${pctX + pctW/2}% ${pctY + pctH/2}%`;
          video.style.clipPath = `inset(${pctY}% ${100-pctX-pctW}% ${100-pctY-pctH}% ${pctX}%)`;
        }
        this.videoElements.push({ element: video, videoData: matchingVideo, pilotId: pc.Pilot, channelId: pc.Channel, bounds });

        cell.appendChild(video);
      } else {
        const noVid = document.createElement('div');
        noVid.className = 'no-video';
        noVid.textContent = 'No video';
        cell.appendChild(noVid);
      }

      const addOverlay = document.createElement('button');
      addOverlay.className = 'video-add-lap';
      addOverlay.textContent = '+';
      addOverlay.title = `Add lap for ${pilotName}`;
      addOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addLapFromCurrentPosition(pc.Pilot);
      });
      cell.appendChild(addOverlay);

      this.videoCells.push({ element: cell, pilotId: pc.Pilot });
      this.videoGrid.appendChild(cell);
    }

    this.container.appendChild(this.videoGrid);
    this.computeTimeline();
  }

  togglePilotFocus(pilotId) {
    if (this.focusedPilotId === pilotId) {
      this.focusedPilotId = null;
    } else {
      this.focusedPilotId = pilotId;
    }
    this.applyPilotFocus();
  }

  applyPilotFocus() {
    const focused = this.focusedPilotId;
    for (const vc of this.videoCells) {
      if (!focused) {
        vc.element.classList.remove('focused', 'dimmed');
      } else if (vc.pilotId === focused) {
        vc.element.classList.add('focused');
        vc.element.classList.remove('dimmed');
      } else {
        vc.element.classList.add('dimmed');
        vc.element.classList.remove('focused');
      }
    }
    // Focus pilot lap section
    const lapSections = this.container.querySelectorAll('.pilot-laps');
    lapSections.forEach(section => {
      if (!focused) {
        section.classList.remove('focused-pilot', 'dimmed-pilot');
      } else if (section.dataset.pilotId === focused) {
        section.classList.add('focused-pilot');
        section.classList.remove('dimmed-pilot');
      } else {
        section.classList.add('dimmed-pilot');
        section.classList.remove('focused-pilot');
      }
    });
  }

  findVideoForChannel(channelId) {
    for (const v of this.videos) {
      if (v.recordInfo && v.recordInfo.channelBounds) {
        for (const cb of v.recordInfo.channelBounds) {
          const resolvedGuid = PilotCard.resolveChannelName(cb.Channel);
          if (cb.Channel === channelId || resolvedGuid === channelId) return v;
        }
      }
    }
    return this.videos.length > 0 ? this.videos[0] : null;
  }

  getChannelBounds(videoData, channelId) {
    if (!videoData.recordInfo || !videoData.recordInfo.channelBounds) return null;
    const cb = videoData.recordInfo.channelBounds.find(b => b.Channel === channelId);
    if (cb && cb.RelativeSourceBounds && (cb.RelativeSourceBounds.Width < 1 || cb.RelativeSourceBounds.Height < 1)) {
      return cb.RelativeSourceBounds;
    }
    return null;
  }

  computeTimeline() {
    let minStart = this.raceStartMs - 5000;
    let maxEnd = this.raceEndMs + 5000;

    for (const v of this.videoElements) {
      if (v.videoData.recordInfo && v.videoData.recordInfo.frameTimes && v.videoData.recordInfo.frameTimes.length > 0) {
        const ft = v.videoData.recordInfo.frameTimes;
        const firstWall = new Date(ft[0].Time).getTime();
        const startWall = firstWall - ft[0].Seconds * 1000;
        if (startWall < minStart) minStart = startWall;
      }
    }

    this.timelineStartMs = minStart;
    this.timelineEndMs = maxEnd;
  }

  mediaTimeToWallClock(videoData, mediaSeconds) {
    if (!videoData.recordInfo || !videoData.recordInfo.frameTimes || videoData.recordInfo.frameTimes.length === 0) {
      return this.raceStartMs + mediaSeconds * 1000;
    }
    const ft = videoData.recordInfo.frameTimes;
    const deviceLatency = videoData.recordInfo.deviceLatency || 0;
    let closest = ft[0];
    let closestDist = Math.abs(ft[0].Seconds - mediaSeconds);
    for (let i = 1; i < ft.length; i++) {
      const dist = Math.abs(ft[i].Seconds - mediaSeconds);
      if (dist < closestDist) { closest = ft[i]; closestDist = dist; }
    }
    const diff = mediaSeconds - closest.Seconds;
    return new Date(closest.Time).getTime() + diff * 1000 - deviceLatency * 1000;
  }

  wallClockToMediaTime(videoData, wallClockMs) {
    if (!videoData.recordInfo || !videoData.recordInfo.frameTimes || videoData.recordInfo.frameTimes.length === 0) {
      return (wallClockMs - this.raceStartMs) / 1000;
    }
    const ft = videoData.recordInfo.frameTimes;
    const deviceLatency = videoData.recordInfo.deviceLatency || 0;
    let closest = ft[0];
    let closestDist = Math.abs(new Date(ft[0].Time).getTime() - wallClockMs);
    for (let i = 1; i < ft.length; i++) {
      const dist = Math.abs(new Date(ft[i].Time).getTime() - wallClockMs);
      if (dist < closestDist) { closest = ft[i]; closestDist = dist; }
    }
    const diffMs = wallClockMs - new Date(closest.Time).getTime();
    return closest.Seconds + diffMs / 1000 + deviceLatency;
  }

  seekToWallClock(wallClockMs) {
    for (const v of this.videoElements) {
      const mediaTime = this.wallClockToMediaTime(v.videoData, wallClockMs);
      if (mediaTime >= 0 && mediaTime <= (v.element.duration || Infinity)) {
        v.element.currentTime = mediaTime;
        v.element.parentElement.style.opacity = '1';
      } else {
        v.element.parentElement.style.opacity = '0.3';
      }
    }
    this.updateTimeDisplay(wallClockMs);
    if (this.seekBar) this.seekBar.update(wallClockMs);
    if (this.lapEditor) this.lapEditor.updateCurrentLap(wallClockMs);
  }

  getCurrentWallClock() {
    const v = this.videoElements[0];
    if (!v) return this.raceStartMs;
    return this.mediaTimeToWallClock(v.videoData, v.element.currentTime);
  }

  renderPlaybackControls() {
    const controls = document.createElement('div');
    controls.className = 'playback-controls';

    const prevFrameBtn = this.createButton('⏮', () => this.stepFrame(-1));
    const frameBackBtn = this.createButton('◀', () => this.stepFrame(-1));
    this.playPauseBtn = this.createButton('▶', () => this.togglePlayPause());
    const frameForwardBtn = this.createButton('▶', () => this.stepFrame(1));
    const nextFrameBtn = this.createButton('⏭', () => this.stepFrame(1));
    this.slowBtn = this.createButton('Slow', () => this.toggleSlow());
    this.slowBtn.style.fontSize = '12px';
    this.slowBtn.style.width = 'auto';
    this.slowBtn.style.padding = '0 12px';

    this.timeDisplay = document.createElement('span');
    this.timeDisplay.className = 'time-display';
    this.timeDisplay.textContent = '00:00.000';

    this.rateDisplay = document.createElement('span');
    this.rateDisplay.className = 'playback-rate';

    controls.append(prevFrameBtn, frameBackBtn, this.playPauseBtn, frameForwardBtn, nextFrameBtn, this.slowBtn, this.timeDisplay, this.rateDisplay);
    this.container.appendChild(controls);

    // Quick-add lap buttons per pilot
    this.pilotOrder = [];
    const addBar = document.createElement('div');
    addBar.className = 'quick-add-bar';
    const addLabel = document.createElement('span');
    addLabel.className = 'quick-add-label';
    addLabel.textContent = 'Add Lap:';
    addBar.appendChild(addLabel);

    const pilotChannels = this.race.PilotChannels || [];
    pilotChannels.forEach((pc, i) => {
      const pilot = this.pilots.find(p => p.ID === pc.Pilot);
      const pilotName = pilot ? pilot.Name : 'Unknown';
      const color = PilotCard.getChannelColor(pc.Channel, this.event.Channels, this.event.ChannelColors);
      this.pilotOrder.push(pc.Pilot);

      const btn = document.createElement('button');
      btn.className = 'quick-add-btn';
      btn.style.borderColor = color;
      btn.style.color = color;
      btn.innerHTML = `<span class="quick-add-key">${i + 1}</span> ${this.escapeHtml(pilotName)}`;
      btn.title = `Add lap for ${pilotName} at current position (key: ${i + 1})`;
      btn.addEventListener('click', () => this.addLapFromCurrentPosition(pc.Pilot));
      addBar.appendChild(btn);
    });

    this.container.appendChild(addBar);
  }

  createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  renderSeekBar() {
    const seekContainer = document.createElement('div');
    this.seekBar = new SeekBar(seekContainer, {
      onSeek: (timeMs) => this.seekToWallClock(timeMs),
      onMarkerClick: (marker, index, clickPos) => this.onSeekMarkerClick(marker, index, clickPos),
    });
    this.seekBar.setRange(this.timelineStartMs, this.timelineEndMs, this.raceStartMs, this.raceEndMs);
    this.updateSeekMarkers();
    this.container.appendChild(seekContainer);
  }

  updateSeekMarkers() {
    if (!this.seekBar) return;
    this.detectionMarkers = [];
    for (const det of (this.race.Detections || [])) {
      if (!det.Valid) continue;
      const pc = (this.race.PilotChannels || []).find(p => p.Pilot === det.Pilot);
      const color = pc ? PilotCard.getChannelColor(pc.Channel, this.event.Channels, this.event.ChannelColors) : '#FFFFFF';
      const time = new Date(det.Time.replace(/\//g, '-')).getTime();
      this.detectionMarkers.push({ time, color, detectionId: det.ID, pilotId: det.Pilot });
    }
    this.seekBar.setMarkers(this.detectionMarkers);
  }

  onSeekMarkerClick(marker, index, clickPos) {
    this.seekToWallClock(marker.time);
    if (this.lapEditor) {
      this.lapEditor.highlightDetection(marker.detectionId, clickPos);
      const row = this.lapEditor.lapRows.get(marker.detectionId);
      if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  renderLapEditor() {
    const lapContainer = document.createElement('div');
    lapContainer.className = 'lap-tables';
    this.lapEditor = new LapEditor(lapContainer, {
      eventId: this.eventId,
      raceId: this.raceId,
      race: this.race,
      event: this.event,
      pilots: this.pilots,
      onDetectionClick: (det) => {
        const time = new Date(det.Time.replace(/\//g, '-')).getTime();
        this.seekToWallClock(time);
        if (this.lapEditor) this.lapEditor.highlightDetection(det.ID);
        // Also highlight the corresponding seek marker
        const markerIdx = this.detectionMarkers.findIndex(m => m.detectionId === det.ID);
        if (markerIdx >= 0 && this.seekBar) this.seekBar.selectMarker(markerIdx);
      },
      onAddLap: (pilotId) => this.addLapFromCurrentPosition(pilotId),
      onRaceUpdated: (race) => {
        this.race = race;
        this.updateSeekMarkers();
      },
      getCurrentWallClock: () => this.getCurrentWallClock(),
      undoStack: this.undoStack,
    });
    this.container.appendChild(lapContainer);
  }

  togglePlayPause() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.playing = true;
    this.playPauseBtn.textContent = '⏸';
    for (const v of this.videoElements) v.element.play();
    this.startTimeUpdate();
  }

  pause() {
    this.playing = false;
    this.playPauseBtn.textContent = '▶';
    for (const v of this.videoElements) v.element.pause();
    this.stopTimeUpdate();
  }

  toggleSlow() {
    this.slowMotion = !this.slowMotion;
    const rate = this.slowMotion ? 0.25 : 1;
    this.slowBtn.classList.toggle('active', this.slowMotion);
    this.rateDisplay.textContent = this.slowMotion ? '0.25x' : '';
    for (const v of this.videoElements) v.element.playbackRate = rate;
  }

  stepFrame(direction) {
    const fps = 30;
    const step = direction / fps;
    for (const v of this.videoElements) {
      v.element.currentTime = Math.max(0, v.element.currentTime + step);
    }
    const wc = this.getCurrentWallClock();
    this.updateTimeDisplay(wc);
    if (this.seekBar) this.seekBar.update(wc);
    if (this.lapEditor) this.lapEditor.updateCurrentLap(wc);
  }

  seekRelative(seconds) {
    for (const v of this.videoElements) {
      v.element.currentTime = Math.max(0, v.element.currentTime + seconds);
    }
    const wc = this.getCurrentWallClock();
    this.updateTimeDisplay(wc);
    if (this.seekBar) this.seekBar.update(wc);
    if (this.lapEditor) this.lapEditor.updateCurrentLap(wc);
  }

  updateTimeDisplay(wallClockMs) {
    const elapsed = wallClockMs - this.raceStartMs;
    this.timeDisplay.textContent = this.formatTime(elapsed);
  }

  formatTime(ms) {
    const neg = ms < 0;
    ms = Math.abs(ms);
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${neg ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  startTimeUpdate() {
    this.stopTimeUpdate();
    this.timeUpdateId = setInterval(() => {
      const wc = this.getCurrentWallClock();
      this.updateTimeDisplay(wc);
      if (this.seekBar) this.seekBar.update(wc);
      if (this.lapEditor) this.lapEditor.updateCurrentLap(wc);
    }, 50);
  }

  stopTimeUpdate() {
    if (this.timeUpdateId) clearInterval(this.timeUpdateId);
  }

  async addLapFromCurrentPosition(pilotId) {
    const wallClockMs = this.getCurrentWallClock();
    const wallClockDate = new Date(wallClockMs);
    const timeStr = `${wallClockDate.getFullYear()}/${String(wallClockDate.getMonth()+1).padStart(2,'0')}/${String(wallClockDate.getDate()).padStart(2,'0')} ${wallClockDate.getHours()}:${String(wallClockDate.getMinutes()).padStart(2,'0')}:${String(wallClockDate.getSeconds()).padStart(2,'0')}.${String(wallClockDate.getMilliseconds()).padStart(3,'0')}`;

    try {
      await api.addLap(this.eventId, this.raceId, { pilotId, time: timeStr });
      this.race = await api.getRace(this.eventId, this.raceId);
      this.updateSeekMarkers();
      if (this.lapEditor) this.lapEditor.updateRace(this.race);
    } catch (err) {
      alert('Failed to add lap: ' + err.message);
    }
  }

  setupKeyboard() {
    this.keyHandler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey || this.playing) this.seekRelative(0.5);
          else this.stepFrame(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey || this.playing) this.seekRelative(-0.5);
          else this.stepFrame(-1);
          break;
        case 'KeyZ':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (this.lapEditor) this.lapEditor.undo();
          }
          break;
        case 'Escape':
          if (this.focusedPilotId) {
            this.focusedPilotId = null;
            this.applyPilotFocus();
          }
          break;
        default:
          if (e.code >= 'Digit1' && e.code <= 'Digit9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const idx = parseInt(e.code.replace('Digit', '')) - 1;
            if (this.pilotOrder && idx < this.pilotOrder.length) {
              e.preventDefault();
              this.addLapFromCurrentPosition(this.pilotOrder[idx]);
            }
          }
          break;
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  setupTouchControls(videoEl) {
    let touchStartX = 0;
    let touchStartTime = 0;
    videoEl.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
    }, { passive: true });
    videoEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dt = Date.now() - touchStartTime;
      if (Math.abs(dx) > 30 && dt < 500) {
        this.seekRelative(dx > 0 ? 0.5 : -0.5);
      } else if (Math.abs(dx) < 10 && dt < 300) {
        this.togglePlayPause();
      }
    }, { passive: true });
  }

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  cleanup() {
    this.stopTimeUpdate();
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    for (const v of this.videoElements) {
      v.element.pause();
      v.element.src = '';
    }
  }
}
