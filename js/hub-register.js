/**
 * سجل معنا — المستأجر يعبّئ النموذج بنفسه ثم ينتظر موافقة السوبر أدمن
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-register]');
  if (!root) return;

  const form = root.querySelector('[data-register-form]');
  const feedback = root.querySelector('[data-register-feedback]');
  const statusEl = root.querySelector('[data-subdomain-status]');
  const grants = () => window.HubPlatformGrants;

  let subdomainOk = false;

  const COUNTRIES = [
    'المملكة العربية السعودية',
    'الإمارات العربية المتحدة',
    'الكويت',
    'قطر',
    'البحرين',
    'عُمان',
    'الأردن',
    'مصر',
    'العراق',
    'سوريا',
    'لبنان',
    'فلسطين',
    'اليمن',
    'المغرب',
    'الجزائر',
    'تونس',
    'ليبيا',
    'السودان',
    'موريتانيا',
    'تركيا',
    'أخرى',
  ];

  const COUNTRY_ALIASES = {
    'المملكة العربية السعودية': ['السعودية'],
    'الإمارات العربية المتحدة': ['الإمارات'],
    إنجلترا: ['إنجلترا', 'بريطانيا'],
    أمريكا: ['أمريكا', 'الولايات المتحدة'],
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg, ok = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.classList.toggle('is-error', !ok);
    feedback.classList.toggle('is-ok', ok);
  };

  const fillSelect = (el, options, placeholder, selected) => {
    if (!el) return;
    el.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      options
        .map((o) => {
          const id = typeof o === 'string' ? o : o.id;
          const label = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(id)}">${esc(label)}</option>`;
        })
        .join('');
    if (selected) {
      const has = options.some((o) => String(typeof o === 'string' ? o : o.id) === String(selected));
      if (has) el.value = String(selected);
    }
  };

  const countryList = () => {
    const fromBranches = (window.HubBranchesData?.COUNTRIES || []).map((c) => c.nameAr);
    const seen = new Set();
    const out = [];
    [...fromBranches, ...COUNTRIES].forEach((name) => {
      const n = String(name || '').trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    });
    return out;
  };

  const branchMatchesCountry = (branch, country) => {
    if (!country) return false;
    const aliases = COUNTRY_ALIASES[country] || [];
    const hay = [branch.nameAr, branch.nameEn, branch.code].map((x) => String(x || '').trim()).filter(Boolean);
    const needles = [country, ...aliases];
    return hay.some((n) => needles.some((c) => c && (n === c || n.includes(c) || c.includes(n))));
  };

  const branchOptions = (country = '') => {
    const list = window.HubBranchesData?.BRANCHES || [];
    if (!country) return [];
    const matched = list.filter((b) => b.code !== 'HQ' && branchMatchesCountry(b, country));
    if (matched.length) {
      return matched.map((b) => ({
        id: b.id,
        label: `${b.nameAr}${b.type ? ` — ${b.type}` : ''}`,
      }));
    }
    return [{ id: `br-${country}`, label: `فرع ${country}` }];
  };

  const lockBranch = (placeholder) => {
    const el = form?.querySelector('[name="branch"]');
    if (!el) return;
    fillSelect(el, [], placeholder);
    el.disabled = true;
  };

  const unlockBranch = (country, selected) => {
    const el = form?.querySelector('[name="branch"]');
    if (!el) return;
    const options = branchOptions(country);
    fillSelect(el, options, 'اختر اسم الفرع', selected);
    el.disabled = !country;
    if (options.length === 1 && country) el.value = options[0].id;
  };

  const incubatorOptions = () => {
    const list = window.HubIncubatorsData?.INCUBATORS || [];
    if (list.length) {
      return list.slice(0, 80).map((inc) => ({
        id: inc.id,
        label: `${inc.num ? `${inc.num}. ` : ''}${inc.name}${inc.sector ? ` — ${inc.sector}` : ''}`,
      }));
    }
    return [
      { id: 'inc-edu', label: 'التعليم والتعلم' },
      { id: 'inc-digital', label: 'التسويق الرقمي' },
      { id: 'inc-health', label: 'الصحة والجمال' },
      { id: 'inc-business', label: 'عالم الأعمال' },
    ];
  };

  const platformOptions = () => {
    const list = window.HubSovereignPlatforms?.list || [];
    if (list.length) {
      return list.map((p) => ({
        id: p.code,
        label: `${p.nameAr}${p.role ? ` — ${p.role}` : ''}`,
      }));
    }
    return [
      { id: 'core', label: 'المنصة المركزية' },
      { id: 'ops', label: 'منصة التشغيل' },
      { id: 'gov', label: 'منصة الحوكمة' },
    ];
  };

  const systemOptions = () => {
    const fromRent = window.HubRentStore?.catalogSystems?.() || [];
    if (fromRent.length) {
      return fromRent.map((s) => ({
        id: s.code,
        label: `${s.nameAr || s.code}${s.isLive ? ' — جاهز' : ''}`,
      }));
    }
    const apps = window.HubMarketplaceData?.APPS || [];
    const filtered = apps.filter((a) => a.code && a.kind !== 'sovereign');
    if (filtered.length) {
      return filtered.map((a) => ({ id: String(a.code).toUpperCase(), label: a.nameAr || a.code }));
    }
    return [
      { id: 'ERP', label: 'ERP' },
      { id: 'CRM', label: 'CRM' },
      { id: 'LMS', label: 'LMS' },
      { id: 'ACADEMY', label: 'Academy' },
    ];
  };

  const selectedLabel = (name) =>
    form?.querySelector(`[name="${name}"]`)?.selectedOptions?.[0]?.textContent?.trim() || '';

  const checkSubdomain = () => {
    const input = form?.querySelector('[name="subdomain"]');
    if (!input || !statusEl || !grants()) return;
    const raw = grants().normalizeSlug(input.value);
    input.value = raw;
    const res = grants().validateSubdomain(raw);
    subdomainOk = Boolean(res.available);
    statusEl.innerHTML = res.available
      ? `<i class="fas fa-circle-check"></i> ${esc(res.message)}`
      : raw
        ? `<i class="fas fa-circle-xmark"></i> ${esc(res.message)}`
        : esc(res.message);
    statusEl.className = `hub-book-subdomain-status ${res.available ? 'is-ok' : raw ? 'is-bad' : ''}`;
  };

  const fillForm = () => {
    const params = new URLSearchParams(window.location.search);
    fillSelect(form?.querySelector('[name="country"]'), countryList(), 'اختر الدولة', params.get('country') || '');
    fillSelect(form?.querySelector('[name="incubator"]'), incubatorOptions(), 'اختر اسم الحاضنة', params.get('incubator') || '');
    fillSelect(form?.querySelector('[name="platform"]'), platformOptions(), 'اختر اسم المنصة', params.get('platform') || params.get('code') || '');
    fillSelect(form?.querySelector('[name="requestedSystem"]'), systemOptions(), 'اختر النظام', params.get('system') || '');
    const country = params.get('country') || '';
    if (country) unlockBranch(country, params.get('branch') || '');
    else lockBranch('اختر الدولة أولاً');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form || !grants()) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    checkSubdomain();
    if (!subdomainOk) {
      toast('تحقق من توفر النطاق الفرعي أولًا');
      return;
    }

    const fd = new FormData(form);
    const res = grants().submitRequest({
      source: 'register',
      companyName: selectedLabel('platform') || String(fd.get('fullName') || '').trim(),
      subdomain: String(fd.get('subdomain') || '').trim(),
      adminName: String(fd.get('fullName') || '').trim(),
      adminPhone: String(fd.get('phone') || '').trim(),
      adminEmail: String(fd.get('email') || '').trim(),
      adminPassword: String(fd.get('password') || ''),
      country: String(fd.get('country') || '').trim(),
      branch: String(fd.get('branch') || '').trim(),
      branchLabel: selectedLabel('branch'),
      incubator: String(fd.get('incubator') || '').trim(),
      incubatorLabel: selectedLabel('incubator'),
      platform: String(fd.get('platform') || '').trim(),
      platformLabel: selectedLabel('platform'),
      requestedSystem: String(fd.get('requestedSystem') || '').trim(),
      requestedSystemLabel: selectedLabel('requestedSystem'),
      notes: String(fd.get('notes') || '').trim(),
    });

    if (!res.ok) {
      toast(res.error || 'تعذّر إرسال الطلب');
      return;
    }

    toast('تم إرسال الطلب إلى السوبر أدمن. بعد الموافقة يُمنح الدومين والنظام من الأدوار والصلاحيات، وتستطيع الدخول بنفس الإيميل.', true);
    form.reset();
    subdomainOk = false;
    fillForm();
    if (statusEl) {
      statusEl.textContent = 'أدخل النطاق الفرعي للتحقق من توفره';
      statusEl.className = 'hub-book-subdomain-status';
    }
  };

  const bind = async () => {
    fillForm();

    const suffix = root.querySelector('[data-subdomain-suffix]');
    if (suffix && grants()) suffix.textContent = `.${grants().BASE_DOMAIN}`;

    form?.querySelector('[name="country"]')?.addEventListener('change', (event) => {
      const country = String(event.target.value || '').trim();
      if (!country) lockBranch('اختر الدولة أولاً');
      else unlockBranch(country);
    });

    let timer = null;
    form?.querySelector('[name="subdomain"]')?.addEventListener('input', () => {
      clearTimeout(timer);
      subdomainOk = false;
      if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق…';
        statusEl.className = 'hub-book-subdomain-status';
      }
      timer = setTimeout(checkSubdomain, 400);
    });

    form?.addEventListener('submit', onSubmit);
    try {
      await grants()?.hydrate?.();
    } catch {
      /* local ok */
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
