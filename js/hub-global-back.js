(() => {
  const HOME = 'index.html';

  const isHomePage = () => {
    const path = (window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    return path.endsWith('/') || path.endsWith('/index.html') || path === '' || /\/index\.html?$/.test(path);
  };

  const sameOriginReferrer = () => {
    try {
      if (!document.referrer) return false;
      return new URL(document.referrer).origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const projectReturn = () => {
    try {
      const ctx = window.HubSpProjectContext?.get?.();
      if (ctx?.id) return window.HubSpProjectContext.returnHref(ctx);
      const q = new URLSearchParams(window.location.search || '');
      const ret = q.get('return');
      if (q.get('from') === 'side-projects' && ret && /side-projects\.html/i.test(ret)) return ret;
    } catch (_) {}
    return '';
  };

  const goBack = (event) => {
    if (event) event.preventDefault();
    const toProject = projectReturn();
    if (toProject) {
      window.location.href = toProject;
      return;
    }
    if (sameOriginReferrer() && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = HOME;
  };

  const mountTarget = () => {
    const topbarLead = document.querySelector('.topbar > div');
    if (topbarLead) return { host: topbarLead, inline: true, prepend: true };
    return { host: document.body, inline: false, prepend: false };
  };

  const init = () => {
    if (document.getElementById('hub-back-button')) return;
    if (isHomePage()) return;

    const button = document.createElement('button');
    button.id = 'hub-back-button';
    button.type = 'button';
    const toProject = projectReturn();
    button.className = 'hub-back-button';
    button.setAttribute('aria-label', toProject ? 'العودة إلى المشروع' : 'رجوع');
    button.innerHTML = toProject
      ? '<i class="fas fa-arrow-right" aria-hidden="true"></i><span>العودة إلى المشروع</span>'
      : '<i class="fas fa-arrow-right" aria-hidden="true"></i><span>رجوع</span>';
    button.addEventListener('click', goBack);

    const { host, inline, prepend } = mountTarget();
    if (inline) button.classList.add('hub-back-button--inline');
    if (prepend) host.prepend(button);
    else host.appendChild(button);
  };

  const loadProjectContext = () => {
    if (window.HubSpProjectContext || document.querySelector('script[data-hub-sp-ctx]')) return;
    const inSystems = /\/systems\//i.test((window.location.pathname || '').replace(/\\/g, '/'));
    const script = document.createElement('script');
    script.src = `${inSystems ? '../' : ''}js/hub-sp-project-context.js?v=1`;
    script.dataset.hubSpCtx = '1';
    script.onload = () => {
      try {
        window.HubSpProjectContext?.mountBanner?.();
      } catch (_) {}
      const btn = document.getElementById('hub-back-button');
      const toProject = projectReturn();
      if (btn && toProject) {
        btn.setAttribute('aria-label', 'العودة إلى المشروع');
        btn.innerHTML = '<i class="fas fa-arrow-right" aria-hidden="true"></i><span>العودة إلى المشروع</span>';
      }
    };
    (document.head || document.documentElement).appendChild(script);
  };

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
  loadProjectContext();

  const loadControlNav = () => {
    if (window.HubControlNav || document.querySelector('script[data-hub-control-nav-src]')) return;
    const inSystems = /\/systems\//i.test((window.location.pathname || '').replace(/\\/g, '/'));
    const script = document.createElement('script');
    script.src = `${inSystems ? '../' : ''}js/hub-control-nav.js?v=2`;
    script.dataset.hubControlNavSrc = '1';
    (document.head || document.documentElement).appendChild(script);
  };
  loadControlNav();
})();
