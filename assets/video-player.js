// video-player.js
// Wires up: play/pause (icon swap), click-to-seek progress bar,
// live time display, working mute + volume slider, and fullscreen.
// No HTML edits needed — finds each <video> and its controls by structure.

document.addEventListener('DOMContentLoaded', () => {
  const videos = document.querySelectorAll('video');

  // Real CSS beats inline styles when marked !important, regardless of
  // where the inline style came from or when it was set. This is what
  // actually lets the fullscreen video grow past its normal inline
  // max-width/max-height caps and sit centered on a black backdrop —
  // toggling inline styles in JS on fullscreenchange was racing against
  // the browser's own fullscreen sizing and losing.
  if (!document.getElementById('video-player-fullscreen-style')) {
    const style = document.createElement('style');
    style.id = 'video-player-fullscreen-style';
    style.textContent = `
      :fullscreen, :-webkit-full-screen {
        max-width: none !important;
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #000 !important;
      }
      :fullscreen video, :-webkit-full-screen video {
        max-height: none !important;
        max-width: 100% !important;
        width: auto !important;
        height: 100% !important;
        object-fit: contain !important;
      }
    `;
    document.head.appendChild(style);
  }

  const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5L14 8L4 14.5V1.5Z"></path></svg>';
  const PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="1.5" width="3.5" height="13"></rect><rect x="9.5" y="1.5" width="3.5" height="13"></rect></svg>';

  const EXPAND_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
  const COLLAPSE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

  const SPEAKER_ON_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
  const SPEAKER_MUTED_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';

  videos.forEach((video) => {
    const player = video.parentElement;
    if (!player) return;

    // --- Play button overlay (center circle) ---
    const playOverlay = Array.from(player.querySelectorAll('div')).find((el) => {
      const s = el.getAttribute('style') || '';
      return s.includes('border-radius: 50%') && s.includes('position: absolute');
    });

    // --- Progress track: height:3px, but NOT the volume bar ---
    const track = Array.from(player.querySelectorAll('div')).find((el) => {
      const s = el.getAttribute('style') || '';
      return s.includes('height: 3px') && el.id !== 'vol-bar';
    });
    const fill = track ? track.children[0] : null;
    const dot  = track ? track.children[1] : null;

    const timeLabel = player.querySelector('span');

    // --- Volume bar (has its own id, easy to target) ---
    const volBar = player.querySelector('#vol-bar');
    const volFill = volBar ? volBar.children[0] : null;
    const volLabel = volBar ? volBar.parentElement.querySelector('span') : null;

    // --- Buttons: [0] play/pause, [1] mute, [2] fullscreen ---
    // Exclude any button injected by other players (e.g. the background
    // audio player's play/pause button) so a stray extra <button> in this
    // container can never shift these indices.
    const buttons = Array.from(player.querySelectorAll('button')).filter(
      (b) => !b.hasAttribute('data-foreign-player-btn')
    );
    const playPauseBtn = buttons[0] || null;
    const muteBtn = buttons[1] || null;
    let fullscreenBtn = buttons[2] || null;

    // Some player instances only ship two buttons (play/pause, mute) with
    // no fullscreen button in the markup at all. Build one ourselves so
    // fullscreen works everywhere, not just where the template included it.
    if (!fullscreenBtn && muteBtn && muteBtn.parentElement) {
      fullscreenBtn = document.createElement('button');
      fullscreenBtn.setAttribute('data-foreign-player-btn', 'true');
      fullscreenBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        outline: none;
        color: #555;
      `;
      fullscreenBtn.innerHTML = EXPAND_ICON;

      // Group the mute button and the new fullscreen button together on
      // the right, matching the existing left-side (play + time) group.
      const rightGroup = document.createElement('div');
      rightGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      muteBtn.parentElement.insertBefore(rightGroup, muteBtn);
      rightGroup.appendChild(muteBtn);
      rightGroup.appendChild(fullscreenBtn);
    }

    const formatTime = (secs) => {
      if (!isFinite(secs)) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    const togglePlay = () => {
      if (video.paused) {
        video.play().catch((err) => console.warn('Play blocked:', err));
      } else {
        video.pause();
      }
    };

    if (playOverlay) {
      playOverlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    }
    video.addEventListener('click', togglePlay);
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    }

    video.addEventListener('play', () => {
      if (playOverlay) playOverlay.style.opacity = '0';
      if (playPauseBtn) playPauseBtn.innerHTML = PAUSE_ICON;
    });
    video.addEventListener('pause', () => {
      if (playOverlay) playOverlay.style.opacity = '1';
      if (playPauseBtn) playPauseBtn.innerHTML = PLAY_ICON;
    });
    video.addEventListener('ended', () => {
      if (playOverlay) playOverlay.style.opacity = '1';
      if (playPauseBtn) playPauseBtn.innerHTML = PLAY_ICON;
    });

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      if (fill) fill.style.width = `${pct}%`;
      if (dot) dot.style.left = `${pct}%`;
      if (timeLabel) timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    });
    video.addEventListener('loadedmetadata', () => {
      if (timeLabel) timeLabel.textContent = `${formatTime(0)} / ${formatTime(video.duration)}`;
    });

    // --- Progress bar seek ---
    if (track) {
      const seek = (clientX) => {
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        if (video.duration) video.currentTime = ratio * video.duration;
      };
      let draggingSeek = false;
      track.addEventListener('mousedown', (e) => { e.stopPropagation(); draggingSeek = true; seek(e.clientX); });
      window.addEventListener('mousemove', (e) => { if (draggingSeek) seek(e.clientX); });
      window.addEventListener('mouseup', () => { draggingSeek = false; });
      track.addEventListener('touchstart', (e) => { e.stopPropagation(); seek(e.touches[0].clientX); });
      track.addEventListener('touchmove', (e) => { seek(e.touches[0].clientX); });
    }

    // --- Volume: mute button + slider stay in sync ---
    const updateVolumeUI = () => {
      const pct = video.muted ? 0 : Math.round(video.volume * 100);
      if (volFill) volFill.style.width = `${pct}%`;
      if (volLabel) volLabel.textContent = `${pct}%`;
      if (muteBtn) muteBtn.innerHTML = (video.muted || video.volume === 0) ? SPEAKER_MUTED_ICON : SPEAKER_ON_ICON;
    };

    // Set a sane starting volume (matches the "20%" shown in the markup)
    video.volume = 0.2;
    updateVolumeUI();

    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        updateVolumeUI();
      });
    }

    if (volBar) {
      const setVolume = (clientX) => {
        const rect = volBar.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        video.volume = ratio;
        video.muted = ratio === 0;
        updateVolumeUI();
      };
      let draggingVol = false;
      volBar.addEventListener('mousedown', (e) => { e.stopPropagation(); draggingVol = true; setVolume(e.clientX); });
      window.addEventListener('mousemove', (e) => { if (draggingVol) setVolume(e.clientX); });
      window.addEventListener('mouseup', () => { draggingVol = false; });
      volBar.addEventListener('touchstart', (e) => { e.stopPropagation(); setVolume(e.touches[0].clientX); });
      volBar.addEventListener('touchmove', (e) => { setVolume(e.touches[0].clientX); });
    }

    // --- Fullscreen (the actual rightmost button) ---
    if (fullscreenBtn) {
      const requestFs = (el) =>
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
      const exitFs = () =>
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);

      fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fsElement) {
          requestFs(player);
        } else {
          exitFs();
        }
      });

      const syncFsIcon = () => {
        const isFs = document.fullscreenElement === player || document.webkitFullscreenElement === player;
        fullscreenBtn.innerHTML = isFs ? COLLAPSE_ICON : EXPAND_ICON;
      };
      document.addEventListener('fullscreenchange', syncFsIcon);
      document.addEventListener('webkitfullscreenchange', syncFsIcon);
    }
  });
});
