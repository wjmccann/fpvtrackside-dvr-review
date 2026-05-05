class LapEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.eventId = options.eventId;
    this.raceId = options.raceId;
    this.race = options.race;
    this.event = options.event;
    this.pilots = options.pilots;
    this.onDetectionClick = options.onDetectionClick || (() => {});
    this.onAddLap = options.onAddLap || (() => {});
    this.onRaceUpdated = options.onRaceUpdated || (() => {});
    this.getCurrentWallClock = options.getCurrentWallClock || (() => 0);
    this.undoStack = options.undoStack || [];
    this.showInvalid = false;
    this.selectedDetectionId = null;
    this.currentLapIds = new Map();
    this.lapRows = new Map();
    this.render();
  }

  updateRace(race) {
    this.race = race;
    this.render();
  }

  highlightDetection(detectionId, clickPos) {
    this.selectedDetectionId = detectionId;
    this.dismissActionPanel();
    this.lapRows.forEach((tr, detId) => {
      tr.classList.toggle('selected-lap', detId === detectionId);
    });
    if (detectionId) this.showActionPanel(detectionId, clickPos);
  }

  showActionPanel(detectionId, clickPos) {
    this.dismissActionPanel();
    const det = (this.race.Detections || []).find(d => d.ID === detectionId);
    if (!det) return;

    const panel = document.createElement('div');
    panel.className = 'lap-action-panel lap-action-panel-floating';
    panel.style.position = 'fixed';
    panel.style.zIndex = '200';

    if (clickPos) {
      panel.style.top = (clickPos.y + 12) + 'px';
      panel.style.left = (clickPos.x - 90) + 'px';
    }

    const pilot = this.pilots.find(p => p.ID === det.Pilot);
    const lap = (this.race.Laps || []).find(l => l.Detection === detectionId);
    const color = (() => {
      const pc = (this.race.PilotChannels || []).find(p => p.Pilot === det.Pilot);
      return pc ? PilotCard.getChannelColor(pc.Channel, this.event.Channels, this.event.ChannelColors) : '#FFFFFF';
    })();

    const label = document.createElement('div');
    label.className = 'lap-action-panel-label';
    const lapNum = lap ? (lap.LapNumber === 0 ? 'Holeshot' : `Lap ${lap.LapNumber}`) : 'Detection';
    const lengthStr = lap ? ` (${lap.LengthSeconds.toFixed(3)}s)` : '';
    label.innerHTML = `<span style="color:${color}">${pilot ? pilot.Name : 'Unknown'}</span> — ${lapNum}${lengthStr}`;
    panel.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'lap-action-panel-buttons';

    if (det.Valid) {
      const invBtn = document.createElement('button');
      invBtn.className = 'lap-panel-btn danger';
      invBtn.textContent = 'Invalidate';
      invBtn.addEventListener('click', () => { this.dismissActionPanel(); this.invalidateLap(det); });
      actions.appendChild(invBtn);
    } else {
      const valBtn = document.createElement('button');
      valBtn.className = 'lap-panel-btn success';
      valBtn.textContent = 'Validate';
      valBtn.addEventListener('click', () => { this.dismissActionPanel(); this.validateLap(det); });
      actions.appendChild(valBtn);
    }

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'lap-panel-btn secondary';
    dismissBtn.textContent = '✕';
    dismissBtn.addEventListener('click', () => this.dismissActionPanel());
    actions.appendChild(dismissBtn);

    panel.appendChild(actions);
    document.body.appendChild(panel);
    this.activePanel = panel;

    // Clamp to viewport
    requestAnimationFrame(() => {
      const pr = panel.getBoundingClientRect();
      if (pr.right > window.innerWidth) panel.style.left = (window.innerWidth - pr.width - 8) + 'px';
      if (pr.left < 0) panel.style.left = '8px';
    });

    // Dismiss on outside click
    this._dismissHandler = (e) => {
      if (!panel.contains(e.target) && !e.target.classList.contains('seek-marker')) {
        this.dismissActionPanel();
      }
    };
    setTimeout(() => document.addEventListener('click', this._dismissHandler), 0);
  }

  dismissActionPanel() {
    if (this.activePanel) {
      this.activePanel.remove();
      this.activePanel = null;
    }
    if (this._dismissHandler) {
      document.removeEventListener('click', this._dismissHandler);
      this._dismissHandler = null;
    }
    if (this.selectedDetectionId) {
      this.selectedDetectionId = null;
      this.lapRows.forEach((tr) => tr.classList.remove('selected-lap'));
    }
  }

  updateCurrentLap(wallClockMs) {
    const raceStartMs = new Date(this.race.Start.replace(/\//g, '-')).getTime();
    const pilotChannels = this.race.PilotChannels || [];

    for (const pc of pilotChannels) {
      const pilotDets = (this.race.Detections || [])
        .filter(d => d.Pilot === pc.Pilot && d.Valid)
        .sort((a, b) => new Date(a.Time.replace(/\//g, '-')) - new Date(b.Time.replace(/\//g, '-')));

      let currentDetId = null;
      for (let i = 0; i < pilotDets.length; i++) {
        const detMs = new Date(pilotDets[i].Time.replace(/\//g, '-')).getTime();
        const nextMs = (i + 1 < pilotDets.length) ? new Date(pilotDets[i + 1].Time.replace(/\//g, '-')).getTime() : Infinity;
        if (wallClockMs >= detMs && wallClockMs < nextMs) {
          currentDetId = pilotDets[i].ID;
          break;
        }
      }
      // Before first detection — highlight nothing
      if (!currentDetId && pilotDets.length > 0) {
        const firstMs = new Date(pilotDets[0].Time.replace(/\//g, '-')).getTime();
        if (wallClockMs < firstMs) currentDetId = null;
      }

      const prevId = this.currentLapIds.get(pc.Pilot);
      if (prevId !== currentDetId) {
        this.currentLapIds.set(pc.Pilot, currentDetId);
        if (prevId) {
          const prevRow = this.lapRows.get(prevId);
          if (prevRow) prevRow.classList.remove('current-lap');
        }
        if (currentDetId) {
          const row = this.lapRows.get(currentDetId);
          if (row) {
            row.classList.add('current-lap');
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    }
  }

  render() {
    this.container.innerHTML = '';
    this.lapRows.clear();

    const invalidCount = (this.race.Detections || []).filter(d => !d.Valid).length;
    if (invalidCount > 0) {
      const toggle = document.createElement('button');
      toggle.className = 'back-btn';
      toggle.style.marginBottom = '12px';
      toggle.textContent = this.showInvalid ? `Hide ${invalidCount} invalid laps` : `Show ${invalidCount} invalid laps`;
      toggle.addEventListener('click', () => { this.showInvalid = !this.showInvalid; this.render(); });
      this.container.appendChild(toggle);
    }

    const raceStartMs = new Date(this.race.Start.replace(/\//g, '-')).getTime();
    const pilotChannels = this.race.PilotChannels || [];

    const allValidLaps = (this.race.Laps || []).filter(l => {
      const det = (this.race.Detections || []).find(d => d.ID === l.Detection);
      return det && det.Valid && l.LapNumber > 0;
    });
    const overallBest = allValidLaps.length > 0 ? Math.min(...allValidLaps.map(l => l.LengthSeconds)) : null;

    for (const pc of pilotChannels) {
      const pilot = this.pilots.find(p => p.ID === pc.Pilot);
      const pilotName = pilot ? pilot.Name : 'Unknown';
      const color = PilotCard.getChannelColor(pc.Channel, this.event.Channels, this.event.ChannelColors);
      const channelInfo = PilotCard.getChannelInfo(pc.Channel);
      const chIdx = this.event.Channels ? this.event.Channels.indexOf(pc.Channel) : -1;
      const chDisplay = (this.event.ChannelDisplayNames && chIdx >= 0) ? this.event.ChannelDisplayNames[chIdx] : channelInfo.displayName;

      const section = document.createElement('div');
      section.className = 'pilot-laps';
      section.dataset.pilotId = pc.Pilot;

      const header = document.createElement('div');
      header.className = 'pilot-laps-header';

      const h3 = document.createElement('h3');
      const dot = document.createElement('span');
      dot.className = 'pilot-color-dot';
      dot.style.backgroundColor = color;
      h3.appendChild(dot);
      h3.appendChild(document.createTextNode(`${pilotName} (${chDisplay}, ${channelInfo.frequency}MHz)`));
      header.appendChild(h3);

      const addBtn = document.createElement('button');
      addBtn.className = 'add-lap-btn';
      addBtn.textContent = '+ Add Lap';
      addBtn.addEventListener('click', () => this.onAddLap(pc.Pilot));
      header.appendChild(addBtn);

      section.appendChild(header);

      const pilotDetections = (this.race.Detections || [])
        .filter(d => d.Pilot === pc.Pilot)
        .sort((a, b) => new Date(a.Time.replace(/\//g, '-')) - new Date(b.Time.replace(/\//g, '-')));

      const pilotLaps = (this.race.Laps || [])
        .filter(l => {
          const det = pilotDetections.find(d => d.ID === l.Detection);
          if (!det) return false;
          if (!this.showInvalid && !det.Valid) return false;
          return true;
        })
        .sort((a, b) => new Date(a.EndTime.replace(/\//g, '-')) - new Date(b.EndTime.replace(/\//g, '-')));

      const validPilotLaps = pilotLaps.filter(l => {
        const det = pilotDetections.find(d => d.ID === l.Detection);
        return det && det.Valid && l.LapNumber > 0;
      });
      const personalBest = validPilotLaps.length > 0 ? Math.min(...validPilotLaps.map(l => l.LengthSeconds)) : null;

      const table = document.createElement('table');
      table.className = 'lap-table';
      table.innerHTML = `<thead><tr><th>#</th><th>Time</th><th>Length</th><th>Status</th><th>Source</th><th>Actions</th></tr></thead>`;
      const tbody = document.createElement('tbody');

      for (const lap of pilotLaps) {
        const det = pilotDetections.find(d => d.ID === lap.Detection);
        if (!det) continue;

        const tr = document.createElement('tr');
        tr.dataset.detectionId = det.ID;
        if (!det.Valid) tr.className = 'invalid';
        if (det.ID === this.selectedDetectionId) tr.classList.add('selected-lap');
        if (det.ID === this.currentLapIds.get(pc.Pilot)) tr.classList.add('current-lap');

        const isOverallBest = det.Valid && lap.LapNumber > 0 && overallBest !== null && Math.abs(lap.LengthSeconds - overallBest) < 0.001;
        const isPersonalBest = det.Valid && lap.LapNumber > 0 && personalBest !== null && Math.abs(lap.LengthSeconds - personalBest) < 0.001 && !isOverallBest;
        if (isOverallBest) tr.classList.add('overall-best');
        else if (isPersonalBest) tr.classList.add('personal-best');

        const detTimeMs = new Date(det.Time.replace(/\//g, '-')).getTime();
        const elapsed = detTimeMs - raceStartMs;

        tr.innerHTML = `
          <td>${lap.LapNumber === 0 ? 'HS' : lap.LapNumber}</td>
          <td class="time-cell" style="cursor:pointer">${this.formatTime(elapsed)}</td>
          <td class="time-cell">${lap.LengthSeconds.toFixed(3)}s</td>
          <td><span class="${det.Valid ? 'status-valid' : 'status-invalid'}">${det.Valid ? '✓' : '✗'}</span></td>
          <td>${det.TimingSystemType || ''}${det.TimingSystemType === 'Manual' ? '<span class="manual-badge">M</span>' : ''}</td>
          <td></td>
        `;

        const timeTd = tr.querySelector('.time-cell');
        timeTd.addEventListener('click', () => this.onDetectionClick(det));

        const actionTd = tr.querySelector('td:last-child');
        if (det.Valid) {
          const invBtn = document.createElement('button');
          invBtn.className = 'lap-action-btn danger';
          invBtn.textContent = '✗';
          invBtn.title = 'Invalidate';
          invBtn.addEventListener('click', () => this.invalidateLap(det));
          actionTd.appendChild(invBtn);
        } else {
          const valBtn = document.createElement('button');
          valBtn.className = 'lap-action-btn success';
          valBtn.textContent = '✓';
          valBtn.title = 'Validate';
          valBtn.addEventListener('click', () => this.validateLap(det));
          actionTd.appendChild(valBtn);
        }

        this.lapRows.set(det.ID, tr);
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      section.appendChild(table);
      this.container.appendChild(section);
    }
  }

  async invalidateLap(detection) {
    this.undoStack.push({ type: 'validate', detectionId: detection.ID });
    if (this.undoStack.length > 20) this.undoStack.shift();
    try {
      await api.invalidateLap(this.eventId, this.raceId, detection.ID);
      this.race = await api.getRace(this.eventId, this.raceId);
      this.onRaceUpdated(this.race);
      this.render();
    } catch (err) { alert('Failed: ' + err.message); }
  }

  async validateLap(detection) {
    this.undoStack.push({ type: 'invalidate', detectionId: detection.ID });
    if (this.undoStack.length > 20) this.undoStack.shift();
    try {
      await api.validateLap(this.eventId, this.raceId, detection.ID);
      this.race = await api.getRace(this.eventId, this.raceId);
      this.onRaceUpdated(this.race);
      this.render();
    } catch (err) { alert('Failed: ' + err.message); }
  }

  async undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    try {
      if (action.type === 'validate') {
        await api.validateLap(this.eventId, this.raceId, action.detectionId);
      } else if (action.type === 'invalidate') {
        await api.invalidateLap(this.eventId, this.raceId, action.detectionId);
      }
      this.race = await api.getRace(this.eventId, this.raceId);
      this.onRaceUpdated(this.race);
      this.render();
    } catch (err) { alert('Undo failed: ' + err.message); }
  }

  formatTime(ms) {
    const neg = ms < 0;
    ms = Math.abs(ms);
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${neg ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }
}
