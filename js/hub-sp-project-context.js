/**
 * سياق مشروع جانبي عند الانتقال للمحطات/الأدوات.
 * يحفظ رقم المشروع والمرحلة ويعرض شريط «العودة إلى المشروع».
 */
(() => {
  'use strict';

  const KEY = 'naiosh_sp_active_project_v1';
  const STATION_KEY = 'naiosh_sp_station_status_v1';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const readJson = (k, fallback) => {
    try {
      return JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k) || 'null') || fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (k, value) => {
    const raw = JSON.stringify(value);
    try {
      sessionStorage.setItem(k, raw);
      localStorage.setItem(k, raw);
    } catch (_) {}
  };

  const params = () => new URLSearchParams(window.location.search || '');

  const fromParams = () => {
    const q = params();
    const id = String(q.get('project') || q.get('projectId') || '').trim();
    if (!id) return null;
    return {
      id,
      title: String(q.get('projectName') || q.get('title') || 'مشروع جانبي').trim(),
      categoryId: String(q.get('categoryId') || '').trim(),
      categoryName: String(q.get('categoryName') || '').trim(),
      mode: String(q.get('mode') || '').trim(),
      stage: String(q.get('stage') || '').trim(),
      stageLabel: String(q.get('stageLabel') || '').trim(),
      toolLabel: String(q.get('tool') || '').trim(),
      returnTo: String(q.get('return') || 'side-projects.html#sp-opened').trim(),
      from: String(q.get('from') || 'side-projects').trim(),
    };
  };

  const set = (ctx = {}) => {
    if (!ctx || !ctx.id) return null;
    const next = {
      id: String(ctx.id),
      title: String(ctx.title || 'مشروع جانبي'),
      categoryId: String(ctx.categoryId || ''),
      categoryName: String(ctx.categoryName || ''),
      mode: String(ctx.mode || ''),
      stage: String(ctx.stage || ''),
      stageLabel: String(ctx.stageLabel || ''),
      toolLabel: String(ctx.toolLabel || ''),
      returnTo: String(ctx.returnTo || `side-projects.html#sp-opened-${encodeURIComponent(ctx.id)}`),
      from: 'side-projects',
      savedAt: new Date().toISOString(),
    };
    writeJson(KEY, next);
    return next;
  };

  const get = () => fromParams() || readJson(KEY, null);

  const clear = () => {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    } catch (_) {}
  };

  const returnHref = (ctx) => {
    const c = ctx || get();
    if (!c) return 'side-projects.html#sp-opened';
    if (c.returnTo) return c.returnTo;
    return `side-projects.html#sp-opened-${encodeURIComponent(c.id)}`;
  };

  const buildUrl = (base, project, extra = {}) => {
    const p = project || {};
    const [pathPart, existingQuery] = String(base || '').split('?');
    const qs = new URLSearchParams(existingQuery || '');
    qs.set('from', 'side-projects');
    qs.set('project', p.id || '');
    qs.set('projectId', p.id || '');
    qs.set('projectName', p.title || p.name || '');
    if (p.categoryId) qs.set('categoryId', p.categoryId);
    if (p.categoryName) qs.set('categoryName', p.categoryName);
    if (p.mode) qs.set('mode', p.mode);
    if (extra.stage) qs.set('stage', extra.stage);
    if (extra.stageLabel) qs.set('stageLabel', extra.stageLabel);
    if (extra.tool) qs.set('tool', extra.tool);
    const ret = extra.returnTo || `side-projects.html#sp-opened-${encodeURIComponent(p.id || '')}`;
    qs.set('return', ret);
    return `${pathPart}?${qs.toString()}`;
  };

  const readStationMap = () => readJson(STATION_KEY, {});
  const setStationStatus = (projectId, stageId, status) => {
    const map = readStationMap();
    if (!map[projectId]) map[projectId] = {};
    map[projectId][stageId] = status;
    writeJson(STATION_KEY, map);
    return map[projectId];
  };
  const getStationStatus = (projectId, stageId) => {
    const map = readStationMap();
    return (map[projectId] && map[projectId][stageId]) || 'todo';
  };

  const ensureStyles = () => {
    if (document.getElementById('hub-sp-ctx-style')) return;
    const style = document.createElement('style');
    style.id = 'hub-sp-ctx-style';
    style.textContent = `
      .hub-sp-ctx-banner{position:sticky;top:0;z-index:1150;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;background:linear-gradient(90deg,#fff7f8,#ffffff);border-bottom:1px solid #f0d4d8;font-family:Cairo,Tahoma,sans-serif}
      .hub-sp-ctx-banner__copy{display:grid;gap:2px;min-width:0}
      .hub-sp-ctx-banner__kicker{font-size:11px;font-weight:800;color:#b00020}
      .hub-sp-ctx-banner strong{font-size:14px;color:#1a1a1a}
      .hub-sp-ctx-banner small{font-size:12px;color:#666;font-weight:650}
      .hub-sp-ctx-banner__actions{display:flex;flex-wrap:wrap;gap:8px}
      .hub-sp-ctx-banner a,.hub-sp-ctx-banner button{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;text-decoration:none;border:1px solid #e8c9cf;background:#fff;color:#8a1020;cursor:pointer}
      .hub-sp-ctx-banner a.is-primary,.hub-sp-ctx-banner button.is-primary{background:#d70000;border-color:#d70000;color:#fff}
      .hub-sp-ctx-crumb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;font-weight:700;color:#777;margin-top:2px}
      .hub-sp-ctx-crumb a{color:#b00020;text-decoration:none}
      .hub-sp-ctx-crumb span{opacity:.55}
    `;
    document.head.appendChild(style);
  };

  const mountBanner = () => {
    const ctx = get();
    if (!ctx || !ctx.id) return null;
    if (document.getElementById('hub-sp-ctx-banner')) return ctx;
    // Don't show on the side-projects page itself
    if (/side-projects\.html/i.test(location.pathname)) return ctx;

    ensureStyles();
    set(ctx);

    const stageText = ctx.stageLabel || ctx.toolLabel || ctx.stage || '';
    const banner = document.createElement('div');
    banner.id = 'hub-sp-ctx-banner';
    banner.className = 'hub-sp-ctx-banner';
    banner.innerHTML = `
      <div class="hub-sp-ctx-banner__copy">
        <div class="hub-sp-ctx-banner__kicker"><i class="fas fa-diagram-project"></i> سياق المشروع الجانبي</div>
        <strong>${esc(stageText ? `${stageText} للمشروع: ${ctx.title}` : `العمل على المشروع: ${ctx.title}`)}</strong>
        <div class="hub-sp-ctx-crumb">
          <a href="side-projects.html#sp-client-intro">المشاريع الجانبية</a>
          <span>←</span>
          <a href="${esc(returnHref(ctx))}">${esc(ctx.title)}</a>
          ${stageText ? `<span>←</span><span>${esc(stageText)}</span>` : ''}
        </div>
        <small>رقم المشروع: <b dir="ltr">${esc(ctx.id)}</b>${ctx.categoryName ? ` · ${esc(ctx.categoryName)}` : ''}</small>
      </div>
      <div class="hub-sp-ctx-banner__actions">
        <a class="is-primary" href="${esc(returnHref(ctx))}"><i class="fas fa-arrow-right"></i> العودة إلى المشروع</a>
      </div>`;
    document.body.prepend(banner);

    // Prefer return-to-project over generic dashboard back on ads/events studios
    const studioBack = document.getElementById('hub-studio-back');
    if (studioBack) {
      studioBack.setAttribute('href', returnHref(ctx));
      studioBack.innerHTML = '<i class="fas fa-arrow-right text-xs"></i> العودة إلى المشروع';
    }

    const pageTitle = document.querySelector('[data-office-title], h1');
    if (pageTitle && /office\.html/i.test(location.pathname)) {
      const stage = ctx.stageLabel || 'مكتبي';
      pageTitle.textContent = `${stage} · ${ctx.title}`;
    }

    return ctx;
  };

  const openStation = (baseHref, project, meta = {}) => {
    const ctx = set({
      ...project,
      stage: meta.stage || '',
      stageLabel: meta.stageLabel || meta.label || '',
      toolLabel: meta.tool || meta.label || '',
      returnTo: `side-projects.html#sp-opened-${encodeURIComponent(project.id)}`,
    });
    if (meta.stageId) setStationStatus(project.id, meta.stageId, 'current');
    const url = buildUrl(baseHref, ctx, {
      stage: meta.stage || meta.stageId || '',
      stageLabel: meta.stageLabel || meta.label || '',
      tool: meta.tool || meta.label || '',
      returnTo: ctx.returnTo,
    });
    window.location.href = url;
  };

  window.HubSpProjectContext = {
    KEY,
    STATION_KEY,
    set,
    get,
    clear,
    buildUrl,
    returnHref,
    openStation,
    setStationStatus,
    getStationStatus,
    readStationMap,
    mountBanner,
  };

  const boot = () => mountBanner();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
