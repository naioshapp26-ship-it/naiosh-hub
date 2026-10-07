/**
 * Unified notification routing — role-aware target resolution.
 * Prevents customers from being dumped on dashboard.html → client/login loops.
 */
(() => {
  'use strict';

  const STAFF_ROLES = new Set(['supreme_leader', 'chief_engineer', 'admin', 'super_admin']);
  const CLIENT_ROLES = new Set(['customer', 'client', 'client_user', 'platform_owner']);

  const roleOf = (user) => String(user?.role || '').toLowerCase();
  const isStaffUser = (user) => {
    if (window.HubAuth?.isStaff?.(user)) return true;
    return STAFF_ROLES.has(roleOf(user));
  };
  const isClientUser = (user) => {
    if (window.HubAuth?.isClient?.(user) && !isStaffUser(user)) return true;
    return CLIENT_ROLES.has(roleOf(user)) && !STAFF_ROLES.has(roleOf(user));
  };

  const safePath = (url) => {
    const raw = String(url || '').trim();
    if (!raw || raw === '#' || /^javascript:/i.test(raw)) return '';
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw, window.location.origin);
        if (u.origin !== window.location.origin) return '';
        return u.pathname.replace(/^\//, '') + u.search + u.hash;
      } catch {
        return '';
      }
    }
    return raw.replace(/^\.\.\//, '').replace(/^\//, '');
  };

  const isDashboardUrl = (url) => /^dashboard\.html/i.test(String(url || ''));

  const refTypeOf = (n = {}) =>
    String(n.relatedEntityType || n.referenceType || n.meta?.referenceType || n.meta?.entityType || n.type || '')
      .trim()
      .toLowerCase();

  const refIdOf = (n = {}) =>
    String(
      n.relatedEntityId ||
        n.referenceId ||
        n.meta?.referenceId ||
        n.meta?.entityId ||
        n.requestId ||
        n.meta?.requestId ||
        ''
    ).trim();

  /** Explicit customer-request id only — never fall back to relatedEntityId (that breaks Ad/Product catalog targets). */
  const requestIdOf = (n = {}) => String(n.requestId || n.meta?.requestId || '').trim();

  /** Map related entity → customer-facing URL */
  const customerTarget = (n) => {
    const type = refTypeOf(n);
    const id = refIdOf(n);
    const req = requestIdOf(n);
    const q = (base, extra = '') => {
      const hash = extra || (req ? `requests?id=${encodeURIComponent(req)}` : 'requests');
      return `${base}#${hash}`;
    };

    if (/product|store|catalog/.test(type)) {
      // Submission / request → customer requests inbox; published product → catalog
      if (req || /submission|request/.test(type)) {
        const rid = req || id;
        return q('client.html', rid ? `requests?id=${encodeURIComponent(rid)}` : 'orders');
      }
      if (id) return `products.html#${encodeURIComponent(id)}`;
      return q('client.html', 'orders');
    }
    if (/^ad\b|ad[_-]?submission|advert/.test(type)) {
      // Only ad *submissions* / explicit requestId go to requests; approved ads open ads.html
      if (req || /submission|request/.test(type)) {
        const rid = req || id;
        return q('client.html', rid ? `requests?id=${encodeURIComponent(rid)}` : 'requests');
      }
      return id ? `ads.html#mine/${encodeURIComponent(id)}` : 'ads.html';
    }
    if (/event/.test(type)) return id ? `events.html#mine-created` : 'events.html#mine-created';
    if (/platform/.test(type)) return 'platforms.html#platforms-mine';
    if (/article|blog|post/.test(type)) return id ? `blog.html#mine/${encodeURIComponent(id)}` : 'blog.html';
    if (/support|ticket|complaint/.test(type)) {
      return q('client.html', id ? `support?ticket=${encodeURIComponent(id)}` : 'support');
    }
    if (/invoice|billing|payment|wallet|order/.test(type)) {
      return q('client.html', /invoice|billing|payment/.test(type) ? 'invoices' : 'orders');
    }
    if (/rent|system.?rental|booking|grant/.test(type)) {
      return 'my-systems.html';
    }
    if (/solution|naiosh.?solution/.test(type)) return 'naiosh-solutions.html?view=my';
    if (/customer.?request|request/.test(type) || req) {
      const rid = req || id;
      return q('client.html', rid ? `requests?id=${encodeURIComponent(rid)}` : 'requests');
    }

    // Rewrite legacy dashboard links for customers
    const raw = safePath(n.actionLink || n.link || n.sourceLink || n.targetUrl || '');
    if (raw && !isDashboardUrl(raw)) return raw;
    if (isDashboardUrl(raw)) {
      if (/posha|customer|client|request/i.test(raw)) return q('client.html');
      if (/rent|system/i.test(raw)) return 'my-systems.html';
      if (/ad/i.test(raw)) return 'ads.html';
      if (/event/i.test(raw)) return 'events.html#mine-created';
      return 'client.html#notifications';
    }
    return '';
  };

  /** Map related entity → staff/admin URL */
  const staffTarget = (n) => {
    const type = refTypeOf(n);
    const id = refIdOf(n);
    const req = requestIdOf(n);
    const raw = safePath(n.actionLink || n.link || n.sourceLink || n.targetUrl || '');

    if (raw && isDashboardUrl(raw)) {
      // Keep staff dashboard deep-links; append entity id if missing
      if (id && !/[?&#](id|req|apr|ref)=/i.test(raw)) {
        const join = raw.includes('?') || raw.includes('#') ? '&' : '?';
        // Prefer hash query style used by dashboard panels
        if (raw.includes('#')) {
          const [path, hash] = raw.split('#');
          const [panel, qs] = hash.split('?');
          const params = new URLSearchParams(qs || '');
          if (!params.has('id') && !params.has('req') && !params.has('apr')) {
            params.set(req ? 'req' : 'id', req || id);
          }
          return `${path}#${panel}?${params.toString()}`;
        }
        return `${raw}${join}id=${encodeURIComponent(id)}`;
      }
      return raw;
    }
    if (raw && !isDashboardUrl(raw)) return raw;

    if (/product|store|catalog/.test(type)) {
      return `dashboard.html#posha-clients${req || id ? `?req=${encodeURIComponent(req || id)}` : ''}`;
    }
    if (/^ad\b|ad[_-]?submission|advert/.test(type)) {
      return `dashboard.html#ads${id ? `?id=${encodeURIComponent(id)}` : ''}`;
    }
    if (/event/.test(type)) return `dashboard.html#events${id ? `?id=${encodeURIComponent(id)}` : ''}`;
    if (/platform|rent|grant|approval/.test(type)) {
      return `dashboard.html#rent-admin${req || id ? `?apr=${encodeURIComponent(req || id)}` : ''}`;
    }
    if (/support|ticket|complaint/.test(type)) {
      return `dashboard.html#support${id ? `?ticket=${encodeURIComponent(id)}` : ''}`;
    }
    if (/article|blog|post/.test(type)) {
      return `dashboard.html#articles${id ? `?id=${encodeURIComponent(id)}` : ''}`;
    }
    if (/customer.?request|request/.test(type) || req) {
      return `dashboard.html#posha-clients${req ? `?req=${encodeURIComponent(req)}` : ''}`;
    }
    return '';
  };

  const notificationsCenterFor = (user) => {
    if (isStaffUser(user)) return 'dashboard.html#notifications';
    if (isClientUser(user)) return 'client.html#notifications';
    return 'login.html?next=' + encodeURIComponent('client.html#notifications');
  };

  /**
   * Resolve where a notification should open for the current viewer.
   * @returns {{ url: string, informational: boolean, requiresAuth: boolean, lane: string, reason: string }}
   */
  const resolveNotificationTarget = (n, user = window.HubAuth?.getUser?.()) => {
    if (!n) return { url: '', informational: true, requiresAuth: false, lane: 'none', reason: 'missing' };

    const loggedIn = !!window.HubAuth?.isLoggedIn?.();
    const staff = isStaffUser(user);
    const client = isClientUser(user);
    const lane = staff ? 'staff' : client ? 'client' : loggedIn ? 'other' : 'guest';

    // Explicit recipient lane mismatch: don't open foreign admin destinations for customers
    const recipient = String(n.recipientType || n.meta?.recipientType || '').toLowerCase();
    if (recipient === 'staff' && client) {
      // Customer received a copy — route to their own view of the entity
      const url = customerTarget(n) || 'client.html#notifications';
      return { url, informational: false, requiresAuth: true, lane: 'client', reason: 'customer-view-of-staff-note' };
    }
    if (recipient === 'customer' && staff && !n.actionLink && !n.link) {
      const url = staffTarget(n) || 'dashboard.html#notifications';
      return { url, informational: false, requiresAuth: true, lane: 'staff', reason: 'staff-view-of-customer-note' };
    }

    let url = '';
    if (staff) url = staffTarget(n);
    else if (client) url = customerTarget(n);
    else {
      // Guest / unknown: never send to dashboard; always preserve return target via login?next=
      const customerish = customerTarget(n);
      const raw = safePath(n.actionLink || n.link || n.sourceLink || '');
      const dest =
        customerish ||
        (raw && !isDashboardUrl(raw) ? raw : '') ||
        '';
      if (dest) {
        const needsLogin =
          isDashboardUrl(dest) ||
          /^client\.html/i.test(dest) ||
          /#(requests|orders|invoices|support|notifications)/i.test(dest) ||
          /mine|my-systems|platforms-mine/i.test(dest);
        return {
          url: needsLogin ? 'login.html?next=' + encodeURIComponent(dest) : dest,
          informational: false,
          requiresAuth: needsLogin,
          lane: 'guest',
          reason: needsLogin ? 'login-then-target' : 'public-target',
        };
      }
      return { url: '', informational: true, requiresAuth: false, lane: 'guest', reason: 'no-target' };
    }

    if (!url) {
      return {
        url: '',
        informational: true,
        requiresAuth: false,
        lane,
        reason: 'informational',
      };
    }

    // Session valid → never bounce to login
    if (loggedIn && /^login\.html/i.test(url)) {
      const params = new URLSearchParams(url.split('?')[1] || '');
      const next = params.get('next');
      url = next && !isDashboardUrl(next) ? next : notificationsCenterFor(user);
    }

    // Defense: customers must never land on dashboard via notification click
    if (client && isDashboardUrl(url)) {
      url = customerTarget(n) || 'client.html#notifications';
    }

    return {
      url,
      informational: false,
      requiresAuth: /^login\.html/i.test(url) || isDashboardUrl(url) || /^client\.html/i.test(url),
      lane,
      reason: 'resolved',
    };
  };

  /**
   * Open a notification: mark read, then navigate to the resolved target.
   */
  const openNotification = (idOrNote, { markRead = true } = {}) => {
    const list = window.HubStore?.listNotifications?.({ includeArchived: true }) || window.HubStore?.get?.()?.notifications || [];
    const n =
      typeof idOrNote === 'object' && idOrNote
        ? idOrNote
        : list.find((x) => x.id === idOrNote || x.code === idOrNote);
    if (!n) return { ok: false, error: 'الإشعار غير موجود' };

    if (markRead) {
      try {
        window.HubStore?.markNotificationRead?.(n.id);
      } catch {
        /* never block navigation on read-status failure */
      }
    }

    const user = window.HubAuth?.getUser?.() || null;
    const target = resolveNotificationTarget(n, user);

    if (target.informational || !target.url) {
      // Stay in place / open notifications center for the role
      const center = notificationsCenterFor(user);
      if (center && !window.location.href.includes(center.split('#')[0])) {
        window.location.href = center;
      }
      return { ok: true, informational: true, target };
    }

    // Auth: if target needs login and session missing
    if (!window.HubAuth?.isLoggedIn?.() && target.requiresAuth && !/^login\.html/i.test(target.url)) {
      const login = window.HubAuth?.loginUrl?.({ next: target.url }) || `login.html?next=${encodeURIComponent(target.url)}`;
      window.location.href = login;
      return { ok: true, redirectedToLogin: true, target };
    }

    window.location.href = target.url;
    return { ok: true, target };
  };

  const enrichNotificationPayload = (payload = {}) => {
    const next = { ...payload };
    if (!next.relatedEntityType && (next.referenceType || next.meta?.referenceType)) {
      next.relatedEntityType = next.referenceType || next.meta?.referenceType;
    }
    if (!next.relatedEntityId && (next.referenceId || next.meta?.referenceId || next.requestId)) {
      next.relatedEntityId = next.referenceId || next.meta?.referenceId || next.requestId;
    }
    if (!next.recipientType) {
      const link = String(next.actionLink || next.link || '');
      if (next.meta?.recipientType) next.recipientType = next.meta.recipientType;
      else if (/dashboard\.html/i.test(link) && !next.customerId) next.recipientType = 'staff';
      else if (next.customerId || next.customerEmail || next.meta?.customerId) next.recipientType = 'customer';
      else next.recipientType = next.recipientType || 'all';
    }
    if (!next.targetUrl) {
      // Store canonical unresolved hint; runtime router still rewrites by role
      next.targetUrl = next.actionLink || next.link || '';
    }
    return next;
  };

  window.HubNotificationRouter = {
    resolveNotificationTarget,
    openNotification,
    notificationsCenterFor,
    enrichNotificationPayload,
    customerTarget,
    staffTarget,
    isDashboardUrl,
    safePath,
  };
})();
