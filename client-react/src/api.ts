import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Event {
  ID: string;
  Name: string;
  EventType?: string;
  Start?: string;
  PilotsRegistered?: number;
  RaceCount?: number;
  Channels?: string[];
  ChannelDisplayNames?: string[];
}

export interface Pilot {
  ID: string;
  Name: string;
}

export interface Round {
  ID: string;
  RoundNumber: number;
  Order: number;
}

export interface PilotChannel {
  Pilot: string;
  Channel: string;
}

export interface Detection {
  ID: string;
  Pilot: string;
  Channel: string;
  Time: string;
  LapNumber: number;
  Valid: boolean;
  ValidityType: string;
  TimingSystemType?: string;
  IsLapEnd?: boolean;
  Peak?: number;
  RaceSector?: number;
  IsHoleshot?: boolean;
  TimingSystemIndex?: number;
}

export interface Lap {
  ID: string;
  Detection: string;
  LapNumber: number;
  StartTime?: string;
  EndTime?: string;
  LengthSeconds?: number;
}

export interface Race {
  ID: string;
  RaceNumber?: number;
  Round?: string;
  Bracket?: string;
  Start?: string;
  End?: string;
  PilotChannels?: PilotChannel[];
  Laps?: Lap[];
  Detections?: Detection[];
  PrimaryTimingSystemLocation?: string;
}

export interface VideoFile {
  filename: string;
  channel?: string;
  pilot?: string;
}

export const api = {
  listEvents: () => client.get<Event[]>('/events').then(r => r.data),
  getEvent: (id: string) => client.get<Event>(`/events/${id}`).then(r => r.data),
  getPilots: (id: string) => client.get<Pilot[]>(`/events/${id}/pilots`).then(r => r.data),
  getRounds: (id: string) => client.get<Round[]>(`/events/${id}/rounds`).then(r => r.data),
  getRaces: (id: string) => client.get<Race[]>(`/events/${id}/races`).then(r => r.data),
  getRace: (eventId: string, raceId: string) =>
    client.get<Race>(`/events/${eventId}/races/${raceId}`).then(r => r.data),
  getVideos: (eventId: string, raceId: string) =>
    client.get<VideoFile[]>(`/events/${eventId}/races/${raceId}/videos`).then(r => r.data),

  addLap: (eventId: string, raceId: string, data: unknown) =>
    client.post(`/events/${eventId}/races/${raceId}/laps`, data).then(r => r.data),
  invalidateLap: (eventId: string, raceId: string, detectionId: string) =>
    client.delete(`/events/${eventId}/races/${raceId}/laps/${detectionId}`).then(r => r.data),
  validateLap: (eventId: string, raceId: string, detectionId: string) =>
    client.patch(`/events/${eventId}/races/${raceId}/laps/${detectionId}`, { valid: true }).then(r => r.data),
  correctLapTime: (eventId: string, raceId: string, detectionId: string, time: string) =>
    client.put(`/events/${eventId}/races/${raceId}/laps/${detectionId}`, { time }).then(r => r.data),

  getVideoConfig: () => client.get('/settings/video-config').then(r => r.data),
  getSettings: () => client.get('/settings').then(r => r.data),
  updateSettings: (settings: unknown) => client.put('/settings', settings).then(r => r.data),

  login: (name: string, pin: string) =>
    client.post('/auth/login', { name, pin }).then(r => r.data),
  register: (name: string, pin: string) =>
    client.post('/auth/register', { name, pin }).then(r => r.data),
  getMe: () => client.get('/auth/me').then(r => r.data),

  getAuditLog: (params?: Record<string, string>) =>
    client.get('/audit', { params }).then(r => r.data),
  getAuditLogForRace: (raceId: string) =>
    client.get(`/audit/race/${raceId}`).then(r => r.data),
  rollback: (auditId: number) =>
    client.post(`/audit/${auditId}/rollback`).then(r => r.data),
};
