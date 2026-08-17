/**
 * NAIOSH GLOBAL OPERATING SYSTEM — واجهة المعمارية والسجل والتكامل والذكاء
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-global-os]');
  const data = window.HubGlobalOsData;
  if (!root || !data) return;

  const EVENT_KEY = 'naiosh_integration_events_v1';
  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const tabs = root.querySelectorAll('[data-gos-tab]');
  const panels = root.querySelectorAll('[data-gos-panel]');
  const toastEl = document.getElementById('gos-toast');

  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
  };

  const activate = (id) => {
    tabs.forEach((t) => t.classList.toggle('is-active', t.getAttribute('data-gos-tab') === id));
    panels.forEach((p) => {
      const on = p.getAttribute('data-gos-panel') === id;
      p.hidden = !on;
    });
    if (location.hash.replace('#', '') !== id) {
      history.replaceState(null, '', `#${id}`);
    }
  };

  const readEvents = () => {
    try {
      return JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const writeEvents = (list) => localStorage.setItem(EVENT_KEY, JSON.stringify(list.slice(0, 80)));

  const tierLabel = (t) =>
    ({ 1: 'Tier 1 — Core', 2: 'Tier 2 — Strategic', 3: 'Tier 3 — Specialized', 4: 'Tier 4 — Support' }[t] || `Tier ${t}`);

  const statusLabel = (s) =>
    ({ ready: 'جاهز للإطلاق', integrate: 'يحتاج تكامل', reengineer: 'يحتاج إعادة هندسة' }[s] || s);

  const paintStats = () => {
    const el = root.querySelector('[data-gos-stats]');
    if (!el) return;
    const ready = data.systems.filter((s) => s.status === 'ready').length;
    const core = data.systems.filter((s) => s.tier === 1).length;
    el.innerHTML = `
      <article><strong>${data.systems.length}</strong><span>نظام في السجل</span></article>
      <article><strong>${data.layers.length}</strong><span>طبقة معمارية</span></article>
      <article><strong>${core}</strong><span>محرك Core</span></article>
      <article><strong>${ready}</strong><span>جاهز / مرتفع الجاهزية</span></article>
      <article><strong>${data.coreServices.length}</strong><span>مكوّن مشترك</span></article>
      <article><strong>${data.events.length}</strong><span>حدث موحّد</span></article>`;
  };

  const paintArchitecture = () => {
    const el = root.querySelector('[data-gos-layers]');
    if (!el) return;
    el.innerHTML = data.layers
      .map(
        (l) => `<article class="gos-card">
        <span class="gos-n">${l.n}</span>
        <h3>${esc(l.en)}</h3>
        <strong>${esc(l.ar)}</strong>
        <p>${esc(l.desc)}</p>
      </article>`
      )
      .join('');

    const docs = root.querySelector('[data-gos-docs]');
    if (docs) {
      docs.innerHTML = data.architectureDocs
        .map((d) => `<a class="gos-doc" href="${esc(d.href)}"><span>${esc(d.code)}</span>${esc(d.title)}</a>`)
        .join('');
    }

    const order = root.querySelector('[data-gos-order]');
    if (order) {
      order.innerHTML = data.executionOrder
        .map((s) => `<li><strong>${s.n}. ${esc(s.title)}</strong><span>${esc(s.desc)}</span></li>`)
        .join('');
    }

    const gate = root.querySelector('[data-gos-gate]');
    if (gate) {
      gate.innerHTML = data.gate.map((g) => `<li>${esc(g)}</li>`).join('');
    }
  };

  const paintRegister = () => {
    const filter = root.querySelector('[data-gos-tier]')?.value || '';
    const q = (root.querySelector('[data-gos-search]')?.value || '').trim().toLowerCase();
    let list = data.systems.slice();
    if (filter) list = list.filter((s) => String(s.tier) === filter);
    if (q) {
      list = list.filter((s) => `${s.code} ${s.nameAr} ${s.nameEn} ${s.domain}`.toLowerCase().includes(q));
    }
    const grid = root.querySelector('[data-gos-register]');
    if (!grid) return;
    grid.innerHTML = list
      .map((s) => {
        const ints = Object.entries(s.integrations || {})
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(' · ');
        return `<article class="gos-sys" data-sys="${esc(s.code)}">
          <header>
            <span class="gos-code">${esc(s.code)}</span>
            <span class="gos-tier">${esc(tierLabel(s.tier))}</span>
            <span class="gos-score">${s.readiness}/100</span>
          </header>
          <h3>${esc(s.nameAr)}</h3>
          <small>${esc(s.nameEn)} · ${esc(s.domain)}</small>
          <p>${esc(s.goal)}</p>
          <div class="gos-meta">
            <span>${esc(statusLabel(s.status))}</span>
            <span>${esc(ints || 'hub')}</span>
          </div>
          <div class="gos-actions">
            <a class="btn btn-primary" href="${esc(s.href)}">فتح</a>
            <button type="button" class="btn btn-secondary" data-gos-detail="${esc(s.code)}">بطاقة النظام</button>
          </div>
        </article>`;
      })
      .join('');
  };

  const showDetail = (code) => {
    const s = data.systems.find((x) => x.code === code);
    const box = root.querySelector('[data-gos-detail]');
    if (!s || !box) return;
    box.hidden = false;
    box.innerHTML = `
      <div class="gos-detail-head">
        <h3>${esc(s.code)} — ${esc(s.nameAr)}</h3>
        <button type="button" class="btn btn-secondary" data-gos-close-detail>إغلاق</button>
      </div>
      <div class="gos-detail-grid">
        <div><span>الهدف</span><strong>${esc(s.goal)}</strong></div>
        <div><span>المالك</span><strong>${esc(s.owner)}</strong></div>
        <div><span>التصنيف</span><strong>${esc(tierLabel(s.tier))}</strong></div>
        <div><span>المجال</span><strong>${esc(s.domain)}</strong></div>
        <div><span>الجاهزية</span><strong>${s.readiness}/100 — ${esc(statusLabel(s.status))}</strong></div>
        <div><span>يعتمد على</span><strong>${esc((s.dependsOn || []).join(' · ') || '—')}</strong></div>
        <div><span>يعتمد عليه</span><strong>${esc((s.dependents || []).slice(0, 12).join(' · ') || '—')}</strong></div>
        <div><span>التكاملات</span><strong>${esc(
          Object.entries(s.integrations || {})
            .map(([k, v]) => `${k}:${v ? '✓' : '—'}`)
            .join(' · ')
        )}</strong></div>
      </div>
      <p class="gos-note">قاعدة الاعتماد: لا تطوير/إعادة هندسة قبل مراجعة البطاقة والتكاملات وعدم تكرار وظيفة مركزية.</p>
      <a class="btn btn-primary" href="${esc(s.href)}">تشغيل / فتح المكوّن</a>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const paintMatrices = () => {
    const dep = root.querySelector('[data-gos-dep]');
    if (dep) {
      dep.innerHTML = data.systems
        .filter((s) => s.dependents.length)
        .slice(0, 18)
        .map(
          (s) => `<tr>
          <td>${esc(s.code)}</td>
          <td>${esc(s.nameAr)}</td>
          <td>${esc((s.dependsOn || []).join(', ') || '—')}</td>
          <td>${esc(s.dependents.slice(0, 8).join(', '))}${s.dependents.length > 8 ? '…' : ''}</td>
        </tr>`
        )
        .join('');
    }

    const integ = root.querySelector('[data-gos-integ]');
    if (integ) {
      const keys = ['hub', 'erp', 'crm', 'marketing', 'ai', 'knowledge', 'data', 'workflow'];
      integ.innerHTML =
        `<tr><th>النظام</th>${keys.map((k) => `<th>${esc(k)}</th>`).join('')}</tr>` +
        data.systems
          .map((s) => {
            const i = s.integrations || {};
            return `<tr><td>${esc(s.code)} ${esc(s.nameAr)}</td>${keys
              .map((k) => `<td class="${i[k] ? 'yes' : 'no'}">${i[k] ? '✓' : '—'}</td>`)
              .join('')}</tr>`;
          })
          .join('');
    }

    const dup = root.querySelector('[data-gos-dup]');
    if (dup) {
      dup.innerHTML = data.duplicationHints
        .map(
          (d) => `<article class="gos-card">
          <h3>${esc(d.fn)}</h3>
          <p><strong>خطأ:</strong> ${esc(d.wrong)}</p>
          <p><strong>الصحيح:</strong> ${esc(d.right)}</p>
        </article>`
        )
        .join('');
    }

    const own = root.querySelector('[data-gos-own]');
    if (own) {
      own.innerHTML = data.dataDictionary
        .map(
          (d) => `<tr>
          <td>${esc(d.entity)}</td>
          <td>${esc(d.owner)}</td>
          <td>${esc(d.type)}</td>
          <td>${esc(d.writers.join(' · '))}</td>
          <td>${esc(d.readers.join(' · '))}</td>
        </tr>`
        )
        .join('');
    }
  };

  const paintIntegration = () => {
    const cat = root.querySelector('[data-gos-events-cat]');
    if (cat) {
      cat.innerHTML = data.events
        .map(
          (e) => `<button type="button" class="gos-chip" data-gos-emit="${esc(e.code)}">
          <strong>${esc(e.code)}</strong>
          <span>${esc(e.systems.join(' → '))}</span>
        </button>`
        )
        .join('');
    }
    paintEventLog();
  };

  const paintEventLog = () => {
    const log = root.querySelector('[data-gos-event-log]');
    if (!log) return;
    const list = readEvents();
    log.innerHTML = list.length
      ? list
          .map(
            (e) => `<li>
            <strong>${esc(e.code)}</strong>
            <span>${esc(e.targets?.join(' · ') || '')}</span>
            <small>${esc(new Date(e.at).toLocaleString('en-US'))}</small>
          </li>`
          )
          .join('')
      : '<li class="gos-empty">لا أحداث بعد — أطلق حدثًا من الكتالوج لتجربة Event Bus.</li>';
  };

  const emitEvent = (code) => {
    const def = data.events.find((e) => e.code === code);
    if (!def) return;
    const list = readEvents();
    list.unshift({
      code: def.code,
      targets: def.systems,
      at: new Date().toISOString(),
    });
    writeEvents(list);
    paintEventLog();
    toast(`Event: ${def.code}`);
  };

  const paintAi = () => {
    const el = root.querySelector('[data-gos-ai]');
    if (!el) return;
    el.innerHTML = data.aiLevels
      .map(
        (a) => `<article class="gos-card">
        <span class="gos-n">${a.n}</span>
        <h3>${esc(a.title)}</h3>
        <strong>${esc(a.ar)}</strong>
        <p>${esc(a.desc)}</p>
      </article>`
      )
      .join('');

    const hitl = root.querySelector('[data-gos-hitl]');
    if (hitl) {
      hitl.innerHTML = `
        <article class="gos-hitl green"><strong>Green</strong><p>AI ينفّذ تلقائيًا ضمن حدود آمنة.</p></article>
        <article class="gos-hitl yellow"><strong>Yellow</strong><p>AI يقترح والموظف يعتمد.</p></article>
        <article class="gos-hitl red"><strong>Red</strong><p>موافقة بشرية متعددة — مالية · عقود · صلاحيات · قانون.</p></article>`;
    }
  };

  const paintData = () => {
    const el = root.querySelector('[data-gos-dict]');
    if (!el) return;
    el.innerHTML = data.dataDictionary
      .map(
        (d) => `<article class="gos-card">
        <h3>${esc(d.entity)}</h3>
        <p><strong>Master Source:</strong> ${esc(d.owner)}</p>
        <p><strong>النوع:</strong> ${esc(d.type)}</p>
        <p><strong>تعديل:</strong> ${esc(d.writers.join(' · '))}</p>
        <p><strong>قراءة:</strong> ${esc(d.readers.join(' · '))}</p>
      </article>`
      )
      .join('');
  };

  const paintCore = () => {
    const el = root.querySelector('[data-gos-core]');
    if (!el) return;
    el.innerHTML = data.coreServices.map((c) => `<li>${esc(c)}</li>`).join('');
  };

  const paintErp = () => {
    const el = root.querySelector('[data-gos-erp]');
    if (!el) return;
    el.innerHTML = data.erpLayers
      .map(
        (l) => `<article class="gos-card">
        <span class="gos-n">${l.n}</span>
        <h3>${esc(l.title)}</h3>
        <p>${esc(l.items.join(' · '))}</p>
      </article>`
      )
      .join('');
    const cy = root.querySelector('[data-gos-cycle]');
    if (cy) cy.innerHTML = data.cycle.map((c) => `<li>${esc(c)}</li>`).join('');
  };

  const paintDirectives = () => {
    const el = root.querySelector('[data-gos-directives]');
    if (!el) return;
    el.innerHTML = data.directives.map((d, i) => `<li><span>${i + 1}</span>${esc(d)}</li>`).join('');
  };

  paintStats();
  paintArchitecture();
  paintRegister();
  paintMatrices();
  paintIntegration();
  paintAi();
  paintData();
  paintCore();
  paintErp();
  paintDirectives();

  const initial = (location.hash || '#architecture').replace('#', '') || 'architecture';
  activate(['architecture', 'register', 'matrices', 'integration', 'ai', 'data', 'core', 'erp', 'directives'].includes(initial) ? initial : 'architecture');

  tabs.forEach((t) => t.addEventListener('click', () => activate(t.getAttribute('data-gos-tab'))));
  root.querySelector('[data-gos-search]')?.addEventListener('input', paintRegister);
  root.querySelector('[data-gos-tier]')?.addEventListener('change', paintRegister);
  root.addEventListener('click', (e) => {
    const detail = e.target.closest('[data-gos-detail]');
    if (detail) showDetail(detail.getAttribute('data-gos-detail'));
    if (e.target.closest('[data-gos-close-detail]')) {
      const box = root.querySelector('[data-gos-detail]');
      if (box) box.hidden = true;
    }
    const emit = e.target.closest('[data-gos-emit]');
    if (emit) emitEvent(emit.getAttribute('data-gos-emit'));
    if (e.target.closest('[data-gos-clear-events]')) {
      writeEvents([]);
      paintEventLog();
      toast('تم تفريغ سجل الأحداث');
    }
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id) activate(id);
  });
})();
