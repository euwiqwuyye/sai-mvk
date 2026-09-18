// click-to-continue.js
// Fades out the #click-to-continue intro overlay on the visitor's first
// click/tap/keypress anywhere on the page, then removes it.

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('click-to-continue');
  if (!overlay) return;

  // Block scrolling behind the overlay while it's up
  document.body.style.overflow = 'hidden';

  // Keep the background music from starting until the overlay is gone,
  // no matter what other script tries to start it (or when). If anything
  // calls .play() early, this pauses it right back — the moment the
  // overlay is dismissed, the guard is dropped and playback is started
  // for real.
  const bgAudio = document.querySelector('audio[src*="6LACK-Free.mp3"]');
  const blockEarlyPlay = () => bgAudio.pause();
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.addEventListener('play', blockEarlyPlay);
  }

  const dismiss = () => {
    overlay.style.transition = 'opacity 0.4s';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, 400);
    ['click', 'touchstart', 'keydown'].forEach((evt) =>
      document.removeEventListener(evt, dismiss)
    );

    if (bgAudio) {
      bgAudio.removeEventListener('play', blockEarlyPlay);
      bgAudio.play().catch((err) => console.warn('Play blocked:', err));
    }
  };

  ['click', 'touchstart', 'keydown'].forEach((evt) =>
    document.addEventListener(evt, dismiss, { once: false })
  );
});
