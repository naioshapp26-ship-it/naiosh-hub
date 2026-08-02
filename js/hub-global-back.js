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
    document.body.appendChild(button);
  };

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
