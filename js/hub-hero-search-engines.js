/**
 * كروت محركات البحث في هيرو الرئيسية
 * نايوش = بحث داخلي | Google = CSE رسمي
 */
(() => {
  'use strict';

  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const googleSvg = `<svg class="hero-g-logo" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.2 44 32.5 44 24c0-1.3-.1-2.5-.4-3.5z"/>
  </svg>`;

  const mount = () => {
    const frame = document.querySelector('.hero-media-frame');
    if (!frame || frame.dataset.searchEnginesReady === '1') return;
    frame.dataset.searchEnginesReady = '1';

    // remove legacy single float card if present
    const legacy = document.getElementById('hero-float-card');
    if (legacy) legacy.remove();

    const g = window.HubGoogleSearchConfig?.getGoogle?.() || {};
    const googleOn = window.HubGoogleSearchConfig?.isEnabled?.() !== false;

    const row = document.createElement('div');
    row.className = 'hero-search-engines';
    row.setAttribute('data-hero-search-engines', '');
    row.setAttribute('aria-label', 'محركات البحث');

    const naiosh = `
      <a class="hero-float-card is-search-trigger" id="hero-naiosh-search-card" href="search.html" aria-label="محرك بحث نايوش — داخل المنظومة">
        <div class="hero-float-icon" aria-hidden="true"><i class="fas fa-magnifying-glass"></i></div>
        <div class="hero-float-body">
          <strong class="hero-float-title">محرك بحث نايوش</strong>
          <span class="hero-float-desc">ابحث داخل محتوى ومنظومة نايوش</span>
        </div>
      </a>`;

    const googleCard = googleOn
      ? `<div class="hero-float-card is-google-search" id="hero-google-search-card" data-google-search-card>
          <button type="button" class="hero-google-hit" data-google-expand aria-expanded="false" aria-controls="hero-google-panel">
            <span class="hero-float-icon is-google" aria-hidden="true">${googleSvg}</span>
            <span class="hero-float-body">
              <strong class="hero-float-title">${esc(g.cardTitle || 'محرك بحث Google')}</strong>
              <span class="hero-float-desc">${esc(g.cardDescription || 'ابحث على الويب باستخدام Google')}</span>
            </span>
          </button>
          <form class="hero-google-panel" id="hero-google-panel" data-google-panel hidden>
            <label class="hero-google-field">
              <span class="visually-hidden">ابحث باستخدام Google</span>
              <input type="search" name="q" data-google-input placeholder="ابحث باستخدام Google..." autocomplete="off" />
              <button type="submit" class="hero-google-go" aria-label="بحث في Google"><i class="fas fa-magnifying-glass"></i></button>
            </label>
          </form>
        </div>`
      : '';

    row.innerHTML = naiosh + googleCard;
    frame.appendChild(row);

    const card = row.querySelector('[data-google-search-card]');
    if (!card) return;

    const expandBtn = card.querySelector('[data-google-expand]');
    const panel = card.querySelector('[data-google-panel]');
    const input = card.querySelector('[data-google-input]');
    const form = card.querySelector('form');

    expandBtn?.addEventListener('click', () => {
      const open = panel?.hidden === false;
      if (panel) panel.hidden = open;
      expandBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      card.classList.toggle('is-expanded', !open);
      if (!open) setTimeout(() => input?.focus(), 30);
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = String(input?.value || '').trim();
      if (!q) {
        input?.focus();
        return;
      }
      const url = window.HubGoogleSearchConfig?.resultsUrl?.(q) || `google-search.html?q=${encodeURIComponent(q)}`;
      location.href = url;
    });
  };

  const boot = () => {
    if (!document.body?.classList.contains('homepage') && !document.querySelector('.hero-media-frame')) return;
    mount();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('hub-site-settings-changed', () => {
    const frame = document.querySelector('.hero-media-frame');
    if (!frame) return;
    frame.dataset.searchEnginesReady = '';
    frame.querySelector('[data-hero-search-engines]')?.remove();
    mount();
  });

  window.HubHeroSearchEngines = { mount };
})();
