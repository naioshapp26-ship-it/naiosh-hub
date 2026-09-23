/**
 * صفحة آلية التشغيل — دليل تفاعلي: أزرار · كروت · Scroll · صلاحيات
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg) => {
    let el = document.getElementById('op-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'op-toast';
      el.className = 'op-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-on'), 3200);
  };

  const headerOffset = () => {
    const nav = document.querySelector('.top-nav');
    return Math.ceil((nav?.getBoundingClientRect().height || 72) + 12);
  };

  const highlight = (el) => {
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    clearTimeout(highlight._t);
    highlight._t = setTimeout(() => el.classList.remove('is-flash'), 1600);
  };

  const scrollToId = (rawId) => {
    const id = String(rawId || '').replace(/^#/, '');
    if (!id) return false;
    const target = document.getElementById(id);
    if (!target) return false;
    const preferReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset());
    window.scrollTo({ top, behavior: preferReduced ? 'auto' : 'smooth' });
    highlight(target);
    try {
      history.replaceState({}, '', `${location.pathname}${location.search}#${id}`);
    } catch {
      /* ignore */
    }
    clearTimeout(scrollToId._t);
    scrollToId._t = setTimeout(() => {
      const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset());
      if (Math.abs(window.scrollY - y) > 48) window.scrollTo({ top: y, behavior: 'auto' });
    }, preferReduced ? 0 : 420);
    return true;
  };

  const isStaffUser = () =>
    Boolean(window.HubAuth?.isStaff?.() || window.HubAuth?.isRegisteredEmployee?.());

  const isLoggedIn = () => Boolean(window.HubAuth?.isLoggedIn?.());

  const goStaff = (href) => {
    if (!isLoggedIn()) {
      const next = encodeURIComponent(href);
      toast('يرجى تسجيل الدخول بحساب إداري للمتابعة.');
      setTimeout(() => {
        window.location.href = `login.html?next=${next}`;
      }, 500);
      return;
    }
    if (!isStaffUser()) {
      toast('هذه الواجهة للإدارة فقط — حسابك الحالي لا يملك صلاحية الدخول.');
      return;
    }
    window.location.href = href;
  };

  const goLink = (href) => {
    if (!href) return;
    if (href.startsWith('#')) {
      scrollToId(href);
      return;
    }
    window.location.href = href;
  };

  // —— المبادئ الأحد عشر ككروت تفاعلية ——
  const principles = window.HubOperatingModel?.PRINCIPLES || [];
  const root = document.getElementById('op-principles');
  if (root) {
    root.innerHTML = principles
      .map((p) => {
        const target = p.target || '';
        const kind = p.kind || 'section';
        const tip =
          kind === 'staff'
            ? 'للإدارة'
            : kind === 'link'
              ? 'انتقال'
              : 'عرض التفاصيل';
        return `<button type="button" class="op-card is-interactive" data-op-card="${esc(p.id)}" data-op-kind="${esc(kind)}" data-op-target="${esc(target)}" aria-label="${esc(p.title)} — ${esc(tip)}">
          <div class="op-card-top">
            <span class="op-card-num">${p.id}</span>
            <i class="fas ${esc(p.icon)}" aria-hidden="true"></i>
            <h3>${esc(p.title)}</h3>
            <span class="op-card-go" aria-hidden="true"><i class="fas fa-arrow-left"></i></span>
          </div>
          <p class="summary">${esc(p.summary)}</p>
          <p class="detail">${esc(p.detail)}</p>
        </button>`;
      })
      .join('');
  }

  // —— أيقونات الأنظمة ——
  const sysGrid = document.getElementById('op-systems-grid');
  if (sysGrid && window.HubLauncher?.SYSTEM_META) {
    sysGrid.innerHTML = Object.entries(window.HubLauncher.SYSTEM_META)
      .map(([code, meta]) => {
        const href = window.HubLauncher.getDirectLaunchUrl(code);
        return `<button type="button" class="op-system-btn" data-launch-code="${esc(code)}" data-launch-mode="hub" aria-label="فتح نظام ${esc(meta.nameAr)}">
          <i class="fas ${esc(meta.icon)}" style="background:${esc(meta.color)}" aria-hidden="true"></i>
          <strong>${esc(meta.nameAr)}</strong>
          <small>${esc(code)} · ${esc(meta.domain)}</small>
        </button>
        <a class="sr-only" href="${esc(href)}">${esc(meta.nameAr)}</a>`;
      })
      .join('');
  }

  // —— خريطة الخدمات ——
  const map = document.getElementById('op-services-map');
  if (map && window.HubOperatingModel?.SYSTEM_SERVICES) {
    map.innerHTML = Object.entries(window.HubOperatingModel.SYSTEM_SERVICES)
      .map(([code, list]) => {
        const name = window.HubLauncher?.SYSTEM_META?.[code]?.nameAr || code;
        return `<article class="op-service-group" id="op-service-${esc(code.toLowerCase())}">
          <h3><i class="fas ${esc(window.HubLauncher?.SYSTEM_META?.[code]?.icon || 'fa-cube')}"></i> ${esc(name)} <small style="color:#9ca3af;font-weight:700">(${esc(code)})</small></h3>
          <div class="op-service-chips">
            ${list.map((s) => `<span><i class="fas ${esc(s.icon)}"></i> ${esc(s.nameAr)}</span>`).join('')}
          </div>
        </article>`;
      })
      .join('');
  }

  const openCard = (card) => {
    const kind = card.getAttribute('data-op-kind') || 'section';
    const target = card.getAttribute('data-op-target') || '';
    document.querySelectorAll('.op-card.is-active').forEach((el) => el.classList.remove('is-active'));
    card.classList.add('is-active');
    if (kind === 'staff') {
      goStaff(target);
      return;
    }
    if (kind === 'link') {
      goLink(target);
      return;
    }
    if (target.startsWith('#')) scrollToId(target);
    else goLink(target);
  };

  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-op-card]');
    if (card) {
      e.preventDefault();
      openCard(card);
      return;
    }

    const staffLink = e.target.closest('[data-op-staff]');
    if (staffLink) {
      e.preventDefault();
      goStaff(staffLink.getAttribute('href') || staffLink.dataset.opHref || '');
      return;
    }

    const sectionLink = e.target.closest('[data-op-section]');
    if (sectionLink) {
      e.preventDefault();
      const id = sectionLink.getAttribute('data-op-section') || sectionLink.getAttribute('href') || '';
      scrollToId(id);
      return;
    }

    const launch = e.target.closest('#op-systems-grid [data-launch-code]');
    if (launch) {
      e.preventDefault();
      const code = launch.dataset.launchCode;
      if (!window.HubLauncher?.launch) {
        toast('تعذر فتح النظام حاليًا.');
        return;
      }
      window.HubLauncher.launch(code, { mode: 'hub' });
    }
  });

  document.addEventListener('keydown', (e) => {
    const card = e.target.closest('[data-op-card]');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openCard(card);
      return;
    }
    const step = e.target.closest('[data-op-section]');
    if (step && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      scrollToId(step.getAttribute('data-op-section') || '');
    }
  });

  // Deep link on load
  const bootHash = String(location.hash || '').replace(/^#/, '');
  if (bootHash) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToId(bootHash));
    });
  }
})();
