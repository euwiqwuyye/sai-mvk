// audio-player.js
// Handles the background music player:
// - Injects a real play/pause button into the bottom bar (matches video player style)
// - Starts muted immediately (browsers allow this) then unmutes on the
//   visitor's first click/tap/keypress anywhere on the page — the closest
//   thing to true autoplay that actually works across browsers.
// - Live progress bar with click-to-seek.
// - Working volume slider synced with a live "%" label.

document.addEventListener('DOMContentLoaded', () => {
  // Target the <audio> tag that's actually followed by this player's own
  // UI (identified by its #bg-progress-bar), rather than matching by
  // filename. This way, swapping in a new song later just works — no need
  // to update this script every time the track changes.
  const audio =
    Array.from(document.querySelectorAll('audio')).find(
      (el) => el.nextElementSibling?.querySelector('#bg-progress-bar')
    ) || document.querySelector('audio');
  if (!audio) return;

  // The player UI is the very next element after the <audio> tag in the markup
  const playerRoot = audio.nextElementSibling;
  if (!playerRoot) return;

  const PLAY_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5L14 8L4 14.5V1.5Z"></path></svg>';
  const PAUSE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="1.5" width="3.5" height="13"></rect><rect x="9.5" y="1.5" width="3.5" height="13"></rect></svg>';

  const SPEAKER_ON_INNER = `
    <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
    <path d="M19.07 4.93a10 10 0 010 14.14"></path>
    <path d="M15.54 8.46a5 5 0 010 7.07"></path>
  `;
  const SPEAKER_MUTED_INNER = `
    <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
    <line x1="23" y1="9" x2="17" y2="15"></line>
    <line x1="17" y1="9" x2="23" y2="15"></line>
  `;

  const progressBar = playerRoot.querySelector('#bg-progress-bar');
  const progressFill = progressBar ? progressBar.children[0] : null;
  const progressDot  = progressBar ? progressBar.children[1] : null;

  const volBar = playerRoot.querySelector('#bg-vol-bar');
  const volFill = volBar ? volBar.children[0] : null;
  const volLabel = volBar ? volBar.parentElement.querySelector('span') : null;
  const speakerIcon = volBar ? volBar.parentElement.querySelector('svg') : null;

  const timeLabel = Array.from(playerRoot.querySelectorAll('span')).find((el) =>
    el.textContent.includes('/')
  );

  const albumArt = playerRoot.querySelector('img')?.closest('div');
  let controlsRow = albumArt ? albumArt.parentElement : null; // the "gap: 14px" row

  // Safety check: only ever inject into the audio player's OWN controls row.
  // If this traversal accidentally lands on a video's container instead
  // (e.g. because of how blocks are nested in index.html), controlsRow
  // won't contain the audio player's own progress/volume bars — bail out
  // rather than risk inserting a button into someone else's UI.
  if (controlsRow && (!progressBar || !controlsRow.contains(progressBar)) &&
      (!volBar || !controlsRow.contains(volBar))) {
    controlsRow = null;
  }

  const formatTime = (secs) => {
    if (!isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const togglePlay = () => {
    if (audio.paused) {
      audio.muted = false;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  // --- Inject a real play/pause button into the bottom bar ---
  let playPauseBtn = null;
  if (controlsRow) {
    playPauseBtn = document.createElement('button');
    playPauseBtn.setAttribute('data-foreign-player-btn', 'true'); // let other player scripts ignore this
    playPauseBtn.innerHTML = PLAY_ICON;
    playPauseBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      outline: none;
      color: #ccc;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });
    controlsRow.insertBefore(playPauseBtn, controlsRow.firstChild);
  }

  const syncPlayIcon = () => {
    if (!playPauseBtn) return;
    playPauseBtn.innerHTML = audio.paused ? PLAY_ICON : PAUSE_ICON;
  };
  audio.addEventListener('play', syncPlayIcon);
  audio.addEventListener('pause', syncPlayIcon);

  // --- Near-autoplay: start muted, unmute on first interaction ---
  audio.muted = true;
  audio.play().catch(() => {});

  const unlockAudio = () => {
    audio.muted = false;
    audio.play().catch(() => {});
    ['click', 'touchstart', 'keydown'].forEach((evt) =>
      document.removeEventListener(evt, unlockAudio)
    );
  };
  ['click', 'touchstart', 'keydown'].forEach((evt) =>
    document.addEventListener(evt, unlockAudio, { once: false })
  );

  // --- Progress bar ---
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressDot) progressDot.style.left = `${pct}%`;
    if (timeLabel) {
      timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  });

  if (progressBar) {
    const seek = (clientX) => {
      const rect = progressBar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      if (audio.duration) audio.currentTime = ratio * audio.duration;
    };
    let draggingSeek = false;
    progressBar.addEventListener('mousedown', (e) => { e.stopPropagation(); draggingSeek = true; seek(e.clientX); });
    window.addEventListener('mousemove', (e) => { if (draggingSeek) seek(e.clientX); });
    window.addEventListener('mouseup', () => { draggingSeek = false; });
    progressBar.addEventListener('touchstart', (e) => { e.stopPropagation(); seek(e.touches[0].clientX); });
    progressBar.addEventListener('touchmove', (e) => { seek(e.touches[0].clientX); });
  }

  // --- Volume slider ---
  const updateVolumeUI = () => {
    const pct = audio.muted ? 0 : Math.round(audio.volume * 100);
    if (volFill) volFill.style.width = `${pct}%`;
    if (volLabel) volLabel.textContent = `${pct}%`;
    if (speakerIcon) {
      speakerIcon.innerHTML = (audio.muted || audio.volume === 0) ? SPEAKER_MUTED_INNER : SPEAKER_ON_INNER;
    }
  };

  audio.volume = 0.7; // matches the 70% already shown in the markup
  updateVolumeUI();

  if (speakerIcon) {
    speakerIcon.style.cursor = 'pointer';
    speakerIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.muted = !audio.muted;
      updateVolumeUI();
    });
  }

  if (volBar) {
    const setVolume = (clientX) => {
      const rect = volBar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      audio.volume = ratio;
      audio.muted = ratio === 0;
      updateVolumeUI();
    };
    let draggingVol = false;
    volBar.addEventListener('mousedown', (e) => { e.stopPropagation(); draggingVol = true; setVolume(e.clientX); });
    window.addEventListener('mousemove', (e) => { if (draggingVol) setVolume(e.clientX); });
    window.addEventListener('mouseup', () => { draggingVol = false; });
    volBar.addEventListener('touchstart', (e) => { e.stopPropagation(); setVolume(e.touches[0].clientX); });
    volBar.addEventListener('touchmove', (e) => { setVolume(e.touches[0].clientX); });
  }
});
