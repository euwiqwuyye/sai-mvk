// video-zoom.js
// Adds scroll-to-zoom (anchored to the cursor) + drag-to-pan on desktop,
// and pinch-to-zoom + smooth two-finger pan on touch — but ONLY while the
// video's existing custom fullscreen (from video-player.js) is active.
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
    let lastMidX = 0, lastMidY = 0;

    // Cached un-transformed video box (scale=1, tx=0, ty=0). Reading this
    // via getBoundingClientRect() on every touchmove would force a layout
    // reflow mid-gesture and cause jank, so we measure it once and derive
    // everything else from tx/ty/scale math instead.
    let baseRect = null;
    const getBaseRect = () => {
      if (!baseRect) baseRect = video.getBoundingClientRect();
      return baseRect;
    };
    const invalidateBaseRect = () => { baseRect = null; };

    const isFsActive = () =>
      document.fullscreenElement === player || document.webkitFullscreenElement === player;

    const apply = () => {
      video.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      player.classList.toggle('vz-zoomed', scale > 1);
    };

    const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };

    const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

    // Single-point zoom anchor: keeps the content under (clientX, clientY)
    // fixed on screen while scale changes. Used for wheel + double-click.
    const zoomAt = (clientX, clientY, newScale) => {
      const rect = getBaseRect();
      newScale = clampScale(newScale);
      const localX = (clientX - rect.left - tx) / scale;
      const localY = (clientY - rect.top - ty) / scale;
      tx = clientX - rect.left - localX * newScale;
      ty = clientY - rect.top - localY * newScale;
      scale = newScale;
      if (scale <= 1) { reset(); return; }
      apply();
    };

    // Two-point pan+zoom anchor: the content that was under (prevX, prevY)
    // moves to (curX, curY) as scale changes to newScale — this is what
    // makes two-finger pinch and pan blend smoothly into one gesture
    // instead of only zooming toward a fixed spot.
    const panZoomAnchored = (prevX, prevY, curX, curY, newScale) => {
      const rect = getBaseRect();
      newScale = clampScale(newScale);
      const localX = (prevX - rect.left - tx) / scale;
      const localY = (prevY - rect.top - ty) / scale;
      tx = curX - rect.left - localX * newScale;
      ty = curY - rect.top - localY * newScale;
      scale = newScale;
      if (scale <= 1) { reset(); return; }
      apply();
    };

    // --- Desktop: scroll wheel to zoom toward the cursor ---
    player.addEventListener('wheel', (e) => {
      if (!isFsActive()) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0025 * scale;
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

    // --- Touch: pinch to zoom + pan together, one-finger drag to pan ---
    // (Only reachable where standard fullscreen is used, e.g. Android/iPad)
    player.addEventListener('touchstart', (e) => {
      if (!isFsActive()) return;
      if (e.touches.length === 2) {
        isPanning = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy) || 1;
        pinchStartScale = scale;
        lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      } else if (e.touches.length === 1) {
        isPanning = scale > 1;
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
        const dist = Math.hypot(dx, dy) || 1;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const newScale = pinchStartScale * (dist / pinchStartDist);
        panZoomAnchored(lastMidX, lastMidY, midX, midY, newScale);
        lastMidX = midX;
        lastMidY = midY;
      } else if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        tx += e.touches[0].clientX - lastX;
        ty += e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        apply();
      }
    }, { passive: false });

    // If a finger is lifted mid-gesture (2 -> 1) rebase instead of stopping,
    // so the transition from pinching to one-finger panning is seamless.
    const handleTouchReduce = (e) => {
      if (!isFsActive()) return;
      if (e.touches.length === 1) {
        isPanning = scale > 1;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        isPanning = false;
      }
    };
    player.addEventListener('touchend', handleTouchReduce);
    player.addEventListener('touchcancel', handleTouchReduce);

    // --- Reset zoom whenever fullscreen is exited, and re-measure the
    // base rect on any change that could move/resize the player ---
    const onFsChange = () => {
      invalidateBaseRect();
      if (!isFsActive()) reset();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    window.addEventListener('resize', invalidateBaseRect);
    window.addEventListener('orientationchange', invalidateBaseRect);
  });
});
