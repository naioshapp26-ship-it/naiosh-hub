/**
 * صفحة / واجهة نتائج Google Programmable Search Engine
 */
(() => {
  'use strict';

  const cfg = () => window.HubGoogleSearchConfig;
  const qs = (s, r = document) => r.querySelector(s);

  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const setStatus = (el, kind, text) => {
    if (!el) return;
    el.hidden = !text;
    el.dataset.kind = kind || '';
    el.textContent = text || '';
  };

  const queryFromUrl = () => {
    try {
      const fromUrl = String(new URLSearchParams(location.search).get('q') || '').trim();
      if (fromUrl) return fromUrl;
    } catch (_) {
      /* ignore */
    }
    try {
      const fromSession = String(sessionStorage.getItem('hubGoogleSearchQ') || '').trim();
      if (fromSession) return fromSession;
    } catch (_) {
      /* ignore */
    }
    return '';
  };

  const loadCseScript = (cx) =>
    new Promise((resolve, reject) => {
      if (window.google?.search?.cse) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-hub-gcse="${cx}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('cse load failed')));
        return;
      }
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(cx)}`;
      s.dataset.hubGcse = cx;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('تعذر تحميل نتائج Google حاليًا، حاول مرة أخرى.'));
      document.head.appendChild(s);
    });

  const renderResults = async (root, query) => {
    const status = root.querySelector('[data-gcs-status]');
    const mount = root.querySelector('[data-gcs-mount]');
    const conf = cfg()?.getGoogle?.() || {};
    const cx = cfg()?.getCx?.() || '';

    if (!cfg()?.isEnabled?.()) {
      setStatus(status, 'error', 'محرك بحث Google غير مفعّل من إعدادات الموقع.');
      if (mount) mount.innerHTML = '';
      return;
    }

    if (!cx) {
      setStatus(
        status,
        'error',
        'لم يُضبط Search Engine ID (cx) بعد. اضبطه من إعدادات الموقع › إعدادات محركات البحث.'
      );
      if (mount) mount.innerHTML = '';
      return;
    }

    if (!query) {
      setStatus(status, 'idle', 'اكتب ما تريد البحث عنه في Google.');
      if (mount) mount.innerHTML = '';
      return;
    }

    setStatus(status, 'loading', 'جاري البحث...');
    if (mount) {
      mount.innerHTML = `<div class="gcs-spinner" aria-hidden="true"></div>`;
    }

    try {
      window.__gcse = {
        parsetags: 'explicit',
        callback() {
          try {
            const linkTarget = conf.openLinksInNewTab === false ? '_self' : '_blank';
            if (!mount) return;
            mount.innerHTML = '';
            const box = document.createElement('div');
            box.id = 'hub-gcse-results';
            mount.appendChild(box);
            google.search.cse.element.render({
              div: 'hub-gcse-results',
              tag: 'searchresults-only',
              gname: 'hub-google-results',
              attributes: {
                linkTarget,
                noResultsString: 'لم يتم العثور على نتائج لهذا البحث.',
              },
            });
            const el = google.search.cse.element.getElement('hub-google-results');
            el.execute(query);
            setStatus(status, 'ok', '');
            status.hidden = true;
          } catch (err) {
            setStatus(status, 'error', 'تعذر تحميل نتائج Google حاليًا، حاول مرة أخرى.');
            if (mount) mount.innerHTML = '';
          }
        },
      };

      await loadCseScript(cx);
      // If CSE already loaded before __gcse callback registration, trigger manually
      if (window.google?.search?.cse?.element && typeof window.__gcse.callback === 'function') {
        // give CSE a tick to initialize
        setTimeout(() => {
          if (qs('#hub-gcse-results')) return;
          try {
            window.__gcse.callback();
          } catch (_) {
            /* ignore */
          }
        }, 400);
      }
    } catch (err) {
      setStatus(status, 'error', err.message || 'تعذر تحميل نتائج Google حاليًا، حاول مرة أخرى.');
      if (mount) mount.innerHTML = '';
    }
  };

  const bindForm = (root) => {
    const form = root.querySelector('[data-gcs-form]');
    const input = root.querySelector('[data-gcs-input]');
    if (!form || !input) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = String(input.value || '').trim();
      if (!q) {
        setStatus(root.querySelector('[data-gcs-status]'), 'idle', 'اكتب ما تريد البحث عنه في Google.');
        return;
      }
      const url = cfg()?.resultsUrl?.(q) || `google-search.html?q=${encodeURIComponent(q)}`;
      if (location.pathname.endsWith('google-search.html') || location.pathname.endsWith('/google-search')) {
        history.replaceState(null, '', url);
        renderResults(root, q);
      } else {
        location.href = url;
      }
    });
  };

  const initPage = () => {
    const root = document.querySelector('[data-gcs-page]');
    if (!root) return;
    const q = queryFromUrl();
    const input = root.querySelector('[data-gcs-input]');
    if (input && q) input.value = q;
    bindForm(root);
    renderResults(root, q);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage);
  else initPage();

  window.HubGoogleSearchPage = { renderResults, queryFromUrl, esc };
})();
