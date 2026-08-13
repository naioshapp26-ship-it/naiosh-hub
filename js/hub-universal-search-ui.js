/**
 * UI: الزر الأبيض في الهيرو → محرك البحث الشامل
 */
(() => {
  'use strict';

  const searchApi = window.HubUniversalSearch;
  if (!searchApi) return;

  const esc = searchApi.esc;
  let filter = 'all';
  let open = false;

  const ensureModal = () => {
    let modal = document.getElementById('hub-universal-search-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'hub-universal-search-modal';
    modal.className = 'hus-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="hus-backdrop" data-hus-close tabindex="-1"></div>
      <div class="hus-panel" role="dialog" aria-modal="true" aria-labelledby="hus-title">
        <header class="hus-head">
          <div>
            <h2 id="hus-title"><i class="fas fa-magnifying-glass"></i> محرك البحث الشامل</h2>
            <p>ابحث في مسميات وتصنيفات الحاضنات والمنصات والأنظمة</p>
          </div>
          <button type="button" class="hus-close" data-hus-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        </header>
        <div class="hus-stats" data-hus-stats></div>
        <div class="hus-toolbar">
          <label class="hus-input-wrap">
            <i class="fas fa-magnifying-glass"></i>
            <input type="search" data-hus-input placeholder="مثال: تعليم · UOS · فيت · تسويق رقمي…" autocomplete="off" />
          </label>
          <div class="hus-filters" role="tablist" aria-label="تصفية النوع">
            <button type="button" class="is-active" data-hus-filter="all">الكل</button>
            <button type="button" data-hus-filter="incubator">حاضنات</button>
            <button type="button" data-hus-filter="platform">منصات</button>
            <button type="button" data-hus-filter="system">أنظمة</button>
          </div>
        </div>
        <div class="hus-results" data-hus-results></div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  };

  const typeBadge = (type) => {
    if (type === 'incubator') return 'حاضنة';
    if (type === 'platform') return 'منصة';
    return 'نظام';
  };

  const renderStats = (modal) => {
    const s = searchApi.stats();
    const el = modal.querySelector('[data-hus-stats]');
    if (!el) return;
    el.innerHTML = `
      <article><strong>${s.all}</strong><span>إجمالي</span></article>
      <article><strong>${s.incubator}</strong><span>حاضنة</span></article>
      <article><strong>${s.platform}</strong><span>منصة</span></article>
      <article><strong>${s.system}</strong><span>نظام</span></article>`;
  };

  const renderResults = (modal, query) => {
    const list = searchApi.search(query, filter);
    const box = modal.querySelector('[data-hus-results]');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = `<p class="hus-empty">لا نتائج — جرّب اسم حاضنة أو كود منصة أو نظام.</p>`;
      return;
    }
    box.innerHTML = list
      .slice(0, 80)
      .map(
        (item) => `<a class="hus-item" href="${esc(item.href)}">
          <span class="hus-item-ico"><i class="fas ${esc(item.icon)}"></i></span>
          <span class="hus-item-body">
            <strong>${esc(item.title)}</strong>
            <small>${esc(item.subtitle)}</small>
          </span>
          <span class="hus-item-meta">
            <em class="hus-badge hus-badge-${esc(item.type)}">${esc(item.typeAr || typeBadge(item.type))}</em>
            <code>${esc(item.meta || '')}</code>
          </span>
        </a>`
      )
      .join('');
  };

  const setOpen = (next) => {
    const modal = ensureModal();
    open = next;
    modal.hidden = !open;
    document.body.classList.toggle('hus-open', open);
    if (open) {
      renderStats(modal);
      const input = modal.querySelector('[data-hus-input]');
      renderResults(modal, input?.value || '');
      setTimeout(() => input?.focus(), 50);
    }
  };

  const wireModal = () => {
    const modal = ensureModal();
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-hus-close]')) setOpen(false);
      const filterBtn = e.target.closest('[data-hus-filter]');
      if (filterBtn) {
        filter = filterBtn.getAttribute('data-hus-filter') || 'all';
        modal.querySelectorAll('[data-hus-filter]').forEach((b) => b.classList.toggle('is-active', b === filterBtn));
        renderResults(modal, modal.querySelector('[data-hus-input]')?.value || '');
      }
    });
    modal.querySelector('[data-hus-input]')?.addEventListener('input', (e) => {
      renderResults(modal, e.target.value || '');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    });
  };

  const upgradeFloatCard = () => {
    const card = document.getElementById('hero-float-card');
    if (!card) return;

    card.classList.add('is-search-trigger');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'محرك البحث الشامل — حاضنات ومنصات وأنظمة');
    card.innerHTML = `
      <div class="hero-float-icon" aria-hidden="true"><i class="fas fa-magnifying-glass"></i></div>
      <div class="hero-float-body">
        <strong class="hero-float-title">محرك البحث الشامل</strong>
        <span class="hero-float-desc">حاضنات · منصات · أنظمة</span>
      </div>`;

    const openSearch = (e) => {
      e.preventDefault();
      setOpen(true);
    };
    card.addEventListener('click', openSearch);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openSearch(e);
    });
  };

  const init = () => {
    wireModal();
    upgradeFloatCard();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
