// video-zoom.js
// Adds scroll-to-zoom (anchored to the cursor) + drag-to-pan on desktop,
// and pinch-to-zoom + drag-to-pan on touch — but ONLY while the video's
// existing custom fullscreen (from video-player.js) is active.
//
// NOTE ON iOS: iOS Safari's fallback fullscreen (video.webkitEnterFullscreen)
// hands the video off to Apple's native player UI, which JS cannot draw on
// top of or capture touches from. Zoom will not work in that native iOS
// fullscreen mode — that's a platform restriction, not a bug here. It DOES
// work on desktop, Android, and iPad/Safari 16.4+, which all use standard
// element fullscreen (the same one video-player.js requests on `player`).

document.addEventListener('DOMContentLoaded', () => {
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  document.querySelectorAll('video').forEach((video) => {
    const player = video.parentElement;
    if (!player) return;

    video.style.transformOrigin = '0 0';
    video.style.willChange = 'transform';

    let scale = 1, tx = 0, ty = 0;
    let isPanning = false;
    let lastX = 0, lastY = 0;
    let pinchStartDist = 0, pinchStartScale = 1;

    const isFsActive = () =>
      document.fullscreenElement === player || document.webkitFullscreenElement === player;

    const apply = () => {
      video.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      player.classList.toggle('vz-zoomed', scale > 1);
    };

    const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };

    // Zooms toward (clientX, clientY) — the classic "keep the point under
    // the cursor/fingers fixed on screen while scale changes" formula.
    const zoomAt = (clientX, clientY, newScale) => {
      const rect = video.getBoundingClientRect();
      const localX = (clientX - rect.left) / scale;
      const localY = (clientY - rect.top) / scale;
      newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      tx -= localX * (newScale - scale);
      ty -= localY * (newScale - scale);
      scale = newScale;
      if (scale <= 1) { reset(); return; }
      apply();
    };

    // --- Desktop: scroll wheel to zoom toward the cursor ---
    player.addEventListener('wheel', (e) => {
      if (!isFsActive()) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0025 * scale; // scales with current zoom for a smoother feel
      zoomAt(e.clientX, e.clientY, scale + delta);
    }, { passive: false });

    // --- Desktop: click-drag to pan while zoomed ---
    player.addEventListener('mousedown', (e) => {
      if (!isFsActive() || scale <= 1) return;
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      player.classList.add('vz-panning');
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    });
    window.addEventListener('mouseup', () => {
      isPanning = false;
      player.classList.remove('vz-panning');
    });

    // --- Desktop: double-click to zoom in on that spot / reset ---
    player.addEventListener('dblclick', (e) => {
      if (!isFsActive()) return;
      if (scale > 1) reset();
      else zoomAt(e.clientX, e.clientY, 2.5);
    });

    // --- Touch: pinch to zoom, one-finger drag to pan ---
    // (Only reachable where standard fullscreen is used, e.g. Android)
    player.addEventListener('touchstart', (e) => {
      if (!isFsActive()) return;
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        isPanning = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    }, { passive: true });

    player.addEventListener('touchmove', (e) => {
      if (!isFsActive()) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAt(midX, midY, pinchStartScale * (dist / pinchStartDist));
      } else if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        tx += e.touches[0].clientX - lastX;
        ty += e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        apply();
      }
    }, { passive: false });

    player.addEventListener('touchend', () => { isPanning = false; });

    // --- Reset zoom whenever fullscreen is exited ---
    const onFsChange = () => { if (!isFsActive()) reset(); };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
  });
});
