/**
 * مكاتب العميل فقط — ممنوحة عبر منصة/حاضنة/فرع أو المكتب الرئيسي
 */
(() => {
  'use strict';

  const KEY = 'naiosh_client_offices_v1';
  const EMAIL_KEY = 'naiosh_client_office_email';
  const BOOKINGS_KEY = 'naiosh-hub-bookings';

  const blank = () => ({ version: 1, offices: [], updatedAt: new Date().toISOString() });
  const uid = (p = 'coff') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const normEmail = (v) => String(v || '').trim().toLowerCase();

  const read = () => {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return blank();
    }
  };

  const save = (state) => {
    state.updatedAt = new Date().toISOString();
    state.offices = Array.isArray(state.offices) ? state.offices : [];
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  };

  const rememberEmail = (email) => {
    const key = normEmail(email);
    if (!key) return;
    try {
      localStorage.setItem(EMAIL_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const rememberedEmail = () => {
    try {
      return normEmail(localStorage.getItem(EMAIL_KEY) || '');
    } catch {
      return '';
    }
  };

  const listForEmail = (email) => {
    const key = normEmail(email);
    if (!key) return [];
    const map = new Map();
    (read().offices || []).forEach((row) => {
      if (normEmail(row.email) === key) map.set(String(row.id || row.slug || row.host), row);
    });
    try {
      const bookings = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
      (Array.isArray(bookings) ? bookings : []).forEach((row) => {
        if (String(row.kind || '').toLowerCase() !== 'office') return;
        if (normEmail(row.email) !== key) return;
        const id = String(row.subdomain || row.id || `${row.email}-${row.at}`).toLowerCase();
        if (map.has(id)) return;
        map.set(id, {
          id,
          email: key,
          fullName: row.fullName || '',
          phone: row.phone || '',
          officeName: row.sectorName || row.platformName || 'مكتبي',
          slug: String(row.subdomain || '').toLowerCase(),
          host: row.subdomain ? `${String(row.subdomain).toLowerCase()}.naiosh.app` : '',
          country: row.country || '',
          branch: row.branch || '',
          branchLabel: row.branchLabel || '',
          incubator: row.incubator || '',
          incubatorLabel: row.incubatorLabel || '',
          platform: row.platform || row.platformName || '',
          platformLabel: row.platformLabel || row.platformName || '',
          source: row.source || 'booking',
          systems: Array.isArray(row.systems) ? row.systems : [],
          status: 'active',
          at: row.at || new Date().toISOString(),
        });
      });
    } catch {
      /* ignore */
    }
    return [...map.values()];
  };

  const grantFromBooking = (payload = {}) => {
    const email = normEmail(payload.email);
    const slug = String(payload.subdomain || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (!email) return { ok: false, error: 'الإيميل مطلوب' };
    const isFreelancer = String(payload.kind || payload.source || '').toLowerCase() === 'freelancer';
    const isHq =
      isFreelancer ||
      String(payload.source || '').toLowerCase() === 'hq' ||
      (!payload.branch && !payload.incubator);

    const state = read();
    const existing = (state.offices || []).find((o) => {
      if (normEmail(o.email) !== email) return false;
      if (isFreelancer) return o.kind === 'freelancer' || o.source === 'freelancer';
      return Boolean(slug) && String(o.slug || '') === slug;
    });
    if (existing) {
      rememberEmail(email);
      return { ok: true, office: existing, offices: listForEmail(email), reused: true };
    }

    const officeName = String(
      payload.officeName ||
        payload.sectorName ||
        (isFreelancer ? `مكتب فريلانسر — ${payload.fullName || email}` : '') ||
        payload.fullName ||
        'مكتبي'
    ).trim();
    const host = slug ? `${slug}.naiosh.app` : '';
    let structureGrantId = '';
    let subdomainGrantId = '';
    try {
      const structure = window.HubSystemOps?.grantStructure?.({
        type: 'office',
        nameAr: officeName,
        tenantName: payload.fullName || email,
        // الفريلانسر: هيكل مكتب فقط — systemCode فارغ صراحةً = بلا نظام
        systemCode: isFreelancer ? '' : 'ERP',
        refId: isHq ? 'HQ' : payload.platform || payload.incubator || payload.branch || '',
      });
      structureGrantId = structure?.grantId || '';
      if (isFreelancer && structure?.systemCode) {
        // دفاع إضافي لو المحرك القديم ما زال يفرض ERP
        structure.systemCode = '';
      }
    } catch {
      /* ignore */
    }
    // دومين فرعي اختياري — الفريلانسر بلا منصة فلا يُنشأ دومين منصة
    if (slug && !isFreelancer) {
      try {
        const sd = window.HubSystemOps?.grantSubdomain?.({
          tenantName: payload.fullName || officeName,
          systemCode: 'ERP',
          slug,
          branchOrHq: isHq ? 'المكتب الرئيسي' : payload.branchLabel || payload.branch || '',
          incubator: isHq ? '' : payload.incubatorLabel || payload.incubator || '',
          platformName: payload.platformLabel || payload.platform || officeName,
        });
        subdomainGrantId = sd?.grantId || '';
      } catch {
        /* ignore */
      }
    }

    const row = {
      id: uid(),
      email,
      fullName: String(payload.fullName || '').trim(),
      phone: String(payload.phone || '').trim(),
      officeName,
      slug: isFreelancer ? '' : slug,
      host: isFreelancer ? '' : host,
      country: String(payload.country || '').trim(),
      branch: isHq ? '' : String(payload.branch || '').trim(),
      branchLabel: isHq ? 'المكتب الرئيسي' : String(payload.branchLabel || payload.branch || '').trim(),
      incubator: isHq ? '' : String(payload.incubator || '').trim(),
      incubatorLabel: isHq ? '' : String(payload.incubatorLabel || payload.incubator || '').trim(),
      platform: isHq || isFreelancer ? '' : String(payload.platform || payload.platformName || '').trim(),
      platformLabel: isHq || isFreelancer ? '' : String(payload.platformLabel || payload.platformName || '').trim(),
      source: isFreelancer ? 'freelancer' : isHq ? 'hq' : payload.source || 'platform',
      kind: isFreelancer ? 'freelancer' : 'office',
      systems: isFreelancer ? [] : Array.isArray(payload.systems) ? payload.systems : [],
      grants: isFreelancer
        ? { platform: false, system: false, office: true, operatedBy: 'hq' }
        : undefined,
      status: 'active',
      grantId: structureGrantId,
      subdomainGrantId,
      at: new Date().toISOString(),
    };

    state.offices = state.offices || [];
    state.offices.unshift(row);
    save(state);
    rememberEmail(email);
    return { ok: true, office: row, offices: listForEmail(email), reused: false };
  };

  window.HubClientOffices = {
    KEY,
    listForEmail,
    grantFromBooking,
    rememberEmail,
    rememberedEmail,
  };
})();
