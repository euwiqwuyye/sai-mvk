// voice-message-player.js
// Wires up waveform-style voice-message audio bubbles (play button + bar
// waveform + time label), as opposed to the background music bar
// (audio-player.js) or <video> elements (video-player.js).
// No HTML edits needed — finds each matching <audio> by structure.

document.addEventListener('DOMContentLoaded', () => {
  const PLAY_TRIANGLE = `
    <div style="
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-left: 11px solid #555;
      margin-left: 3px;
    "></div>
  `;
  const PAUSE_BARS = `
    <div style="display: flex; gap: 3px;">
      <div style="width: 3px; height: 14px; background: #555; border-radius: 1px;"></div>
      <div style="width: 3px; height: 14px; background: #555; border-radius: 1px;"></div>
    </div>
  `;

  const PLAYED_COLOR = '#555';
  const UNPLAYED_COLOR = '#1a1a1a';

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

  const formatTime = (secs) => {
    if (!isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Any <audio> already claimed by the background music player (the one
  // followed by #bg-progress-bar) is skipped — everything else that's an
  // <audio> tag on this page is treated as a voice-message bubble.
  const audios = Array.from(document.querySelectorAll('audio')).filter(
    (el) => !el.nextElementSibling?.querySelector('#bg-progress-bar')
  );

  audios.forEach((audio) => {
    const playerRoot = audio.nextElementSibling;
    if (!playerRoot) return;

    const playBtn = playerRoot.querySelector('button');
    if (!playBtn) return;

    // The waveform: a row of thin bars, identified by its own inline style
    // signature rather than an id, since none is set in the markup.
    const waveform = Array.from(playerRoot.querySelectorAll('div')).find((el) => {
      const s = el.getAttribute('style') || '';
      return s.includes('gap: 2px') && s.includes('height: 28px');
    });
    const bars = waveform ? Array.from(waveform.children) : [];

    const timeLabel = Array.from(playerRoot.querySelectorAll('span')).find((el) =>
      el.textContent.includes('/')
    );

    const togglePlay = () => {
      if (audio.paused) {
        audio.play().catch((err) => console.warn('Play blocked:', err));
      } else {
        audio.pause();
      }
    };

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    audio.addEventListener('play', () => { playBtn.innerHTML = PAUSE_BARS; });
    audio.addEventListener('pause', () => { playBtn.innerHTML = PLAY_TRIANGLE; });
    audio.addEventListener('ended', () => { playBtn.innerHTML = PLAY_TRIANGLE; });

    const updateWaveform = (pct) => {
      if (!bars.length) return;
      const playedCount = Math.round((pct / 100) * bars.length);
      bars.forEach((bar, i) => {
        bar.style.background = i < playedCount ? PLAYED_COLOR : UNPLAYED_COLOR;
      });
    };

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      updateWaveform(pct);
      if (timeLabel) {
        timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (timeLabel) timeLabel.textContent = `${formatTime(0)} / ${formatTime(audio.duration)}`;
    });

    // Click anywhere on the waveform to seek there
    if (waveform) {
      waveform.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = waveform.getBoundingClientRect();
        const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        if (audio.duration) audio.currentTime = ratio * audio.duration;
      });
    }

    // --- Volume row: lives in a sibling row below playerRoot, not inside
    // it — the speaker icon (a bare <svg>, not a <button>) and the
    // #audio-vol-bar slider with its "%" label. ---
    const volumeRow = playerRoot.nextElementSibling;
    const speakerIcon = volumeRow ? volumeRow.querySelector('svg') : null;
    const volBar = volumeRow ? volumeRow.querySelector('#audio-vol-bar') : null;
    const volFill = volBar ? volBar.children[0] : null;
    const volLabel = volumeRow ? volumeRow.querySelector('span') : null;

    const updateVolumeUI = () => {
      const pct = audio.muted ? 0 : Math.round(audio.volume * 100);
      if (volFill) volFill.style.width = `${pct}%`;
      if (volLabel) volLabel.textContent = `${pct}%`;
      if (speakerIcon) {
        speakerIcon.innerHTML = (audio.muted || audio.volume === 0) ? SPEAKER_MUTED_INNER : SPEAKER_ON_INNER;
      }
    };

    audio.volume = 1; // matches the "100%" label already shown in the markup
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
});
