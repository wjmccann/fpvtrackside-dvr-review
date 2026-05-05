class SeekBar {
  constructor(container, options = {}) {
    this.container = container;
    this.onSeek = options.onSeek || (() => {});
    this.onMarkerClick = options.onMarkerClick || (() => {});
    this.startTime = 0;
    this.endTime = 1;
    this.currentTime = 0;
    this.markers = [];
    this.raceStart = 0;
    this.raceEnd = 0;
    this.dragging = false;
    this.selectedMarkerIndex = -1;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.container.className = 'seek-bar-container';

    this.bar = document.createElement('div');
    this.bar.className = 'seek-bar';

    this.progress = document.createElement('div');
    this.progress.className = 'seek-bar-progress';
    this.bar.appendChild(this.progress);

    this.scrubber = document.createElement('div');
    this.scrubber.className = 'seek-bar-scrubber';
    this.bar.appendChild(this.scrubber);

    this.container.appendChild(this.bar);

    this.bar.addEventListener('mousedown', (e) => this.startDrag(e));
    this.bar.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
    document.addEventListener('mousemove', (e) => this.onDrag(e));
    document.addEventListener('touchmove', (e) => this.onDrag(e));
    document.addEventListener('mouseup', () => this.stopDrag());
    document.addEventListener('touchend', () => this.stopDrag());
  }

  setRange(startTime, endTime, raceStart, raceEnd) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.raceStart = raceStart;
    this.raceEnd = raceEnd;
    this.renderMarkers();
    this.update(this.currentTime);
  }

  setMarkers(markers) {
    this.markers = markers;
    this.selectedMarkerIndex = -1;
    this.renderMarkers();
  }

  selectMarker(index) {
    this.selectedMarkerIndex = index;
    this.bar.querySelectorAll('.seek-marker').forEach((el, i) => {
      el.classList.toggle('seek-marker-selected', i === index);
    });
  }

  renderMarkers() {
    this.bar.querySelectorAll('.seek-marker, .seek-marker-line').forEach(el => el.remove());
    const duration = this.endTime - this.startTime;
    if (duration <= 0) return;

    if (this.raceStart) {
      const pos = ((this.raceStart - this.startTime) / duration) * 100;
      const line = document.createElement('div');
      line.className = 'seek-marker-line';
      line.style.left = pos + '%';
      line.style.backgroundColor = '#00FF00';
      this.bar.appendChild(line);
    }
    if (this.raceEnd) {
      const pos = ((this.raceEnd - this.startTime) / duration) * 100;
      const line = document.createElement('div');
      line.className = 'seek-marker-line';
      line.style.left = pos + '%';
      line.style.backgroundColor = '#FF4444';
      this.bar.appendChild(line);
    }

    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      const pos = ((m.time - this.startTime) / duration) * 100;
      if (pos < 0 || pos > 100) continue;
      const marker = document.createElement('div');
      marker.className = 'seek-marker';
      if (i === this.selectedMarkerIndex) marker.classList.add('seek-marker-selected');
      marker.style.left = pos + '%';
      marker.style.borderBottomColor = m.color || '#FFFFFF';
      marker.dataset.index = i;
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectMarker(i);
        const barRect = this.bar.getBoundingClientRect();
        this.onMarkerClick(m, i, { x: e.clientX, y: barRect.bottom });
      });
      this.bar.appendChild(marker);
    }
  }

  update(currentTime) {
    this.currentTime = currentTime;
    const duration = this.endTime - this.startTime;
    if (duration <= 0) return;
    const pct = Math.max(0, Math.min(100, ((currentTime - this.startTime) / duration) * 100));
    this.progress.style.width = pct + '%';
    this.scrubber.style.left = pct + '%';
  }

  startDrag(e) {
    if (e.target.classList.contains('seek-marker')) return;
    e.preventDefault();
    this.dragging = true;
    this.seekFromEvent(e);
  }

  onDrag(e) {
    if (!this.dragging) return;
    this.seekFromEvent(e);
  }

  stopDrag() { this.dragging = false; }

  seekFromEvent(e) {
    const rect = this.bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = this.startTime + pct * (this.endTime - this.startTime);
    this.onSeek(time);
  }
}
