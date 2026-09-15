/**
 * مركز معلومات نايوش هوب — شريط تنقل داخلي + Breadcrumbs
 */
(function () {
  'use strict';

  var HOME = 'hub-checklist.html';
  var LABEL = 'مركز معلومات نايوش هوب';

  var NAV = [
    { id: 'overview', href: HOME + '#overview', label: 'نظرة عامة', match: ['hub-checklist.html'] },
    { id: 'about', href: HOME + '#about-hub', label: 'ما هي نايوش هوب؟', match: ['hub-checklist.html#about'] },
    { id: 'policies', href: 'policies.html', label: 'السياسات', match: ['policies.html'] },
    { id: 'specs', href: 'engine-specs.html', label: 'المواصفات الوظيفية', match: ['engine-specs.html'] },
    { id: 'guides', href: HOME + '#guides', label: 'الأدلة وطريقة الاستخدام', match: ['ops-manuals.html'] },
    { id: 'faq', href: HOME + '#info-faq', label: 'الأسئلة الشائعة', match: [] },
  ];

  function pathFile() {
    return (location.pathname.split('/').pop() || HOME).toLowerCase() || HOME;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isActive(item) {
    var file = pathFile();
    var hash = (location.hash || '').replace(/^#/, '');
    if (item.id === 'overview' && file === HOME && (!hash || hash === 'overview')) return true;
    if (item.id === 'about' && file === HOME && (hash === 'about-hub' || hash === 'about')) return true;
    if (item.id === 'guides' && (file === 'ops-manuals.html' || (file === HOME && hash === 'guides'))) return true;
    if (item.id === 'faq' && file === HOME && hash === 'info-faq') return true;
    return (item.match || []).some(function (m) {
      return file === String(m).toLowerCase();
    });
  }

  function mountNav(target) {
    if (!target) return;
    target.innerHTML =
      '<nav class="info-subnav" aria-label="' +
      esc(LABEL) +
      '">' +
      '<div class="info-subnav-brand"><i class="fas fa-circle-info" aria-hidden="true"></i><span>' +
      esc(LABEL) +
      '</span></div>' +
      '<div class="info-subnav-links">' +
      NAV.map(function (item) {
        return (
          '<a href="' +
          esc(item.href) +
          '" class="' +
          (isActive(item) ? 'is-on' : '') +
          '" data-info-nav="' +
          esc(item.id) +
          '">' +
          esc(item.label) +
          '</a>'
        );
      }).join('') +
      '</div></nav>';
  }

  function mountCrumbs(target, crumbs) {
    if (!target || !crumbs || !crumbs.length) return;
    target.innerHTML =
      '<nav class="info-crumbs" aria-label="مسار التنقل">' +
      crumbs
        .map(function (c, i) {
          var last = i === crumbs.length - 1;
          if (last || !c.href) {
            return '<span class="is-current" aria-current="page">' + esc(c.label) + '</span>';
          }
          return '<a href="' + esc(c.href) + '">' + esc(c.label) + '</a><span class="info-crumbs-sep" aria-hidden="true">›</span>';
        })
        .join('') +
      '</nav>';
  }

  function autoMount() {
    var navEl = document.querySelector('[data-info-subnav]');
    if (navEl) mountNav(navEl);
    var crumbEl = document.querySelector('[data-info-crumbs]');
    if (crumbEl) {
      var raw = crumbEl.getAttribute('data-info-crumbs') || '';
      var crumbs = [{ label: 'الرئيسية', href: 'index.html' }, { label: LABEL, href: HOME }];
      try {
        if (raw.trim().startsWith('[')) crumbs = crumbs.concat(JSON.parse(raw));
        else if (raw.trim()) {
          crumbs.push({ label: raw.trim() });
        }
      } catch (e) {
        if (raw.trim()) crumbs.push({ label: raw.trim() });
      }
      mountCrumbs(crumbEl, crumbs);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();

  window.HubInfoCenter = {
    HOME: HOME,
    LABEL: LABEL,
    NAV: NAV,
    mountNav: mountNav,
    mountCrumbs: mountCrumbs,
    pathFile: pathFile,
  };
})();
