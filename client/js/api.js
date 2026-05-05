class API {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async fetch(url, options = {}) {
    const res = await fetch(this.baseUrl + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }

  listEvents() { return this.fetch('/api/events'); }
  getEvent(eventId) { return this.fetch(`/api/events/${eventId}`); }
  getPilots(eventId) { return this.fetch(`/api/events/${eventId}/pilots`); }
  getRounds(eventId) { return this.fetch(`/api/events/${eventId}/rounds`); }
  getRaces(eventId) { return this.fetch(`/api/events/${eventId}/races`); }
  getRace(eventId, raceId) { return this.fetch(`/api/events/${eventId}/races/${raceId}`); }
  getVideos(eventId, raceId) { return this.fetch(`/api/events/${eventId}/races/${raceId}/videos`); }

  addLap(eventId, raceId, data) {
    return this.fetch(`/api/events/${eventId}/races/${raceId}/laps`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  invalidateLap(eventId, raceId, detectionId) {
    return this.fetch(`/api/events/${eventId}/races/${raceId}/laps/${detectionId}`, {
      method: 'DELETE',
    });
  }

  validateLap(eventId, raceId, detectionId) {
    return this.fetch(`/api/events/${eventId}/races/${raceId}/laps/${detectionId}`, {
      method: 'PATCH', body: JSON.stringify({ valid: true }),
    });
  }

  correctLapTime(eventId, raceId, detectionId, time) {
    return this.fetch(`/api/events/${eventId}/races/${raceId}/laps/${detectionId}`, {
      method: 'PUT', body: JSON.stringify({ time }),
    });
  }

  getSettings() { return this.fetch('/api/settings'); }

  updateSettings(settings) {
    return this.fetch('/api/settings', {
      method: 'PUT', body: JSON.stringify(settings),
    });
  }
}

const api = new API();
