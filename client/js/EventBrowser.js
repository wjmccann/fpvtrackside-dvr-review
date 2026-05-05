class EventBrowser {
  constructor(container, onSelectRace) {
    this.container = container;
    this.onSelectRace = onSelectRace;
    this.currentEvent = null;
    this.pilots = [];
    this.rounds = [];
  }

  async showEventList() {
    this.currentEvent = null;
    const events = await api.listEvents();
    this.container.innerHTML = '';

    const h = document.createElement('h2');
    h.textContent = 'Events';
    h.style.marginBottom = '16px';
    this.container.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'event-list';

    for (const evt of events) {
      const card = document.createElement('div');
      card.className = 'event-card';
      const startDate = evt.Start ? new Date(evt.Start.replace(/\//g, '-')).toLocaleDateString() : '';
      card.innerHTML = `
        <h3>${this.escapeHtml(evt.Name)}<span class="event-badge">${evt.EventType || ''}</span></h3>
        <div class="meta">${startDate} &bull; ${evt.PilotsRegistered || 0} pilots &bull; ${evt.RaceCount || 0} races</div>
      `;
      card.addEventListener('click', () => this.showRaceList(evt.ID));
      grid.appendChild(card);
    }

    this.container.appendChild(grid);
  }

  async showRaceList(eventId) {
    this.container.innerHTML = '';

    const [event, pilots, rounds, races] = await Promise.all([
      api.getEvent(eventId),
      api.getPilots(eventId),
      api.getRounds(eventId),
      api.getRaces(eventId),
    ]);

    this.currentEvent = event;
    this.pilots = pilots;
    this.rounds = rounds;

    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Back to Events';
    backBtn.addEventListener('click', () => this.showEventList());
    this.container.appendChild(backBtn);

    const h = document.createElement('h2');
    h.textContent = event.Name;
    h.style.marginBottom = '16px';
    this.container.appendChild(h);

    const roundMap = {};
    for (const r of rounds) { roundMap[r.ID] = r; }

    const byRound = {};
    for (const race of races) {
      const rk = race.Round || 'none';
      if (!byRound[rk]) byRound[rk] = [];
      byRound[rk].push(race);
    }

    const sortedRoundKeys = Object.keys(byRound).sort((a, b) => {
      const ra = roundMap[a], rb = roundMap[b];
      return ((ra ? ra.Order : 9999) - (rb ? rb.Order : 9999));
    });

    for (const rk of sortedRoundKeys) {
      const group = document.createElement('div');
      group.className = 'round-group';
      const round = roundMap[rk];
      const roundLabel = round ? `Round ${round.RoundNumber}` : 'Unassigned';

      const header = document.createElement('div');
      header.className = 'round-header';
      header.textContent = roundLabel;
      group.appendChild(header);

      const list = document.createElement('div');
      list.className = 'race-list';

      const sortedRaces = byRound[rk].sort((a, b) => (a.RaceNumber || 0) - (b.RaceNumber || 0));

      for (const race of sortedRaces) {
        const card = document.createElement('div');
        card.className = 'race-card';

        const pilotNames = (race.PilotChannels || []).map(pc => {
          const p = pilots.find(pl => pl.ID === pc.Pilot);
          const ch = event.Channels ? event.Channels.indexOf(pc.Channel) : -1;
          const chName = (event.ChannelDisplayNames && ch >= 0) ? event.ChannelDisplayNames[ch] : '';
          const name = p ? p.Name : 'Unknown';
          return chName ? `${name} (${chName})` : name;
        }).join(', ');

        const lapCount = (race.Laps && race.Laps.length) ? race.Laps.length : 0;
        card.innerHTML = `
          <div class="race-title">Race ${race.RaceNumber || '?'}${race.Bracket && race.Bracket !== 'None' ? ` (${race.Bracket})` : ''}</div>
          <div class="race-pilots">${this.escapeHtml(pilotNames)}</div>
          <div class="has-video">${lapCount ? `${lapCount} laps` : 'No laps'}<span class="video-check" data-race-id="${race.ID}"></span></div>
        `;
        card.addEventListener('click', () => {
          this.onSelectRace(eventId, race.ID, event, pilots, rounds, race);
        });
        list.appendChild(card);

        // Check for video availability
        api.getVideos(eventId, race.ID).then(vids => {
          const span = card.querySelector('.video-check');
          if (span && vids.length > 0) span.textContent = ' • DVR available';
        }).catch(() => {});
      }
      group.appendChild(list);
      this.container.appendChild(group);
    }
  }

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}
