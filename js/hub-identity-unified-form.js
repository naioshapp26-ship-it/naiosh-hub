/**
 * Unified 360 human identity form — one component for client / employee / both.
 * Does not invent incubator/platform options; loads from /api/hub/catalog/*.
 */
(function (global) {
  'use strict';

  const CSS_ID = 'hub-identity-unified-form-css';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    const link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'css/hub-identity-unified-form.css?v=1';
    document.head.appendChild(link);
  }

  async function fetchJson(url) {
    const token =
      localStorage.getItem('hubAuthToken') ||
      sessionStorage.getItem('hubAuthToken') ||
      localStorage.getItem('hub_token') ||
      sessionStorage.getItem('hub_token') ||
      localStorage.getItem('hub360_token') ||
      '';
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'X-Hub-Token': token } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function relationFromModes(modes) {
    const client = !!modes?.client;
    const employee = !!modes?.employee;
    if (client && employee) return 'both';
    if (employee) return 'employee';
    return 'client';
  }

  /**
   * @param {HTMLElement} host
   * @param {object} opts
   * @param {object} [opts.values]
   * @param {'client'|'employee'|'both'} [opts.defaultRelation]
   * @param {boolean} [opts.lockRelation] — hide relation toggles
   * @param {boolean} [opts.creating]
   * @param {boolean} [opts.disabled]
   * @param {string[]} [opts.roles] — employee role options {code,label}[]
   */
  async function mount(host, opts = {}) {
    if (!host) return null;
    ensureCss();
    const values = opts.values || {};
    const creating = opts.creating !== false && !opts.editMode;
    const disabled = !!opts.disabled;
    let relation = opts.defaultRelation || 'client';
    if (values.relation) relation = values.relation;
    if (opts.lockRelation && opts.defaultRelation) relation = opts.defaultRelation;

    host.classList.add('hub-id360');
    host.innerHTML = `
      <div class="hub-id360-section" data-id360-base>
        <h4 class="hub-id360-title">الهوية الأساسية</h4>
        <p class="hub-id360-hint">رقم الحساب (ACC) يُشتق من البريد بعد الحفظ — لا يُنشأ شخص مكرر لنفس البريد.</p>
        <div class="hub-id360-grid">
          <label class="hub-id360-field">الاسم *<input data-id360="name" value="${esc(values.name || '')}" ${disabled ? 'disabled' : ''} required /></label>
          <label class="hub-id360-field">البريد *<input data-id360="email" type="email" dir="ltr" value="${esc(values.email || '')}" ${disabled || !creating ? 'disabled' : ''} required /></label>
          <label class="hub-id360-field">الجوال *<input data-id360="phone" dir="ltr" value="${esc(values.phone || '')}" placeholder="05xxxxxxxx" ${disabled ? 'disabled' : ''} /></label>
          <label class="hub-id360-field">الدولة<input data-id360="country" value="${esc(values.country || '')}" ${disabled ? 'disabled' : ''} /></label>
          <label class="hub-id360-field">المدينة<input data-id360="city" value="${esc(values.city || '')}" ${disabled ? 'disabled' : ''} /></label>
          <label class="hub-id360-field">العنوان<input data-id360="address" value="${esc(values.address || '')}" ${disabled ? 'disabled' : ''} /></label>
        </div>
      </div>
      ${
        opts.lockRelation
          ? `<input type="hidden" data-id360="relation" value="${esc(relation)}" />`
          : `<div class="hub-id360-section" data-id360-relation>
        <h4 class="hub-id360-title">نوع العلاقة بالمنظومة</h4>
        <div class="hub-id360-rel">
          <label><input type="checkbox" data-id360-rel="client" ${relation === 'client' || relation === 'both' ? 'checked' : ''} ${disabled ? 'disabled' : ''}/> عميل</label>
          <label><input type="checkbox" data-id360-rel="employee" ${relation === 'employee' || relation === 'both' ? 'checked' : ''} ${disabled ? 'disabled' : ''}/> موظف</label>
        </div>
        <p class="hub-id360-hint">إضافة شخص كعميل لا تمنحه صلاحيات موظف أو مسؤول.</p>
      </div>`
      }
      <div class="hub-id360-section ${relation === 'employee' ? 'hidden' : ''}" data-id360-client>
        <h4 class="hub-id360-title">ارتباط العميل بالمنظومة *</h4>
        <div class="hub-id360-grid">
          <label class="hub-id360-field">الحاضنة *
            <select data-id360="incubatorId" ${disabled ? 'disabled' : ''}>
              <option value="">— اختر حاضنة مسجّلة —</option>
            </select>
          </label>
          <label class="hub-id360-field">المنصة *
            <select data-id360="platformCode" ${disabled ? 'disabled' : ''}>
              <option value="">— اختر منصة مسجّلة —</option>
            </select>
          </label>
        </div>
        <p class="hub-id360-empty muted" data-id360-catalog-msg hidden></p>
        <div data-hub-geo-branch data-id360-geo
          data-geo-branch="${esc(values.branchName || values.branch || '')}"
          data-geo-country="${esc(values.country || '')}"
          data-geo-city="${esc(values.city || '')}"
          data-geo-address="${esc(values.address || '')}"
          data-geo-lat="${esc(values.lat != null ? values.lat : '')}"
          data-geo-lng="${esc(values.lng != null ? values.lng : '')}"
          data-geo-source="${esc(values.locationSource || 'manual')}"
          data-geo-confirmed="${values.locationConfirmed ? '1' : ''}"
        ></div>
        <div class="hub-id360-grid" style="margin-top:10px">
          <label class="hub-id360-field">نوع العميل
            <select data-id360="clientType" ${disabled ? 'disabled' : ''}>
              <option value="">—</option>
              <option value="فرد" ${(values.clientType || '') === 'فرد' ? 'selected' : ''}>فرد</option>
              <option value="مؤسسة" ${(values.clientType || '') === 'مؤسسة' ? 'selected' : ''}>مؤسسة</option>
            </select>
          </label>
          <label class="hub-id360-field">المؤسسة / الشركة<input data-id360="company" value="${esc(values.company || '')}" ${disabled ? 'disabled' : ''} /></label>
          <label class="hub-id360-field">الحالة
            <select data-id360="status" ${disabled ? 'disabled' : ''}>
              ${['pending', 'active', 'suspended']
                .map(
                  (s) =>
                    `<option value="${s}" ${(values.status || 'pending') === s ? 'selected' : ''}>${s === 'pending' ? 'قيد الانتظار' : s === 'active' ? 'نشط' : 'موقوف'}</option>`
                )
                .join('')}
            </select>
          </label>
        </div>
      </div>
      <div class="hub-id360-section ${relation === 'client' ? 'hidden' : ''}" data-id360-employee>
        <h4 class="hub-id360-title">التبعية الوظيفية والصلاحيات</h4>
        <div class="hub-id360-grid">
          <label class="hub-id360-field">جهة العمل
            <select data-id360="affiliationKind" ${disabled ? 'disabled' : ''}>
              <option value="naiosh" ${(values.affiliationKind || 'naiosh') === 'naiosh' ? 'selected' : ''}>نايوش</option>
              <option value="external" ${values.affiliationKind === 'external' ? 'selected' : ''}>جهة خارجية</option>
            </select>
          </label>
          <label class="hub-id360-field">اسم الجهة<input data-id360="orgName" value="${esc(values.orgName || 'نايوش')}" ${disabled ? 'disabled' : ''} /></label>
          <label class="hub-id360-field">القسم / مكان العمل<input data-id360="department" value="${esc(values.department || values.workplace || '')}" ${disabled ? 'disabled' : ''} /></label>
          <label class="hub-id360-field">الدور الإداري
            <select data-id360="role" ${disabled ? 'disabled' : ''}>
              ${(opts.roles || [{ code: 'admin', label: 'إداري' }])
                .filter((r) => r.code !== 'supreme_leader')
                .map(
                  (r) =>
                    `<option value="${esc(r.code)}" ${values.role === r.code ? 'selected' : ''}>${esc(r.label || r.code)}</option>`
                )
                .join('')}
            </select>
          </label>
          ${
            creating && opts.requireEmployeePassword !== false
              ? `<label class="hub-id360-field">كلمة مرور مؤقتة *<input data-id360="temporaryPassword" type="password" autocomplete="new-password" ${disabled ? 'disabled' : ''} /></label>`
              : creating
                ? `<label class="hub-id360-field">كلمة مرور مؤقتة (اختياري عند الربط لاحقًا)<input data-id360="temporaryPassword" type="password" autocomplete="new-password" ${disabled ? 'disabled' : ''} /></label>`
                : ''
          }
        </div>
        <div data-id360-perms class="hub-id360-perms"></div>
      </div>
      <p class="hub-id360-error" data-id360-error hidden></p>
    `;

    const state = {
      host,
      relation,
      incubators: [],
      platforms: [],
      opts,
    };

    function syncRelationUI() {
      if (!opts.lockRelation) {
        const c = !!host.querySelector('[data-id360-rel="client"]')?.checked;
        const e = !!host.querySelector('[data-id360-rel="employee"]')?.checked;
        if (!c && !e) {
          host.querySelector('[data-id360-rel="client"]').checked = true;
          state.relation = 'client';
        } else {
          state.relation = relationFromModes({ client: c, employee: e });
        }
      } else {
        state.relation = relation;
      }
      host.querySelector('[data-id360-client]')?.classList.toggle('hidden', state.relation === 'employee');
      host.querySelector('[data-id360-employee]')?.classList.toggle('hidden', state.relation === 'client');
    }

    host.querySelectorAll('[data-id360-rel]').forEach((el) => {
      el.addEventListener('change', syncRelationUI);
    });
    syncRelationUI();

    // Mount geo branch (free-text branch + map — no catalog lists)
    const geoHost = host.querySelector('[data-id360-geo]');
    if (geoHost && global.HubGeoBranch?.mount) {
      try {
        delete geoHost.dataset.hubGeoMounted;
        geoHost.classList.remove('hub-geo');
        global.HubGeoBranch.mount(geoHost, {
          required: true,
          title: 'اكتب اسم الفرع التابع لك أو حدّد موقعك',
          values: {
            branchName: values.branchName || values.branch || '',
            country: values.country || '',
            city: values.city || '',
            address: values.address || '',
            lat: values.lat,
            lng: values.lng,
            locationSource: values.locationSource || 'manual',
            locationConfirmed: !!values.locationConfirmed,
          },
        });
      } catch (err) {
        console.warn('[id360] geo mount', err);
      }
    }

    // Load catalogs
    const msg = host.querySelector('[data-id360-catalog-msg]');
    const incSel = host.querySelector('[data-id360="incubatorId"]');
    const platSel = host.querySelector('[data-id360="platformCode"]');
    try {
      const inc = await fetchJson('/api/hub/catalog/incubators');
      state.incubators = inc.data?.incubators || [];
      if (incSel) {
        state.incubators.forEach((row) => {
          const opt = document.createElement('option');
          opt.value = row.id;
          opt.textContent = row.name_ar;
          if (String(values.incubatorId || '') === String(row.id) || values.incubatorName === row.name_ar) {
            opt.selected = true;
          }
          incSel.appendChild(opt);
        });
      }
      if (!state.incubators.length && msg) {
        msg.hidden = false;
        msg.textContent = inc.data?.message || 'لا توجد حاضنات مسجّلة — لا يمكن اختراع خيارات.';
      }
    } catch (err) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'تعذر تحميل الحاضنات من الخادم.';
      }
    }

    async function loadPlatforms() {
      if (!platSel) return;
      const keep = platSel.value || values.platformCode || '';
      platSel.innerHTML = '<option value="">— اختر منصة مسجّلة —</option>';
      const incubatorId = incSel?.value || '';
      const q = incubatorId ? `?incubatorId=${encodeURIComponent(incubatorId)}` : '';
      try {
        const plat = await fetchJson('/api/hub/catalog/platforms' + q);
        state.platforms = plat.data?.platforms || [];
        state.platforms.forEach((row) => {
          const opt = document.createElement('option');
          opt.value = row.code;
          opt.textContent = `${row.name_ar} (${row.code})`;
          if (keep && (keep === row.code || keep === row.id)) opt.selected = true;
          platSel.appendChild(opt);
        });
        if (!state.platforms.length && msg) {
          msg.hidden = false;
          msg.textContent = plat.data?.message || 'لا توجد منصات مسجّلة — لا يمكن اختراع خيارات.';
        }
      } catch {
        if (msg) {
          msg.hidden = false;
          msg.textContent = 'تعذر تحميل المنصات من الخادم.';
        }
      }
    }
    await loadPlatforms();
    incSel?.addEventListener('change', () => loadPlatforms());

    // Permissions host for employee mode (optional external fill)
    if (typeof opts.renderPermissions === 'function') {
      const permsHost = host.querySelector('[data-id360-perms]');
      if (permsHost) opts.renderPermissions(permsHost, values.permissions || []);
    }

    host._hubId360 = state;
    return state;
  }

  function val(host, key) {
    const el = host.querySelector(`[data-id360="${key}"]`);
    return el ? String(el.value || '').trim() : '';
  }

  function collect(host) {
    if (!host) return { ok: false, error: 'النموذج غير جاهز' };
    const state = host._hubId360 || {};
    let relation = state.relation || 'client';
    if (!state.opts?.lockRelation) {
      const c = !!host.querySelector('[data-id360-rel="client"]')?.checked;
      const e = !!host.querySelector('[data-id360-rel="employee"]')?.checked;
      relation = relationFromModes({ client: c || (!c && !e), employee: e });
    } else if (host.querySelector('[data-id360="relation"]')) {
      relation = val(host, 'relation') || relation;
    }

    const base = {
      name: val(host, 'name'),
      email: val(host, 'email').toLowerCase(),
      phone: val(host, 'phone'),
      country: val(host, 'country'),
      city: val(host, 'city'),
      address: val(host, 'address'),
      relation,
      isClient: relation === 'client' || relation === 'both',
      isEmployee: relation === 'employee' || relation === 'both',
    };

    let geo = {};
    const geoHost = host.querySelector('[data-id360-geo]');
    if (geoHost && global.HubGeoBranch?.collect) {
      try {
        geo = global.HubGeoBranch.collect(geoHost) || {};
      } catch {
        geo = {};
      }
    }

    const clientPart = base.isClient
      ? {
          incubatorId: val(host, 'incubatorId'),
          platformCode: val(host, 'platformCode'),
          clientType: val(host, 'clientType'),
          company: val(host, 'company'),
          status: val(host, 'status') || 'pending',
          branch: geo.branchName || geo.branch || '',
          branchName: geo.branchName || geo.branch || '',
          country: geo.country || base.country,
          city: geo.city || base.city,
          address: geo.address || base.address,
          lat: geo.lat,
          lng: geo.lng,
          locationSource: geo.locationSource || 'manual',
          locationConfirmed: !!geo.locationConfirmed,
        }
      : {};

    const employeePart = base.isEmployee
      ? {
          affiliationKind: val(host, 'affiliationKind') || 'naiosh',
          orgName: val(host, 'orgName'),
          department: val(host, 'department'),
          workplace: val(host, 'department'),
          role: val(host, 'role') || 'admin',
          temporaryPassword: val(host, 'temporaryPassword'),
          permissions: [...host.querySelectorAll('[data-id360-perms] input[name=perm]:checked')].map((i) => i.value),
        }
      : {};

    return { ok: true, ...base, ...clientPart, ...employeePart };
  }

  function validate(host) {
    const errEl = host?.querySelector('[data-id360-error]');
    const show = (msg) => {
      if (errEl) {
        errEl.hidden = !msg;
        errEl.textContent = msg || '';
      }
      return { ok: !msg, error: msg || null };
    };
    const data = collect(host);
    if (!data.ok) return show(data.error);
    if (!data.name) return show('الاسم مطلوب.');
    if (!data.email) return show('البريد الإلكتروني مطلوب.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return show('صيغة البريد الإلكتروني غير صحيحة.');
    if (!data.phone) return show('رقم الجوال مطلوب.');
    if (data.isClient) {
      if (!data.incubatorId) return show('اختيار الحاضنة إلزامي للعميل.');
      if (!data.platformCode) return show('اختيار المنصة إلزامي للعميل.');
      if (!data.branchName && !data.branch) return show('اكتب اسم الفرع أو حدّد الموقع من الخريطة.');
      if (global.HubGeoBranch?.validate && host.querySelector('[data-id360-geo]')) {
        const gv = global.HubGeoBranch.validate(host.querySelector('[data-id360-geo]'));
        if (gv && gv.ok === false) return show(gv.error || 'أكمل بيانات الموقع/الفرع.');
      }
    }
    if (data.isEmployee) {
      if (!data.role) return show('اختر الدور الإداري.');
      const requirePwd = host._hubId360?.opts?.requireEmployeePassword !== false;
      if (
        requirePwd &&
        host.querySelector('[data-id360="temporaryPassword"]') &&
        !data.temporaryPassword
      ) {
        return show('كلمة المرور المؤقتة مطلوبة للموظف.');
      }
    }
    return show('');
  }

  global.HubIdentityUnifiedForm = { mount, collect, validate, esc };
})(typeof window !== 'undefined' ? window : globalThis);
