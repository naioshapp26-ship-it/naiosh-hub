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
  const from = String(params.get('from') || '').toLowerCase();
  const isIncubatorPlatform = kind === 'platform' && from === 'incubator';
  const isHqPlatform = kind === 'platform' && from === 'hq';
  const isBranchIncubator = kind === 'incubator';
  const needsBranchScopedIncubators = isIncubatorPlatform || isBranchIncubator;
  const needsWorkSystems = isIncubatorPlatform || isHqPlatform;

  const applySourceCopy = () => {
    const h1 = root.querySelector('.hub-feature-hero h1');
    const kicker = root.querySelector('.hub-feature-kicker');
    const lead = root.querySelector('.hub-feature-hero p');
    if (isHqPlatform) {
      document.title = 'احجز منصة من المكتب الرئيسي | نايوش هوب 360';
      if (h1) h1.textContent = 'احجز منصة من المكتب الرئيسي';
      if (kicker) kicker.innerHTML = '<i class="fas fa-building"></i> حجز منصة عبر المقر';
      if (lead) {
        lead.textContent =
          'منصات تُمنح من قبل المكتب الرئيسي بدون فروع ولا حاضنات. يتم ربط المنصة بمنصتي. عند الكبس على منصتي الموجودة في المنيو المنسدل من اليمين تفتح فقط منصات العميل. وتُمنح أنظمة تشغيلية حسب حاجة العمل.';
      }
    }
    if (isIncubatorPlatform) {
      document.title = 'إحجز منصة من حاضنة | نايوش هوب 360';
      if (h1) h1.textContent = 'إحجز منصة من حاضنة';
      if (kicker) kicker.innerHTML = '<i class="fas fa-seedling"></i> حجز منصة داخل الحاضنة';
      if (lead) {
        lead.textContent =
          'تُمنح المنصة من خلال حاضنة تابعة لفرع. يتم ربط المنصة بمنصتي. عند الكبس على منصتي في المنيو المنسدل من اليمين تفتح فقط منصات العميل. وتُمنح أنظمة تشغيلية حسب حاجة العمل.';
      }
    }
    if (isBranchIncubator) {
      document.title = 'احجز حاضنة من فرع | نايوش هوب 360';
      if (h1) h1.textContent = 'احجز حاضنة من فرع';
      if (kicker) kicker.innerHTML = '<i class="fas fa-code-branch"></i> حجز حاضنة عبر الفرع';
      if (lead) {
        lead.textContent =
          'تُمنح الحاضنة من خلال الفرع التابعة له عند التسجيل. وعند الكبس على حاضنتي تفتح فقط الحاضنات الخاصة بالعميل، وتكون من خلال أيقونة واحدة والموجودة في المنيو المنسدل من يمين الشاشة.';
      }
    }

    root.querySelectorAll('[data-from-incubator]').forEach((el) => {
      el.hidden = !isIncubatorPlatform;
    });
    root.querySelectorAll('[data-from-hq]').forEach((el) => {
      el.hidden = !isHqPlatform;
    });
    root.querySelectorAll('[data-from-generic]').forEach((el) => {
      el.hidden = isIncubatorPlatform || isHqPlatform;
    });
    root.querySelectorAll('[data-not-hq]').forEach((el) => {
      el.hidden = isHqPlatform;
    });
    root.querySelectorAll('[data-work-systems]').forEach((el) => {
      el.hidden = !needsWorkSystems;
    });

    const nameEl = form?.querySelector('[name="platformName"]');
    if (nameEl) nameEl.required = isIncubatorPlatform || isHqPlatform || kind === 'platform';

    if (isHqPlatform) {
      const branchEl = form?.querySelector('[name="branch"]');
      const incubatorEl = form?.querySelector('[name="incubator"]');
      if (branchEl) {
        branchEl.required = false;
        branchEl.disabled = true;
      }
      if (incubatorEl) {
        incubatorEl.required = false;
        incubatorEl.disabled = true;
      }
    }
  };
  applySourceCopy();

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

  const incubatorOptionsAll = () => {
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

  const incubatorOptionsForBranch = (branchId) => {
    const list =
      window.HubClientIncubators?.incubatorsForBranch?.(branchId) ||
      window.HubClientPlatforms?.incubatorsForBranch?.(branchId) ||
      [];
    return (list || []).map((inc) => ({
      id: inc.id,
      label: `${inc.num ? `${inc.num}. ` : ''}${inc.name}${inc.sector ? ` — ${inc.sector}` : ''}`,
    }));
  };

  const lockIncubator = (placeholder) => {
    const el = form?.querySelector('[name="incubator"]');
    if (!el) return;
    fillSelect(el, [], placeholder);
    el.disabled = true;
  };

  const unlockIncubator = (branchId, selected) => {
    const el = form?.querySelector('[name="incubator"]');
    if (!el) return;
    if (needsBranchScopedIncubators) {
      const options = incubatorOptionsForBranch(branchId);
      fillSelect(el, options, options.length ? 'اختر حاضنة تابعة للفرع' : 'لا حاضنة تابعة لهذا الفرع', selected);
      el.disabled = !branchId || !options.length;
      if (options.length === 1 && branchId) el.value = options[0].id;
      return;
    }
    fillSelect(el, incubatorOptionsAll(), 'اختر الحاضنة', selected);
    el.disabled = false;
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

  const selectedLabel = (name) => {
    const el = form?.querySelector(`[name="${name}"]`);
    const opt = el?.selectedOptions?.[0];
    return String(opt?.textContent || '').trim();
  };

  const systemsRequiredEl = () => form?.querySelector('[data-systems-required]');

  const selectedSystems = () =>
    [...(form?.querySelectorAll('[name="systems"]:checked') || [])].map((el) => ({
      code: el.value,
      label: String(el.getAttribute('data-label') || el.value),
    }));

  const syncSystemsRequired = () => {
    const proxy = systemsRequiredEl();
    if (!proxy) return;
    if (!needsWorkSystems) {
      proxy.required = false;
      proxy.setCustomValidity('');
      return;
    }
    const n = selectedSystems().length;
    proxy.required = true;
    proxy.value = n ? String(n) : '';
    proxy.setCustomValidity(n ? '' : 'اختر نظامًا تشغيليًا واحدًا على الأقل حسب حاجة العمل');
  };

  const fillSystems = () => {
    const mount = form?.querySelector('[data-book-systems-list]');
    if (!mount) return;
    const options = window.HubClientPlatforms?.systemOptions?.() || [];
    mount.innerHTML = options
      .map(
        (s) => `<label class="hub-book-system-item">
          <input type="checkbox" name="systems" value="${esc(s.code)}" data-label="${esc(s.label)}" />
          <span>${esc(s.label)} <small dir="ltr">${esc(s.code)}</small></span>
        </label>`
      )
      .join('');
    mount.querySelectorAll('[name="systems"]').forEach((el) => {
      el.addEventListener('change', syncSystemsRequired);
    });
    syncSystemsRequired();
  };

  const fillForm = () => {
    const preSector = params.get('sector') || '';
    const preBranch = params.get('branch') || '';
    const preIncubator = params.get('incubator') || '';
    const prePlatform = params.get('platform') || params.get('code') || '';
    const preCountry = params.get('country') || '';

    fillSelect(form?.querySelector('[name="sectorName"]'), sectorOptions(), 'اختر اسم القطاع', preSector);
    fillSelect(form?.querySelector('[name="country"]'), countryList(), 'اختر الدولة', preCountry);

    if (isHqPlatform) {
      lockBranch('بدون فرع — المنح من المكتب الرئيسي');
      lockIncubator('بدون حاضنة — المنح من المكتب الرئيسي');
    } else {
      if (preCountry) unlockBranch(preCountry, preBranch);
      else lockBranch('اختر الدولة أولاً');

      const branchNow = String(form?.querySelector('[name="branch"]')?.value || preBranch || '').trim();
      if (needsBranchScopedIncubators) {
        if (branchNow) unlockIncubator(branchNow, preIncubator);
        else lockIncubator('اختر الفرع أولاً لعرض حاضناته');
      } else {
        unlockIncubator('', preIncubator);
      }
    }

    const platformEl = form?.querySelector('[name="platform"]');
    if (platformEl) {
      if (platformEl.tagName === 'SELECT') {
        fillSelect(platformEl, platformOptions(), 'اختر المنصة', prePlatform);
      } else if (prePlatform) {
        platformEl.value = prePlatform;
      }
    }

    if (prePlatform && form?.querySelector('[name="platformName"]') && !form.querySelector('[name="platformName"]').value) {
      const match = platformOptions().find((p) => p.id === prePlatform);
      form.querySelector('[name="platformName"]').value = match?.label || prePlatform;
    }

    fillSystems();
  };

  form?.querySelector('[name="country"]')?.addEventListener('change', (event) => {
    if (isHqPlatform) return;
    const country = String(event.target.value || '').trim();
    if (!country) lockBranch('اختر الدولة أولاً');
    else unlockBranch(country);
    if (needsBranchScopedIncubators) lockIncubator('اختر الفرع أولاً لعرض حاضناته');
  });

  form?.querySelector('[name="branch"]')?.addEventListener('change', (event) => {
    if (!needsBranchScopedIncubators) return;
    const branchId = String(event.target.value || '').trim();
    if (!branchId) lockIncubator('اختر الفرع أولاً لعرض حاضناته');
    else unlockIncubator(branchId);
  });

  const kindLabel =
    kind === 'incubator' ? 'حاضنة' : kind === 'platform' ? 'منصة' : 'مكتب';

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    syncSystemsRequired();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const subdomain = String(data.get('subdomain') || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    const platformName = String(data.get('platformName') || '').trim();
    const systems = selectedSystems();

    const payload = {
      kind,
      source: isHqPlatform ? 'hq' : from,
      sectorName: String(data.get('sectorName') || '').trim(),
      subdomain,
      branch: isHqPlatform ? '' : String(data.get('branch') || '').trim(),
      branchLabel: isHqPlatform ? 'المكتب الرئيسي' : selectedLabel('branch'),
      fullName: String(data.get('fullName') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      country: String(data.get('country') || '').trim(),
      platform: String(data.get('platform') || platformName || params.get('platform') || params.get('code') || '').trim(),
      platformName: platformName || String(data.get('platform') || '').trim(),
      incubator: isHqPlatform ? '' : String(data.get('incubator') || '').trim(),
      incubatorLabel: isHqPlatform ? '' : selectedLabel('incubator'),
      systems,
      profileFile: fileMeta(form.querySelector('[name="profileFile"]')),
      imageFile: fileMeta(form.querySelector('[name="imageFile"]')),
      videoFile: fileMeta(form.querySelector('[name="videoFile"]')),
      summary: String(data.get('summary') || '').trim(),
      at: new Date().toISOString(),
    };

    let grant = null;
    if (isBranchIncubator && window.HubClientIncubators?.grantFromBooking) {
      const allowed = incubatorOptionsForBranch(payload.branch).some((o) => String(o.id) === String(payload.incubator));
      if (!allowed) {
        if (feedback) {
          feedback.hidden = false;
          feedback.classList.add('is-error');
          feedback.classList.remove('is-ok');
          feedback.textContent = 'الحاضنة يجب أن تكون تابعة للفرع المختار.';
        }
        return;
      }
      grant = window.HubClientIncubators.grantFromBooking(payload);
      if (!grant?.ok) {
        if (feedback) {
          feedback.hidden = false;
          feedback.classList.add('is-error');
          feedback.classList.remove('is-ok');
          feedback.textContent = grant?.error || 'تعذر منح الحاضنة. راجع البيانات.';
        }
        return;
      }
    }
    if ((isIncubatorPlatform || isHqPlatform) && window.HubClientPlatforms?.grantFromBooking) {
      grant = window.HubClientPlatforms.grantFromBooking(payload);
      if (!grant?.ok) {
        if (feedback) {
          feedback.hidden = false;
          feedback.classList.add('is-error');
          feedback.classList.remove('is-ok');
          feedback.textContent = grant?.error || 'تعذر منح المنصة. راجع البيانات.';
        }
        return;
      }
    }

    try {
      const key = 'naiosh-hub-bookings';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift(payload);
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
    } catch {
      /* ignore storage errors */
    }

    const targetLabel =
      payload.platformName || payload.platform || payload.incubator || payload.branch || payload.sectorName || kind;
    window.HubStore?.pushFeed?.(
      'decision',
      `طلب حجز ${kindLabel}: ${targetLabel} — ${payload.fullName}`
    );

    if (feedback) {
      feedback.hidden = false;
      feedback.classList.remove('is-error');
      feedback.classList.add('is-ok');
      if (isBranchIncubator && grant?.ok) {
        const emailQ = encodeURIComponent(payload.email);
        feedback.innerHTML = `تم منح الحاضنة <strong>${esc(payload.incubatorLabel || payload.incubator)}</strong> من خلال الفرع التابعة له وربطها بحاضنتي. <a href="my-incubator.html?email=${emailQ}">افتح حاضنتي — حاضناتك فقط</a>`;
      } else if (isHqPlatform && grant?.ok) {
        const emailQ = encodeURIComponent(payload.email);
        feedback.innerHTML = `تم منح المنصة <strong>${esc(payload.platformName)}</strong> من المكتب الرئيسي بدون فروع ولا حاضنات وربطها بمنصتي. الأنظمة الممنوحة: ${esc(
          systems.map((s) => s.code).join(' · ') || '—'
        )}. <a href="my-platform.html?email=${emailQ}">افتح منصتي — منصاتك فقط</a>`;
      } else if (isIncubatorPlatform && grant?.ok) {
        const emailQ = encodeURIComponent(payload.email);
        feedback.innerHTML = `تم منح المنصة <strong>${esc(payload.platformName)}</strong> عبر حاضنة تابعة للفرع وربطها بمنصتي. الأنظمة الممنوحة: ${esc(
          systems.map((s) => s.code).join(' · ') || '—'
        )}. <a href="my-platform.html?email=${emailQ}">افتح منصتي — منصاتك فقط</a>`;
      } else {
        feedback.textContent = `تم استلام طلب حجز ال${kindLabel}. فريق هوب بيتواصل معك خلال 24 ساعة لتأكيد الموعد والمسار.`;
      }
    }
    form.reset();
    fillForm();
  });

  fillForm();
})();
