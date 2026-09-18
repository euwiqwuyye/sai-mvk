// image-lightbox.js
// Click any gallery thumbnail to view it enlarged in an overlay.
// Includes next/prev navigation, click-outside-to-close, and Escape to close.
// Auto-detects gallery images by their wrapping div's style — no HTML edits needed.

document.addEventListener('DOMContentLoaded', () => {
  // Find every thumbnail: an <img> whose direct parent div is a masonry/gallery item
  // (identified by the "break-inside: avoid" style used on each gallery cell).
  const galleryImages = Array.from(document.querySelectorAll('div img')).filter((img) => {
    const parentStyle = img.parentElement.getAttribute('style') || '';
    return parentStyle.includes('break-inside: avoid');
  });

  if (galleryImages.length === 0) return;

  let currentIndex = 0;

  // --- Build the overlay once, reuse it for every image ---
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 40px;
    box-sizing: border-box;
  `;

  const bigImg = document.createElement('img');
  bigImg.style.cssText = `
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    position: absolute;
    top: 20px;
    right: 30px;
    background: none;
    border: none;
    color: #fff;
    font-size: 36px;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  `;

  const makeArrow = (direction) => {
    const btn = document.createElement('button');
    btn.innerHTML = direction === 'prev' ? '&#8249;' : '&#8250;';
    btn.style.cssText = `
      position: absolute;
      top: 50%;
      ${direction === 'prev' ? 'left: 20px;' : 'right: 20px;'}
      transform: translateY(-50%);
      background: rgba(0,0,0,0.4);
      border: none;
      color: #fff;
      font-size: 32px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      line-height: 1;
    `;
    return btn;
  };

  const prevBtn = makeArrow('prev');
  const nextBtn = makeArrow('next');

  overlay.appendChild(bigImg);
  overlay.appendChild(closeBtn);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);
  document.body.appendChild(overlay);

  const showImage = (index) => {
    currentIndex = (index + galleryImages.length) % galleryImages.length;
    bigImg.src = galleryImages[currentIndex].src;
    bigImg.alt = galleryImages[currentIndex].alt || '';
  };

  const openLightbox = (index) => {
    showImage(index);
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // prevent background scroll
  };

  const closeLightbox = () => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  };

  // Wire up each thumbnail
  galleryImages.forEach((img, index) => {
    img.addEventListener('click', () => openLightbox(index));
  });

  // Close when clicking the dark backdrop (but not the image itself)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLightbox();
  });

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => showImage(currentIndex - 1));
  nextBtn.addEventListener('click', () => showImage(currentIndex + 1));

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (overlay.style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
  });
});
