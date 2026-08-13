/**
 * واجهة Universal Discovery + Sector Command على صفحة المشاريع الجانبية
 */
(() => {
  'use strict';
  if (!document.body?.hasAttribute('data-side-projects-page') && !document.querySelector('[data-side-projects-page]')) {
    // still allow if section exists
  }
  const root = document.querySelector('[data-uso-root]');
  if (!root) return;

  const engine = window.HubUniversalOpportunityEngine;
  const lib = window.HubSectorLibrary;
  if (!engine || !lib) return;

  const esc = engine.esc;
  const discoveryOut = root.querySelector('[data-uso-results]');
  const sectorsEl = root.querySelector('[data-uso-sectors]');
  const statsEl = root.querySelector('[data-uso-stats]');
  const cycleEl = root.querySelector('[data-uso-cycle]');
  const input = root.querySelector('[data-uso-query]');
  const form = root.querySelector('[data-uso-form]');

  const gateClass = (status) => {
    if (status === 'READY') return 'is-ready';
    if (status === 'HIGH_RISK_RESTRICTED') return 'is-risk';
    return 'is-need';
  };

  const renderStats = () => {
    if (!statsEl) return;
    const s = engine.commandCenterStats();
    statsEl.innerHTML = `
      <article><strong>${s.sectors || 0}</strong><span>قطاعًا</span></article>
      <article><strong>${s.subSectors || 0}</strong><span>قطاعًا فرعيًا</span></article>
      <article><strong>${s.skills || 0}</strong><span>مهارة</span></article>
      <article><strong>${s.opportunities || 0}</strong><span>قالب فرصة</span></article>
      <article><strong>${s.combinations || 0}</strong><span>تقاطع قطاعي</span></article>
      <article><strong>${s.cycleSteps || 0}</strong><span>خطوة دورة</span></article>`;
  };

  const renderSectors = () => {
    if (!sectorsEl) return;
    sectorsEl.innerHTML = lib
      .list()
      .filter((s) => s.sectorId !== 'other')
      .map(
        (s) => `<button type="button" class="uso-sector-chip" data-uso-sector="${esc(s.sectorId)}">
          <i class="fas ${esc(s.icon || 'fa-industry')}"></i>
          <strong>${esc(s.sectorNameAr)}</strong>
          <small>${(s.opportunityTemplates || []).length} فرصة</small>
        </button>`
      )
      .join('');
  };

  const renderCycle = () => {
    if (!cycleEl) return;
    cycleEl.innerHTML = (lib.CYCLE || [])
      .map((step, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(step)}</li>`)
      .join('');
  };

  const renderResults = (payload) => {
    if (!discoveryOut) return;
    if (!payload) {
      discoveryOut.innerHTML = `<p class="uso-empty">اكتب جملة مثل: «لدي خبرة في صيانة المعدات وأريد مشروعًا جانبيًا»</p>`;
      return;
    }
    const sectors = (payload.sectors || [])
      .map(
        (s) => `<span class="uso-tag"><i class="fas ${esc(s.icon || 'fa-industry')}"></i> ${esc(s.nameAr)}</span>`
      )
      .join('');
    const cards = (payload.opportunities || [])
      .map((o) => {
        const sectorsLabel = o.sectorNamesAr?.length
          ? o.sectorNamesAr.join(' × ')
          : o.sectorNameAr || o.sectorId || 'متعدد';
        return `<article class="uso-card">
          <header>
            <strong>${esc(o.titleAr)}</strong>
            <em class="uso-confidence">${o.confidence || 0}%</em>
          </header>
          <p class="uso-meta">${esc(sectorsLabel)} · ${esc(o.type === 'cross-sector' ? 'تقاطع قطاعي' : 'قالب قطاعي')} · رأس مال ${esc(o.capital || '—')}</p>
          <p class="uso-skills">${(o.skills || []).map((x) => esc(x)).join(' · ') || '—'}</p>
          <div class="uso-gate ${gateClass(o.gate?.status)}">${esc(o.gate?.labelAr || o.gate?.status || '—')}</div>
          ${
            o.gate?.missing?.length
              ? `<small class="uso-missing">فجوة مهارات: ${o.gate.missing.map(esc).join(' · ')}</small>`
              : ''
          }
        </article>`;
      })
      .join('');
    discoveryOut.innerHTML = `
      <div class="uso-hit-sectors">${sectors || '<span class="uso-tag">اكتشف قطاعات من النص…</span>'}</div>
      <div class="uso-cards">${cards || '<p class="uso-empty">لا توجد فرص مطابقة — جرّب كلمات مهارات أو قطاع.</p>'}</div>`;
  };

  const run = (query) => {
    const profile = {
      skills: query,
      experience: 'متوسط',
    };
    const payload = engine.discover(query, profile);
    renderResults(payload);
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    run((input?.value || '').trim());
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-uso-sector]');
    if (!btn) return;
    const id = btn.getAttribute('data-uso-sector');
    const sector = lib.get(id);
    if (!sector) return;
    if (input) input.value = `${sector.sectorNameAr} ${(sector.skills || []).slice(0, 3).join(' ')}`;
    run(input.value);
  });

  const publishForm = root.querySelector('[data-uso-publish]');
  publishForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(publishForm);
    const sectorId = String(fd.get('sectorId') || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const sectorNameAr = String(fd.get('sectorNameAr') || '').trim();
    const skills = String(fd.get('skills') || '')
      .split(/[,،]/)
      .map((x) => x.trim())
      .filter(Boolean);
    const templatesRaw = String(fd.get('template') || '').trim();
    try {
      engine.publishSector({
        sectorId,
        sectorNameAr,
        sectorName: String(fd.get('sectorNameEn') || sectorNameAr).trim(),
        icon: 'fa-layer-group',
        skills,
        subSectors: String(fd.get('subSectors') || '')
          .split(/[,،]/)
          .map((x) => x.trim())
          .filter(Boolean),
        opportunityTemplates: templatesRaw
          ? [
              {
                id: `${sectorId}-tpl-1`,
                titleAr: templatesRaw,
                skills: skills.slice(0, 3),
                resources: [],
                risk: 'متوسط',
                capital: 'منخفض',
              },
            ]
          : [],
      });
      publishForm.reset();
      renderStats();
      renderSectors();
      const msg = root.querySelector('[data-uso-publish-msg]');
      if (msg) {
        msg.hidden = false;
        msg.textContent = `تم نشر القطاع «${sectorNameAr}» دون تعديل نواة المحرك.`;
      }
    } catch (err) {
      alert(err.message || 'تعذر نشر القطاع');
    }
  });

  renderStats();
  renderSectors();
  renderCycle();
  renderResults(null);
})();
