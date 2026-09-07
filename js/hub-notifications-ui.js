/**
 * Hub Notifications UI — جرس موحّد لكل إشعارات الأنظمة على هوب
 */
(() => {
  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-US');
    } catch (_) {
      return iso || '';
    }
  };

  const levelIcon = (level) => {
    if (level === 'alert' || level === 'error') return 'fa-triangle-exclamation';
    if (level === 'success') return 'fa-circle-check';
    if (level === 'warning') return 'fa-circle-exclamation';
    return 'fa-bell';
  };

  const ensureStyles = () => {
    if (document.getElementById('hub-notify-styles')) return;
    const style = document.createElement('style');
    style.id = 'hub-notify-styles';
    style.textContent = `
      .hub-notify-wrap { position: relative; display: inline-flex; align-items: center; z-index: 2; }
      .hub-notify-btn {
        position: relative; border: 1px solid rgba(220,38,38,.35); background: #fff;
        color: #b91c1c; width: 40px; height: 40px; border-radius: 12px; cursor: pointer;
        display: inline-grid; place-items: center; font-size: 16px;
      }
      .hub-notify-btn:hover { background: #fef2f2; }
      .hub-notify-badge {
        position: absolute; top: -4px; left: -4px; min-width: 18px; height: 18px;
        padding: 0 5px; border-radius: 999px; background: #dc2626; color: #fff;
        font-size: 11px; font-weight: 800; display: none; align-items: center; justify-content: center;
      }
      .hub-notify-badge.show { display: inline-flex; }
      .hub-notify-panel {
        position: fixed; width: min(360px, calc(100vw - 24px));
        background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
        box-shadow: 0 18px 40px rgba(15,23,42,.22); display: none;
        z-index: 10080; overflow: hidden; max-height: min(70vh, 480px);
      }
      .hub-notify-panel.open { display: flex; flex-direction: column; }
      .hub-notify-head {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 12px 14px; border-bottom: 1px solid #eee; font-weight: 800; flex: 0 0 auto;
      }
      .hub-notify-list { max-height: none; flex: 1 1 auto; overflow: auto; margin: 0; padding: 0; list-style: none; }
      .hub-notify-list li {
        display: grid; grid-template-columns: 28px 1fr; gap: 8px; padding: 12px 14px;
        border-bottom: 1px solid #f3f4f6; cursor: pointer;
      }
      .hub-notify-list li.unread { background: #fff7ed; }
      .hub-notify-list li:hover { background: #f9fafb; }
      .hub-notify-list strong { display: block; font-size: 13px; color: #111827; }
      .hub-notify-list p { margin: 2px 0 0; font-size: 12px; color: #6b7280; line-height: 1.5; }
      .hub-notify-list small { color: #9ca3af; font-size: 11px; }
      .hub-notify-empty { padding: 24px; text-align: center; color: #6b7280; font-size: 13px; }
      body.dashboard-body .hub-notify-btn, body:has(.sidebar) .hub-notify-btn {
        background: rgba(255,255,255,.06); color: #fecaca; border-color: rgba(254,202,202,.25);
      }
      /* Keep dashboard topbar above empire banner / panels while notifications are used */
      body:has(.sidebar) .topbar,
      body.dashboard-body .topbar {
        position: relative;
        z-index: 10050;
        overflow: visible;
      }
      body:has(.sidebar) .topbar-actions,
      body.dashboard-body .topbar-actions {
        overflow: visible;
        position: relative;
        z-index: 2;
      }
    `;
    document.head.appendChild(style);
  };

  const placePanel = (btn, panel) => {
    if (!btn || !panel) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const gap = 8;
    let top = rect.bottom + gap;
    let left = rect.left;
    // Prefer aligning to the button's start edge (RTL-safe: use left of button, clamp)
    if (document.documentElement.dir === 'rtl') {
      left = rect.right - width;
    }
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const estimatedHeight = Math.min(window.innerHeight * 0.7, 480);
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - gap - Math.min(estimatedHeight, rect.top - 12));
    }
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
  };

  const getNotes = () => window.HubStore?.listNotifications?.() || [];
  const unread = () => window.HubStore?.unreadNotificationsCount?.() || 0;

  const paint = (root) => {
    if (!root) return;
    const badge = root.querySelector('.hub-notify-badge');
    const panel =
      root._hubNotifyPanel ||
      document.querySelector('.hub-notify-panel') ||
      root.querySelector('.hub-notify-panel');
    const list = panel?.querySelector('.hub-notify-list');
    const empty = panel?.querySelector('.hub-notify-empty');
    const n = unread();
    if (badge) {
      badge.textContent = String(n);
      badge.classList.toggle('show', n > 0);
    }
    const notes = getNotes().slice(0, 30);
    if (!list) return;
    if (!notes.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = notes
      .map(
        (x) => `<li class="${x.read ? '' : 'unread'}" data-id="${esc(x.id)}" data-link="${esc(x.link || '')}">
          <i class="fas ${levelIcon(x.level)}" style="color:#dc2626;margin-top:3px"></i>
          <div>
            <strong>${esc(x.title)}</strong>
            <p>${esc(x.body || '')}</p>
            <small>${esc(x.sourceName || x.source || 'HUB')} · ${esc(fmt(x.at))}</small>
          </div>
        </li>`
      )
      .join('');
  };

  const mount = (host) => {
    if (!host || host.querySelector('.hub-notify-wrap')) return;
    ensureStyles();
    const wrap = document.createElement('div');
    wrap.className = 'hub-notify-wrap';
    wrap.innerHTML = `
      <button type="button" class="hub-notify-btn" aria-label="إشعارات هوب" title="كل الإشعارات على هوب">
        <i class="fas fa-bell"></i>
        <span class="hub-notify-badge">0</span>
      </button>
      <div class="hub-notify-panel" role="dialog" aria-label="مركز الإشعارات">
        <div class="hub-notify-head">
          <span>إشعارات هوب</span>
          <button type="button" class="btn-mini" data-mark-all style="border:0;background:#f3f4f6;padding:4px 8px;border-radius:8px;cursor:pointer;font-weight:700">تعليم الكل كمقروء</button>
        </div>
        <ul class="hub-notify-list"></ul>
        <div class="hub-notify-empty">لا إشعارات بعد — ستظهر هنا من كل الأنظمة</div>
      </div>`;
    host.prepend(wrap);

    const btn = wrap.querySelector('.hub-notify-btn');
    const panel = wrap.querySelector('.hub-notify-panel');
    // Escape topbar stacking context (backdrop-filter) so panel isn't covered by empire banner
    if (panel && panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    wrap._hubNotifyPanel = panel;
    const openPanel = () => {
      panel.classList.add('open');
      placePanel(btn, panel);
      paint(wrap);
    };
    const closePanel = () => panel.classList.remove('open');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.classList.contains('open')) closePanel();
      else openPanel();
    });
    panel.querySelector('[data-mark-all]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.HubStore?.markAllNotificationsRead?.();
      paint(wrap);
    });
    panel.querySelector('.hub-notify-list')?.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      window.HubStore?.markNotificationRead?.(li.dataset.id);
      paint(wrap);
      if (li.dataset.link) window.location.href = li.dataset.link;
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('.hub-notify-panel') || e.target.closest('.hub-notify-wrap')) return;
      closePanel();
    });
    window.addEventListener(
      'resize',
      () => {
        if (panel.classList.contains('open')) placePanel(btn, panel);
      },
      { passive: true }
    );
    window.addEventListener(
      'scroll',
      () => {
        if (panel.classList.contains('open')) placePanel(btn, panel);
      },
      { passive: true, capture: true }
    );
    paint(wrap);

    // refresh badge periodically + on storage
    setInterval(() => paint(wrap), 4000);
    window.addEventListener('storage', () => paint(wrap));
    window.addEventListener('hub-notifications-changed', () => paint(wrap));
  };

  const autoMount = () => {
    const dash = document.querySelector('.topbar-actions');
    if (dash) return mount(dash);
    const auth = document.querySelector('.auth-actions');
    if (auth) return mount(auth);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  window.HubNotificationsUI = { mount, paint, autoMount };
})();
