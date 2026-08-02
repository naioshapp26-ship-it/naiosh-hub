(() => {
  const toTop = document.getElementById('to-top');
  toTop?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  const homeGrid = document.getElementById('home-platforms-grid');
  if (homeGrid && window.HubSovereignPlatforms?.list) {
    homeGrid.innerHTML = window.HubSovereignPlatforms.list
      .map(
        (p) => `<article class="hub-platform-card" id="plat-${p.code.toLowerCase()}">
          <span class="platform-code">${p.code}</span>
          <div class="icon-box"><i class="fas ${p.icon}"></i></div>
          <h3>${p.nameAr}</h3>
          <p><strong>${p.role}</strong> — ${p.desc}</p>
        </article>`
      )
      .join('');
  }

  document.getElementById('join-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const feedback = document.getElementById('join-feedback');
    if (feedback) {
      feedback.textContent = 'تم إرسال طلب الانضمام بنجاح، وسيتم التواصل معك قريبًا.';
      feedback.removeAttribute('hidden');
    }
    form.reset();
  });

  document.getElementById('newsletter-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const feedback = document.getElementById('newsletter-feedback');
    if (feedback) {
      feedback.textContent = 'تم الاشتراك في التقارير السيادية بنجاح.';
      feedback.removeAttribute('hidden');
    }
    form.reset();
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealSelector = [
    '#layers > section',
    '#layers .card',
    '#layers .tour-form-card',
    '#layers .tour-image-card',
    '#layers .newsletter-section',
    '#layers .imperial-strip',
    '#platforms-home .hub-platform-card',
    '.site-footer-inner > section',
  ].join(', ');
  const revealTargets = document.querySelectorAll(revealSelector);
  const staggerByParent = new WeakMap();
  revealTargets.forEach((el) => {
    const parent = el.parentElement;
    const parentCount = parent ? (staggerByParent.get(parent) || 0) : 0;
    const delay = Math.min(parentCount * 55, 330);
    el.classList.add('reveal-on-scroll');
    el.style.setProperty('--reveal-delay', `${delay}ms`);
    if (parent) staggerByParent.set(parent, parentCount + 1);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach((el) => observer.observe(el));
  }

  const stats = document.querySelectorAll('.law-hero-stats strong, .hero-stats .stat strong');
  if (stats.length && !reduceMotion && 'IntersectionObserver' in window) {
    const animateStat = (el) => {
      const target = Number((el.textContent || '').replace(/[^\d]/g, ''));
      if (!Number.isFinite(target)) return;
      const start = performance.now();
      const duration = 1200;
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    };
    const obs = new IntersectionObserver(
      (entries, o) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateStat(entry.target);
          o.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );
    stats.forEach((el) => obs.observe(el));
  }
})();
