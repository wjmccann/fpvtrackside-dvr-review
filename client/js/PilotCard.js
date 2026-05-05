class PilotCard {
  static CHANNEL_DATA = PilotCard.buildChannelData();

  static buildChannelData() {
    const channels = {};
    const bands = [
      { name: 'F', start: 1, count: 8, freq: i => 5740 + i * 20 },
      { name: 'R', start: 9, count: 8, freq: i => 5658 + i * 37 },
      { name: 'A', start: 17, count: 8, freq: i => 5865 + i * -20 },
      { name: 'B', start: 25, count: 8, freq: i => 5733 + i * 19 },
      { name: 'DJI', start: 33, count: 8, freq: [5660, 5695, 5735, 5770, 5805, 5839, 5878, 5914] },
      { name: 'E', start: 41, count: 8, freq: [5705, 5685, 5665, 5645, 5885, 5905, 5925, 5945] },
      { name: 'HDZ-R', start: 49, count: 8, freq: i => 5658 + i * 37 },
      { name: 'HDZ-F', start: 57, count: 2, freq: [5760, 5800] },
      { name: 'LB', start: 59, count: 8, freq: i => 5333 + i * 40 },
      { name: 'DT', start: 67, count: 8, freq: i => 5362 + i * 37 },
      { name: 'O3', start: 75, count: 7, freq: [5669, 5705, 5768, 5804, 5839, 5876, 5912] },
      { name: 'O4', start: 100, count: 8, freq: i => 5658 + i * 37 },
      { name: 'WS', start: 110, count: 8, freq: i => 5658 + i * 37 },
    ];

    for (const band of bands) {
      for (let i = 0; i < band.count; i++) {
        const id = band.start + i;
        const freq = Array.isArray(band.freq) ? band.freq[i] : band.freq(i);
        const guid = PilotCard.intToGuid(id);
        channels[guid] = { band: band.name, number: i + 1, frequency: freq, displayName: `${band.name}${i + 1}` };
      }
    }
    return channels;
  }

  static CHANNEL_NAME_MAP = (() => {
    const map = {};
    const bandNames = {
      'F': 'Fatshark', 'R': 'Raceband', 'A': 'Boscam A', 'B': 'Boscam B',
      'DJI': 'DJI', 'E': 'E', 'HDZ-R': 'HDZero R', 'HDZ-F': 'HDZero F',
      'LB': 'LowBand', 'DT': 'Diatone', 'O3': 'DJI O3', 'O4': 'DJI O4', 'WS': 'WalkSnail',
    };
    for (const [guid, info] of Object.entries(PilotCard.CHANNEL_DATA)) {
      const fullName = `${bandNames[info.band] || info.band} ${info.number}`;
      map[fullName.toLowerCase()] = guid;
    }
    return map;
  })();

  static resolveChannelName(name) {
    if (!name) return null;
    if (/^[0-9a-f]{8}-/i.test(name)) return name;
    return PilotCard.CHANNEL_NAME_MAP[name.toLowerCase()] || null;
  }

  static intToGuid(intId) {
    const hex = intId.toString(16).padStart(8, '0');
    return `${hex}-0000-0000-0000-000000000000`;
  }

  static getChannelInfo(channelGuid) {
    return PilotCard.CHANNEL_DATA[channelGuid] || { band: '?', number: 0, frequency: 0, displayName: '?' };
  }

  static getChannelColor(channelId, eventChannels, channelColors) {
    if (!eventChannels || !channelColors || channelColors.length === 0) return '#FFFFFF';

    const channelsWithFreq = eventChannels.map(id => {
      const info = PilotCard.getChannelInfo(id);
      return { ID: id, Frequency: info.frequency };
    }).sort((a, b) => a.Frequency - b.Frequency);

    let colorIndex = 0;
    let lastChannel = null;

    for (let i = 0; i < channelsWithFreq.length; i++) {
      if (i > 0 && lastChannel && Math.abs(channelsWithFreq[i].Frequency - lastChannel.Frequency) >= 15) {
        colorIndex = (colorIndex + 1) % channelColors.length;
      }
      if (channelsWithFreq[i].ID === channelId) {
        return channelColors[colorIndex];
      }
      lastChannel = channelsWithFreq[i];
    }
    return '#FFFFFF';
  }

  static create(pilot, channelId, event) {
    const info = PilotCard.getChannelInfo(channelId);
    const color = PilotCard.getChannelColor(channelId, event.Channels, event.ChannelColors);
    return { pilot, channelId, channelInfo: info, color };
  }
}
