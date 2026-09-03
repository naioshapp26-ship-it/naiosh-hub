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

  const goBack = (event) => {
    if (event) event.preventDefault();
    if (sameOriginReferrer() && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = HOME;
  };

  const mountTarget = () => {
    // Dashboard: place back inside the topbar so it never covers logout/actions
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
    button.className = 'hub-back-button';
    button.setAttribute('aria-label', 'رجوع');
    button.innerHTML = '<i class="fas fa-arrow-right" aria-hidden="true"></i><span>رجوع</span>';
    button.addEventListener('click', goBack);

    const { host, inline, prepend } = mountTarget();
    if (inline) button.classList.add('hub-back-button--inline');
    if (prepend) host.prepend(button);
    else host.appendChild(button);
  };

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });

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
