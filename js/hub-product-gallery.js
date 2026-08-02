(() => {
  const track = document.getElementById('hub-gallery-track');
  const prev = document.getElementById('hub-gallery-prev');
  const next = document.getElementById('hub-gallery-next');
  if (!track) return;

  const step = () => {
    const card = track.querySelector('.hub-gallery-shot');
    return card ? card.getBoundingClientRect().width + 16 : 260;
  };

  const updateButtons = () => {
    const max = track.scrollWidth - track.clientWidth - 4;
    const x = Math.abs(track.scrollLeft);
    // RTL: scrollLeft may be 0 at start or negative depending on browser
    const atStart = track.scrollLeft === 0 || (track.scrollLeft <= 2 && track.scrollLeft >= -2);
    const atEnd = x >= max || track.scrollLeft <= -max + 2;
    if (prev) prev.disabled = atStart && track.scrollLeft >= -2;
    if (next) next.disabled = false;
    // Safer: enable both unless no overflow
    if (track.scrollWidth <= track.clientWidth + 4) {
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  };

  prev?.addEventListener('click', () => {
    track.scrollBy({ left: step(), behavior: 'smooth' });
  });
  next?.addEventListener('click', () => {
    track.scrollBy({ left: -step(), behavior: 'smooth' });
  });

  track.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('resize', updateButtons);
  updateButtons();
})();
