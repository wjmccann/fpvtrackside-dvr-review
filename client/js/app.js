const appContainer = document.getElementById('app');
let currentReplay = null;

const browser = new EventBrowser(appContainer, async (eventId, raceId, event, pilots, rounds, race) => {
  if (currentReplay) currentReplay.cleanup();
  appContainer.innerHTML = '';
  currentReplay = new RaceReplay(appContainer, {
    eventId, raceId, event, pilots, rounds, race,
    onBack: () => {
      currentReplay = null;
      browser.showRaceList(eventId);
    },
  });
  await currentReplay.load();
});

browser.showEventList();

// Settings modal
document.getElementById('settings-btn').addEventListener('click', async () => {
  const settings = await api.getSettings();

  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  overlay.innerHTML = `
    <div class="settings-modal">
      <h2>Settings</h2>
      <label for="s-dataDir">Trackside Data Directory</label>
      <input type="text" id="s-dataDir" value="${settings.dataDir.replace(/"/g, '&quot;')}">
      <label for="s-tracksideUrl">Trackside HTTP URL</label>
      <input type="text" id="s-tracksideUrl" value="${settings.tracksideUrl.replace(/"/g, '&quot;')}">
      <label for="s-ffmpegPath">FFmpeg Path</label>
      <input type="text" id="s-ffmpegPath" value="${settings.ffmpegPath.replace(/"/g, '&quot;')}">
      <div class="settings-modal-buttons">
        <button class="settings-cancel">Cancel</button>
        <button class="settings-save">Save</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('.settings-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('.settings-save').addEventListener('click', async () => {
    await api.updateSettings({
      dataDir: overlay.querySelector('#s-dataDir').value,
      tracksideUrl: overlay.querySelector('#s-tracksideUrl').value,
      ffmpegPath: overlay.querySelector('#s-ffmpegPath').value,
    });
    overlay.remove();
    if (currentReplay) {
      currentReplay.cleanup();
      currentReplay = null;
    }
    appContainer.innerHTML = '';
    browser.showEventList();
  });
});

// Clock
function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();
