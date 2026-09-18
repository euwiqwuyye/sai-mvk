// click-to-continue.js
// Fades out the #click-to-continue intro overlay on the visitor's first
// click/tap/keypress anywhere on the page, then removes it.

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('click-to-continue');
  if (!overlay) return;

  // Block scrolling behind the overlay while it's up
  document.body.style.overflow = 'hidden';

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
  };

  ['click', 'touchstart', 'keydown'].forEach((evt) =>
    document.addEventListener(evt, dismiss, { once: false })
  );
});
