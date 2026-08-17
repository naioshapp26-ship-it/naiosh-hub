/**
 * صفحات الحجز — حاضنة · منصة · مكتب
 * نموذج موحّد بالحقول المطلوبة من الواجهة
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-book]');
  if (!root) return;

  const kind = root.getAttribute('data-hub-book') || 'incubator';
  const form = root.querySelector('[data-book-form]');
  const feedback = root.querySelector('[data-book-feedback]');

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

  const params = new URLSearchParams(window.location.search);

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

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

  const sectorOptions = () => {
    const fromLib = (window.HubSectorLibrary?.list?.() || []).map((s) => ({
      id: s.sectorId,
      label: s.sectorNameAr || s.sectorName || s.sectorId,
    }));
    if (fromLib.length) return fromLib;

    const fromInc = window.HubIncubatorsData?.INCUBATORS || [];
    const seen = new Set();
    const out = [];
    fromInc.forEach((inc) => {
      const name = String(inc.sector || '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      out.push({ id: name, label: name });
    });
    return out.length
      ? out
      : [
          { id: 'education', label: 'التعليم والتعلم' },
          { id: 'digital', label: 'التسويق الرقمي' },
          { id: 'health', label: 'الصحة والجمال' },
          { id: 'food', label: 'الطعام والشراب' },
          { id: 'other', label: 'أخرى' },
        ];
  };

  const COUNTRY_ALIASES = {
    'المملكة العربية السعودية': ['السعودية'],
    'الإمارات العربية المتحدة': ['الإمارات'],
    إنجلترا: ['إنجلترا', 'بريطانيا'],
    أمريكا: ['أمريكا', 'الولايات المتحدة'],
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
    fillSelect(el, options, 'اختر الفرع', selected);
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
      { id: 'inc-food', label: 'الطعام والشراب' },
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

  const fileMeta = (input) => {
    const f = input?.files?.[0];
    if (!f) return null;
    return { name: f.name, size: f.size, type: f.type || '' };
  };

  const fillForm = () => {
    const preSector = params.get('sector') || '';
    const preBranch = params.get('branch') || '';
    const preIncubator = params.get('incubator') || '';
    const prePlatform = params.get('platform') || params.get('code') || '';
    const preCountry = params.get('country') || '';

    fillSelect(form?.querySelector('[name="sectorName"]'), sectorOptions(), 'اختر اسم القطاع', preSector);
    fillSelect(form?.querySelector('[name="country"]'), countryList(), 'اختر الدولة', preCountry);
    fillSelect(form?.querySelector('[name="incubator"]'), incubatorOptions(), 'اختر الحاضنة', preIncubator);

    if (preCountry) unlockBranch(preCountry, preBranch);
    else lockBranch('اختر الدولة أولاً');

    const platformEl = form?.querySelector('[name="platform"]');
    if (platformEl) {
      if (platformEl.tagName === 'SELECT') {
        fillSelect(platformEl, platformOptions(), 'اختر المنصة', prePlatform);
      } else if (prePlatform) {
        platformEl.value = prePlatform;
      }
    }
  };

  form?.querySelector('[name="country"]')?.addEventListener('change', (event) => {
    const country = String(event.target.value || '').trim();
    if (!country) lockBranch('اختر الدولة أولاً');
    else unlockBranch(country);
  });

  const kindLabel =
    kind === 'incubator' ? 'حاضنة' : kind === 'platform' ? 'منصة' : 'مكتب';

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const subdomain = String(data.get('subdomain') || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    const payload = {
      kind,
      sectorName: String(data.get('sectorName') || '').trim(),
      subdomain,
      branch: String(data.get('branch') || '').trim(),
      fullName: String(data.get('fullName') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      country: String(data.get('country') || '').trim(),
      platform: String(data.get('platform') || params.get('platform') || params.get('code') || '').trim(),
      incubator: String(data.get('incubator') || '').trim(),
      profileFile: fileMeta(form.querySelector('[name="profileFile"]')),
      imageFile: fileMeta(form.querySelector('[name="imageFile"]')),
      videoFile: fileMeta(form.querySelector('[name="videoFile"]')),
      summary: String(data.get('summary') || '').trim(),
      at: new Date().toISOString(),
    };

    try {
      const key = 'naiosh-hub-bookings';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift(payload);
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
    } catch {
      /* ignore storage errors */
    }

    const targetLabel =
      payload.platform || payload.incubator || payload.branch || payload.sectorName || kind;
    window.HubStore?.pushFeed?.(
      'decision',
      `طلب حجز ${kindLabel}: ${targetLabel} — ${payload.fullName}`
    );

    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = `تم استلام طلب حجز ال${kindLabel}. فريق هوب بيتواصل معك خلال 24 ساعة لتأكيد الموعد والمسار.`;
    }
    form.reset();
    fillForm();
  });

  fillForm();
})();
