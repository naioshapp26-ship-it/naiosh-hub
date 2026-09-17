/**
 * نماذج Modal لإدارة فريق العمل — بدون prompt/alert/confirm
 * يعتمد على واجهة HubTeamOpsUI عبر window.__htoFormsApi
 */
(() => {
  'use strict';

  const ACTION_TYPES = [
    ['VIEW', 'عرض'],
    ['CREATE', 'إضافة'],
    ['EDIT', 'تعديل'],
    ['DELETE', 'حذف'],
    ['PUBLISH', 'نشر'],
    ['APPROVE', 'اعتماد'],
    ['REJECT', 'رفض'],
    ['MANAGE', 'إدارة'],
    ['SUSPEND', 'إيقاف'],
    ['ACTIVATE', 'تشغيل'],
    ['EXPORT', 'تصدير'],
    ['ASSIGN', 'تعيين'],
    ['REVOKE', 'سحب'],
  ];

  const SENSITIVITY = [
    ['normal', 'عادية'],
    ['admin', 'إدارية'],
    ['sensitive', 'حساسة'],
    ['critical', 'حرجة'],
  ];

  const ORG_LEVELS = [
    ['HQ', 'المقر الرئيسي'],
    ['MAIN_OFFICE', 'المكتب الرئيسي'],
    ['INCUBATOR', 'الحاضنة'],
    ['BRANCH', 'الفرع'],
    ['PLATFORM', 'المنصة'],
    ['OFFICE', 'المكتب'],
    ['INDEPENDENT', 'المستقل'],
    ['USER', 'المستخدم'],
    ['SUPERVISOR', 'المشرف'],
    ['VISITOR', 'الزائر'],
    ['CUSTOM', 'مخصص'],
  ];

  const api = () => window.__htoFormsApi || {};

  const esc = (v = '') => api().esc?.(v) ?? String(v ?? '');

  const slugCode = (raw, max = 24) =>
    String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')
      .slice(0, max);

  const suggestPermCode = (resource, action) => {
    const r = String(resource || 'custom')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '') || 'custom';
    const a = String(action || 'view')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '') || 'view';
    return `${r}.${a}`;
  };

  const field = (opts) => {
    const {
      name,
      label,
      type = 'text',
      value = '',
      required = false,
      placeholder = '',
      options = null,
      hint = '',
      error = '',
      rows = 3,
      disabled = false,
      attrs = '',
    } = opts;
    const req = required ? ' <span class="hto-req">*</span>' : '';
    const err = error ? `<div class="hto-field-error" data-err-for="${esc(name)}">${esc(error)}</div>` : `<div class="hto-field-error" data-err-for="${esc(name)}" hidden></div>`;
    const hintHtml = hint ? `<div class="hto-field-hint">${esc(hint)}</div>` : '';
    let control = '';
    if (type === 'textarea') {
      control = `<textarea id="hto-f-${esc(name)}" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}" ${disabled ? 'disabled' : ''} ${required ? 'required' : ''} ${attrs}>${esc(value)}</textarea>`;
    } else if (type === 'select') {
      control = `<select id="hto-f-${esc(name)}" name="${esc(name)}" ${disabled ? 'disabled' : ''} ${required ? 'required' : ''} ${attrs}>
        ${(options || []).map((o) => {
          const [val, lab] = Array.isArray(o) ? o : [o.value, o.label];
          return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('')}
      </select>`;
    } else if (type === 'radio') {
      control = `<div class="hto-radio-row" role="radiogroup" aria-label="${esc(label)}">
        ${(options || [])
          .map((o) => {
            const [val, lab] = Array.isArray(o) ? o : [o.value, o.label];
            return `<label class="hto-radio"><input type="radio" name="${esc(name)}" value="${esc(val)}" ${String(val) === String(value) ? 'checked' : ''}/> ${esc(lab)}</label>`;
          })
          .join('')}
      </div>`;
    } else if (type === 'checks') {
      control = opts.html || '';
    } else {
      control = `<input type="${esc(type)}" id="hto-f-${esc(name)}" name="${esc(name)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${disabled ? 'disabled' : ''} ${required ? 'required' : ''} ${attrs} />`;
    }
    return `<div class="hto-form-field ${error ? 'has-error' : ''}" data-field="${esc(name)}">
      <label class="hto-field-label" for="hto-f-${esc(name)}">${esc(label)}${req}</label>
      ${control}${hintHtml}${err}
    </div>`;
  };

  const readVal = (name, type = 'text') => {
    if (type === 'radio') {
      return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    }
    if (type === 'checks') {
      return [...document.querySelectorAll(`[data-hto-form-check="${name}"]:checked`)].map((el) => el.value);
    }
    if (type === 'multi') {
      return [...document.querySelectorAll(`[data-hto-form-multi="${name}"]:checked`)].map((el) => el.value);
    }
    return document.getElementById(`hto-f-${name}`)?.value?.trim?.() ?? document.getElementById(`hto-f-${name}`)?.value ?? '';
  };

  const setFieldError = (name, msg) => {
    const box = document.querySelector(`[data-err-for="${name}"]`);
    const wrap = document.querySelector(`[data-field="${name}"]`);
    if (box) {
      box.hidden = !msg;
      box.textContent = msg || '';
    }
    wrap?.classList.toggle('has-error', !!msg);
  };

  const clearErrors = () => {
    document.querySelectorAll('.hto-form-field .hto-field-error').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
    document.querySelectorAll('.hto-form-field.has-error').forEach((el) => el.classList.remove('has-error'));
  };

  const showFormError = (msg) => {
    const el = document.getElementById('hto-form-banner');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
  };

  const sectionsForSystem = (systemCode) => {
    const { store } = api();
    const st = store?.() || {};
    const set = new Map();
    (st.permissions || []).forEach((p) => {
      if (systemCode && p.systemHint && p.systemHint !== systemCode) return;
      const r = p.resource || 'general';
      if (!set.has(r)) set.set(r, p.nameAr?.split(/\s/)[0] || r);
    });
    const known = [
      ['blog', 'المدونة'],
      ['articles', 'المقالات'],
      ['products', 'المنتجات'],
      ['sales', 'المبيعات'],
      ['ads', 'الإعلانات'],
      ['events', 'الفعاليات'],
      ['customers', 'العملاء'],
      ['users', 'المستخدمون'],
      ['roles', 'الأدوار'],
      ['access_governance', 'حوكمة الوصول'],
      ['finance', 'المالية'],
      ['custom', 'مخصص'],
    ];
    known.forEach(([k, ar]) => {
      if (!set.has(k)) set.set(k, ar);
    });
    return [...set.entries()].map(([code, name]) => [code, `${name} (${code})`]);
  };

  const renderRolePermPicker = (selected = [], q = '') => {
    const { store, permLabel, systems } = api();
    const st = store?.() || {};
    const needle = String(q || '').trim().toLowerCase();
    const perms = (st.permissions || []).filter((p) => p.status !== 'inactive');
    const bySys = new Map();
    perms.forEach((p) => {
      if (needle && ![p.code, p.nameAr, p.resource, p.action].some((x) => String(x || '').toLowerCase().includes(needle))) return;
      const sys = p.systemHint || 'عام';
      if (!bySys.has(sys)) bySys.set(sys, []);
      bySys.get(sys).push(p);
    });
    const sel = new Set(selected);
    const sysList = systems?.() || [];
    const labelSys = (c) => sysList.find((s) => s.code === c)?.nameAr || c;
    let html = `<div class="hto-form-field" data-field="permissions">
      <label class="hto-field-label">الصلاحيات التابعة للدور <span class="hto-req">*</span></label>
      <div class="hto-perm-toolbar">
        <input type="search" id="hto-f-permQ" placeholder="بحث في الصلاحيات…" value="${esc(q)}" />
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-form-perm-all">تحديد الكل</button>
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-form-perm-none">إلغاء تحديد الكل</button>
      </div>
      <div class="hto-perm-picker" id="hto-role-perm-picker">`;
    [...bySys.entries()].forEach(([sys, items]) => {
      const byRes = new Map();
      items.forEach((p) => {
        const r = p.resource || 'general';
        if (!byRes.has(r)) byRes.set(r, []);
        byRes.get(r).push(p);
      });
      html += `<div class="hto-check-group"><h5>${esc(sys === 'عام' ? 'عام' : labelSys(sys))}</h5>`;
      [...byRes.entries()].forEach(([res, list]) => {
        html += `<div class="hto-perm-section"><strong class="hto-perm-sec-title">${esc(res)}</strong>`;
        list.forEach((p) => {
          const on = sel.has(p.code);
          html += `<label class="hto-check"><input type="checkbox" data-hto-form-check="permissions" value="${esc(p.code)}" ${on ? 'checked' : ''}/> <span>${esc(permLabel?.(p.code) || p.nameAr || p.code)}</span></label>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    });
    html += `</div><div class="hto-field-error" data-err-for="permissions" hidden></div></div>`;
    return html;
  };

  const renderSystemForm = (f) => {
    const { systems } = api();
    const d = f.data || {};
    const parents = (systems?.() || []).filter((s) => s.code !== d.code && s.classification !== 'sub');
    const cls = d.classification || 'independent';
    return `
      ${field({ name: 'nameAr', label: 'اسم النظام', value: d.nameAr || '', required: true, placeholder: 'مثال: نظام الفعاليات' })}
      ${field({
        name: 'code',
        label: 'رمز النظام',
        value: d.code || '',
        required: true,
        disabled: !!f.edit,
        placeholder: 'EVENTS',
        hint: f.edit ? 'لا يمكن تغيير الرمز بعد الإنشاء' : 'يُولَّد تلقائيًا من الاسم ويمكن تعديله',
      })}
      ${field({
        name: 'classification',
        label: 'نوع النظام',
        type: 'select',
        value: cls,
        required: true,
        options: [
          ['independent', 'نظام مستقل'],
          ['umbrella', 'نظام رئيسي'],
          ['sub', 'نظام فرعي'],
        ],
        attrs: 'data-hto-form-watch="classification"',
      })}
      <div class="hto-form-field" data-field="parentCode" ${cls === 'sub' ? '' : 'hidden'}>
        <label class="hto-field-label" for="hto-f-parentCode">النظام الأب</label>
        <select id="hto-f-parentCode" name="parentCode">
          <option value="">— اختر —</option>
          ${parents.map((s) => `<option value="${esc(s.code)}" ${d.parentCode === s.code ? 'selected' : ''}>${esc(s.nameAr)} (${esc(s.code)})</option>`).join('')}
        </select>
        <div class="hto-field-error" data-err-for="parentCode" hidden></div>
      </div>
      ${field({ name: 'station', label: 'التصنيف / المحطة التشغيلية', value: d.station || '', placeholder: 'مثال: تشغيل · محتوى · مبيعات' })}
      ${field({ name: 'description', label: 'وصف النظام', type: 'textarea', value: d.description || '', required: true })}
      ${field({ name: 'url', label: 'رابط النظام / الصفحة', value: d.url || '', placeholder: '/events.html' })}
      ${field({ name: 'icon', label: 'الأيقونة', value: d.icon || 'fa-cube', placeholder: 'fa-cube' })}
      ${field({ name: 'sortOrder', label: 'ترتيب الظهور', type: 'number', value: d.sortOrder ?? '', placeholder: '10' })}
      ${field({
        name: 'status',
        label: 'حالة النظام',
        type: 'select',
        value: d.status || 'active',
        required: true,
        options: [
          ['active', 'نشط'],
          ['inactive', 'غير نشط'],
        ],
      })}
      ${field({ name: 'notes', label: 'ملاحظات', type: 'textarea', value: d.notes || '', rows: 2 })}
    `;
  };

  const renderRoleForm = (f) => {
    const { systems, allPositions } = api();
    const d = f.data || {};
    const selectedSys = d.applicableSystems || d.systems || [];
    const sysChecks = (systems?.() || [])
      .map(
        (s) =>
          `<label class="hto-check"><input type="checkbox" data-hto-form-multi="systems" value="${esc(s.code)}" ${selectedSys.includes(s.code) ? 'checked' : ''}/> <span>${esc(s.nameAr)}</span></label>`
      )
      .join('');
    return `
      ${field({ name: 'nameAr', label: 'اسم الدور', value: d.nameAr || '', required: true })}
      ${field({
        name: 'code',
        label: 'رمز الدور',
        value: d.code || '',
        required: true,
        disabled: !!f.edit,
        placeholder: 'CONTENT_EDITOR',
      })}
      ${field({
        name: 'level',
        label: 'مستوى / مكان العمل',
        type: 'select',
        value: d.level || 'SYSTEM',
        required: true,
        options: [
          ['EMPIRE', 'إمبراطوري'],
          ['HUB', 'هوب'],
          ['SYSTEM', 'نظام'],
          ['BRANCH', 'فرع'],
          ...(allPositions?.() || []).map((p) => [p.code, p.nameAr]),
        ],
      })}
      <div class="hto-form-field" data-field="systems">
        <label class="hto-field-label">النظام أو الأنظمة المرتبطة بالدور <span class="hto-req">*</span></label>
        <div class="hto-check-grid">${sysChecks || '<p class="hto-muted">لا أنظمة مسجلة</p>'}</div>
        <div class="hto-field-error" data-err-for="systems" hidden></div>
      </div>
      ${field({ name: 'description', label: 'وصف الدور', type: 'textarea', value: d.description || '', required: true })}
      ${renderRolePermPicker(d.permissions || [], f.permQ || '')}
      ${field({
        name: 'status',
        label: 'حالة الدور',
        type: 'select',
        value: d.status || 'active',
        options: [
          ['active', 'نشط'],
          ['inactive', 'غير نشط'],
        ],
      })}
      ${field({ name: 'notes', label: 'ملاحظات', type: 'textarea', value: d.notes || '', rows: 2 })}
    `;
  };

  const renderPermissionForm = (f) => {
    const { systems, store } = api();
    const d = f.data || {};
    const sys = d.system || d.systemHint || '';
    const sections = sectionsForSystem(sys);
    const actionOpts = ACTION_TYPES.slice();
    const existingActions = [...new Set((store?.()?.permissions || []).map((p) => p.action).filter(Boolean))];
    existingActions.forEach((a) => {
      if (!actionOpts.some(([k]) => k === a)) actionOpts.push([a, a]);
    });
    return `
      ${field({ name: 'nameAr', label: 'اسم الصلاحية', value: d.nameAr || '', required: true, placeholder: 'مثال: نشر مقال' })}
      ${field({
        name: 'code',
        label: 'رمز الصلاحية',
        value: d.code || '',
        required: true,
        disabled: !!f.edit,
        placeholder: 'blog.publish',
        hint: 'يجب أن يكون فريدًا',
      })}
      ${field({
        name: 'system',
        label: 'النظام',
        type: 'select',
        value: sys,
        required: true,
        options: [['', '— اختر النظام —'], ...(systems?.() || []).map((s) => [s.code, s.nameAr])],
        attrs: 'data-hto-form-watch="system"',
      })}
      ${field({
        name: 'resource',
        label: 'القسم / الوحدة',
        type: 'select',
        value: d.resource || '',
        required: true,
        options: [['', '— اختر —'], ...sections],
        attrs: 'data-hto-form-watch="resource"',
      })}
      ${field({
        name: 'action',
        label: 'نوع العملية',
        type: 'select',
        value: d.action || 'VIEW',
        required: true,
        options: actionOpts,
        attrs: 'data-hto-form-watch="action"',
      })}
      ${field({ name: 'description', label: 'وصف الصلاحية', type: 'textarea', value: d.description || '', required: true, placeholder: 'تسمح للموظف باعتماد ونشر المقالات بعد المراجعة.' })}
      ${field({
        name: 'sensitivity',
        label: 'مستوى حساسية الصلاحية',
        type: 'select',
        value: d.sensitivity || 'normal',
        options: SENSITIVITY,
      })}
      ${field({
        name: 'directGrant',
        label: 'هل يمكن منحها مباشرة لموظف؟',
        type: 'radio',
        value: d.directGrant === false || d.directGrant === 'no' ? 'no' : 'yes',
        options: [
          ['yes', 'نعم'],
          ['no', 'لا'],
        ],
      })}
      ${field({
        name: 'status',
        label: 'حالة الصلاحية',
        type: 'select',
        value: d.status || 'active',
        required: true,
        options: [
          ['active', 'نشطة'],
          ['inactive', 'غير نشطة'],
        ],
      })}
      ${field({ name: 'notes', label: 'ملاحظات', type: 'textarea', value: d.notes || '', rows: 2 })}
    `;
  };

  const renderWorkplaceForm = (f) => {
    const { allPositions } = api();
    const d = f.data || {};
    const parents = (allPositions?.() || []).filter((p) => p.code !== d.code);
    return `
      ${field({ name: 'nameAr', label: 'اسم مكان العمل', value: d.nameAr || '', required: true, placeholder: 'فرع دبي' })}
      ${field({ name: 'code', label: 'الرمز', value: d.code || '', required: true, disabled: !!f.edit, placeholder: 'BRANCH_DXB' })}
      ${field({
        name: 'orgLevel',
        label: 'النوع / المستوى',
        type: 'select',
        value: d.orgLevel || 'BRANCH',
        required: true,
        options: ORG_LEVELS,
      })}
      ${field({
        name: 'parentEntity',
        label: 'الكيان الأب إن وجد',
        type: 'select',
        value: d.parentEntity || '',
        options: [['', '— لا يوجد —'], ...parents.map((p) => [p.code, p.nameAr])],
      })}
      ${field({ name: 'description', label: 'الوصف', type: 'textarea', value: d.description || '', rows: 2 })}
      ${field({
        name: 'status',
        label: 'الحالة',
        type: 'select',
        value: d.status || 'active',
        options: [
          ['active', 'نشط'],
          ['inactive', 'غير نشط'],
        ],
      })}
      ${field({ name: 'sortOrder', label: 'ترتيب الظهور', type: 'number', value: d.sortOrder ?? '' })}
    `;
  };

  const renderEmployeeForm = (f) => {
    const d = f.data || {};
    return `
      ${field({ name: 'name', label: 'الاسم الكامل', value: d.name || '', required: true })}
      ${field({
        name: 'employeeNo',
        label: 'رقم الموظف',
        value: d.employeeNo || '',
        required: true,
        disabled: !!f.edit,
        placeholder: 'EMP-0005',
        hint: f.edit ? 'رقم الموظف لا يُغيَّر بعد الإنشاء' : 'إلزامي وفريد — يمكن توليده تلقائيًا',
      })}
      ${f.edit ? '' : `<div class="hto-actions" style="margin-top:-6px">
        <button type="button" class="hto-btn hto-btn-sm" data-action="hto-form-gen-empno">توليد رقم موظف</button>
      </div>`}
      ${field({ name: 'naioshId', label: 'رقم نايوش إن وجد', value: d.naioshId || '', placeholder: 'NAI-…' })}
      ${field({ name: 'email', label: 'البريد الإلكتروني', type: 'email', value: d.email || '', required: true })}
      ${field({ name: 'phone', label: 'رقم الهاتف', value: d.phone || '', placeholder: '+971…' })}
      ${field({ name: 'photo', label: 'صورة الموظف (رابط اختياري)', value: d.photo || '', placeholder: 'https://…' })}
      ${field({ name: 'notes', label: 'ملاحظات', type: 'textarea', value: d.notes || '', rows: 2 })}
    `;
  };

  const titles = {
    system: { create: 'إضافة نظام جديد', edit: 'تعديل النظام' },
    role: { create: 'إضافة دور جديد', edit: 'تعديل الدور' },
    permission: { create: 'إضافة صلاحية جديدة', edit: 'تعديل الصلاحية' },
    workplace: { create: 'إضافة مكان عمل', edit: 'تعديل مكان العمل' },
    employee: { create: 'إضافة موظف', edit: 'تعديل بيانات الموظف' },
  };

  const saveLabels = {
    system: 'حفظ النظام',
    role: 'حفظ الدور',
    permission: 'حفظ الصلاحية',
    workplace: 'حفظ مكان العمل',
    employee: 'حفظ ومتابعة التعيين',
  };

  const renderFormModal = (ui) => {
    const f = ui?.form;
    if (!f) return '';
    const kind = f.kind;
    const title = titles[kind]?.[f.edit ? 'edit' : 'create'] || 'نموذج';
    const wide = kind === 'role' || kind === 'permission' ? 'hto-modal-wide' : '';
    let body = '';
    if (kind === 'system') body = renderSystemForm(f);
    else if (kind === 'role') body = renderRoleForm(f);
    else if (kind === 'permission') body = renderPermissionForm(f);
    else if (kind === 'workplace') body = renderWorkplaceForm(f);
    else if (kind === 'employee') body = renderEmployeeForm(f);
    else body = '<p>نوع نموذج غير معروف</p>';

    return `<div class="hto-modal hto-form-modal" role="dialog" aria-modal="true" aria-labelledby="hto-form-title">
      <div class="hto-modal-card ${wide}">
        <header>
          <h3 id="hto-form-title">${esc(title)}</h3>
          <button type="button" class="hto-modal-x" data-action="hto-form-close" aria-label="إغلاق">×</button>
        </header>
        <div class="hto-wizard-body hto-form-body">
          <div id="hto-form-banner" class="hto-form-banner" ${f.error ? '' : 'hidden'}>${esc(f.error || '')}</div>
          <form id="hto-entity-form" onsubmit="return false;">${body}</form>
        </div>
        <footer>
          <button type="button" class="hto-btn" data-action="hto-form-close">إلغاء</button>
          <button type="button" class="hto-btn hto-btn-primary" data-action="hto-form-save">${esc(saveLabels[kind] || 'حفظ')}</button>
        </footer>
      </div>
    </div>`;
  };

  const nextEmployeeNo = () => {
    const { store } = api();
    const used = new Set(
      (store?.()?.identities || [])
        .map((i) => String(i.employeeNo || '').toUpperCase())
        .filter(Boolean)
    );
    let n = 1;
    while (used.has(`EMP-${String(n).padStart(4, '0')}`) && n < 9999) n += 1;
    return `EMP-${String(n).padStart(4, '0')}`;
  };

  const collectAndValidate = (f) => {
    clearErrors();
    showFormError('');
    const { store, systems } = api();
    const st = store?.() || {};
    const errors = {};
    let payload = {};

    if (f.kind === 'system') {
      const nameAr = readVal('nameAr');
      let code = f.edit ? f.data.code : slugCode(readVal('code') || nameAr);
      const classification = readVal('classification') || 'independent';
      const parentCode = classification === 'sub' ? readVal('parentCode') : null;
      const description = readVal('description');
      if (!nameAr) errors.nameAr = 'اسم النظام مطلوب';
      if (!code) errors.code = 'رمز النظام مطلوب';
      if (!description) errors.description = 'وصف النظام مطلوب';
      if (classification === 'sub' && !parentCode) errors.parentCode = 'اختر النظام الأب';
      if (!f.edit && (systems?.() || []).some((s) => s.code === code)) errors.code = 'يوجد بالفعل نظام بهذا الرمز';
      payload = {
        nameAr,
        code,
        classification,
        parentCode,
        station: readVal('station'),
        description,
        url: readVal('url'),
        icon: readVal('icon') || 'fa-cube',
        sortOrder: Number(readVal('sortOrder')) || 0,
        status: readVal('status') || 'active',
        notes: readVal('notes'),
      };
    } else if (f.kind === 'role') {
      const nameAr = readVal('nameAr');
      let code = f.edit ? f.data.code : slugCode(readVal('code') || nameAr, 40);
      const description = readVal('description');
      const systemsSel = readVal('systems', 'multi');
      const permissions = readVal('permissions', 'checks');
      if (!nameAr) errors.nameAr = 'اسم الدور مطلوب';
      if (!code) errors.code = 'رمز الدور مطلوب';
      if (!description) errors.description = 'وصف الدور مطلوب';
      if (!systemsSel.length) errors.systems = 'اختر نظامًا واحدًا على الأقل';
      if (!permissions.length) errors.permissions = 'اختر صلاحية واحدة على الأقل';
      if (!f.edit && (st.roles || []).some((r) => r.code === code)) errors.code = 'يوجد بالفعل دور بهذا الرمز';
      payload = {
        nameAr,
        code,
        level: readVal('level') || 'SYSTEM',
        applicableSystems: systemsSel,
        description,
        permissions,
        status: readVal('status') || 'active',
        notes: readVal('notes'),
      };
    } else if (f.kind === 'permission') {
      const nameAr = readVal('nameAr');
      const resource = readVal('resource');
      const action = readVal('action') || 'VIEW';
      const system = readVal('system');
      const description = readVal('description');
      let code = f.edit ? f.data.code : String(readVal('code') || suggestPermCode(resource, action)).trim().toLowerCase();
      if (!nameAr) errors.nameAr = 'اسم الصلاحية مطلوب';
      if (!code) errors.code = 'رمز الصلاحية مطلوب';
      if (!system) errors.system = 'النظام مطلوب';
      if (!resource) errors.resource = 'القسم / الوحدة مطلوب';
      if (!description) errors.description = 'وصف الصلاحية مطلوب';
      if (!f.edit && (st.permissions || []).some((p) => p.code === code)) errors.code = 'يوجد بالفعل صلاحية بهذا الرمز';
      payload = {
        nameAr,
        code,
        resource,
        action,
        system,
        description,
        sensitivity: readVal('sensitivity') || 'normal',
        directGrant: readVal('directGrant', 'radio') !== 'no',
        status: readVal('status') || 'active',
        notes: readVal('notes'),
      };
    } else if (f.kind === 'workplace') {
      const nameAr = readVal('nameAr');
      let code = f.edit ? f.data.code : slugCode(readVal('code') || nameAr, 40);
      if (!nameAr) errors.nameAr = 'اسم مكان العمل مطلوب';
      if (!code) errors.code = 'الرمز مطلوب';
      if (!f.edit && (st.positions || []).some((p) => p.code === code)) errors.code = 'يوجد بالفعل مكان عمل بهذا الرمز';
      payload = {
        nameAr,
        code,
        orgLevel: readVal('orgLevel') || 'CUSTOM',
        parentEntity: readVal('parentEntity') || null,
        description: readVal('description'),
        status: readVal('status') || 'active',
        sortOrder: Number(readVal('sortOrder')) || 0,
      };
    } else if (f.kind === 'employee') {
      const name = readVal('name');
      const email = readVal('email');
      let employeeNo = String(readVal('employeeNo') || '').trim().toUpperCase();
      if (!name) errors.name = 'الاسم الكامل مطلوب';
      if (!email) errors.email = 'البريد الإلكتروني مطلوب';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'صيغة البريد غير صحيحة';
      if (!employeeNo) {
        employeeNo = nextEmployeeNo();
      }
      const dup = (st.identities || []).find(
        (i) => String(i.employeeNo || '').toUpperCase() === employeeNo && (!f.edit || i.naioshId !== f.data?.naioshId)
      );
      if (dup) errors.employeeNo = 'رقم الموظف مستخدم بالفعل.';
      if (f.edit) {
        /* ok */
      } else {
        const byEmail = (st.identities || []).find((i) => String(i.email || '').toLowerCase() === email.toLowerCase());
        if (byEmail && byEmail.isEmployee && byEmail.employeeNo) {
          errors.email = 'يوجد موظف بهذا البريد بالفعل';
        }
      }
      payload = {
        name,
        email,
        employeeNo,
        naioshId: readVal('naioshId') || f.data?.naioshId || undefined,
        phone: readVal('phone'),
        photo: readVal('photo'),
        notes: readVal('notes'),
      };
    }

    Object.entries(errors).forEach(([k, v]) => setFieldError(k, v));
    if (Object.keys(errors).length) {
      const first = Object.values(errors)[0];
      showFormError(first);
      return { ok: false, errors, payload };
    }
    return { ok: true, payload };
  };

  const syncFormDataFromDom = (f) => {
    if (!f?.data) return;
    if (f.kind === 'system') {
      f.data.nameAr = readVal('nameAr') || f.data.nameAr;
      if (!f.edit) f.data.code = slugCode(readVal('code') || f.data.nameAr) || f.data.code;
      f.data.classification = readVal('classification') || f.data.classification;
      f.data.parentCode = readVal('parentCode');
      f.data.description = readVal('description');
      f.data.url = readVal('url');
      f.data.icon = readVal('icon');
      f.data.status = readVal('status');
      f.data.notes = readVal('notes');
      f.data.station = readVal('station');
      f.data.sortOrder = readVal('sortOrder');
    } else if (f.kind === 'permission') {
      f.data.nameAr = readVal('nameAr');
      f.data.system = readVal('system');
      f.data.resource = readVal('resource');
      f.data.action = readVal('action');
      if (!f.edit) {
        const auto = suggestPermCode(f.data.resource, f.data.action);
        const cur = readVal('code');
        if (!cur || cur === f.data._lastAuto) {
          f.data.code = auto;
          f.data._lastAuto = auto;
        } else f.data.code = cur;
      }
      f.data.description = readVal('description');
      f.data.sensitivity = readVal('sensitivity');
      f.data.directGrant = readVal('directGrant', 'radio');
      f.data.status = readVal('status');
      f.data.notes = readVal('notes');
    } else if (f.kind === 'role') {
      f.data.nameAr = readVal('nameAr');
      if (!f.edit) f.data.code = slugCode(readVal('code') || f.data.nameAr, 40);
      f.data.level = readVal('level');
      f.data.applicableSystems = readVal('systems', 'multi');
      f.data.description = readVal('description');
      f.data.permissions = readVal('permissions', 'checks');
      f.data.status = readVal('status');
      f.data.notes = readVal('notes');
      f.permQ = document.getElementById('hto-f-permQ')?.value || '';
    } else if (f.kind === 'employee') {
      f.data.name = readVal('name');
      f.data.email = readVal('email');
      f.data.employeeNo = readVal('employeeNo');
      f.data.naioshId = readVal('naioshId');
      f.data.phone = readVal('phone');
      f.data.photo = readVal('photo');
      f.data.notes = readVal('notes');
    } else if (f.kind === 'workplace') {
      f.data.nameAr = readVal('nameAr');
      if (!f.edit) f.data.code = slugCode(readVal('code') || f.data.nameAr, 40);
      f.data.orgLevel = readVal('orgLevel');
      f.data.parentEntity = readVal('parentEntity');
      f.data.description = readVal('description');
      f.data.status = readVal('status');
      f.data.sortOrder = readVal('sortOrder');
    }
  };

  const openForm = (ui, kind, data = null) => {
    const edit = !!(data && (data.code || data.naioshId));
    ui.form = {
      kind,
      edit,
      data: data ? { ...data } : {},
      error: '',
      permQ: '',
    };
    if (kind === 'system' && !edit) {
      ui.form.data = { classification: 'independent', status: 'active', icon: 'fa-cube' };
    }
    if (kind === 'role' && !edit) {
      ui.form.data = { status: 'active', level: 'SYSTEM', applicableSystems: [], permissions: [] };
    }
    if (kind === 'permission' && !edit) {
      ui.form.data = { status: 'active', action: 'VIEW', sensitivity: 'normal', directGrant: 'yes' };
    }
    if (kind === 'workplace' && !edit) {
      ui.form.data = { status: 'active', orgLevel: 'BRANCH' };
    }
    if (kind === 'employee' && !edit) {
      ui.form.data = { employeeNo: nextEmployeeNo() };
    }
    return true;
  };

  const submitForm = (ui, ctx = {}) => {
    const apiObj = api();
    const toast = typeof ctx.toast === 'function' ? ctx.toast : apiObj.toast;
    const user = ctx.user || apiObj.user?.();
    const eng = apiObj.engine;
    const actor = apiObj.actorOf?.(user) || user?.name || 'مشغّل هوب';
    const f = ui.form;
    if (!f) return true;
    const { ok, payload } = collectAndValidate(f);
    if (!ok) return true;
    try {
      if (f.kind === 'system') {
        eng().upsertManagedSystem(payload, actor);
        ui.tab = 'systems';
        toast?.('تم حفظ النظام');
      } else if (f.kind === 'role') {
        eng().upsertRole(payload, actor);
        ui.tab = 'roles';
        toast?.('تم حفظ الدور');
      } else if (f.kind === 'permission') {
        eng().upsertPermission(payload, actor);
        ui.tab = 'permissions';
        toast?.('تم حفظ الصلاحية');
      } else if (f.kind === 'workplace') {
        eng().upsertPosition(payload, actor);
        ui.tab = 'systems';
        toast?.('تم حفظ مكان العمل');
      } else if (f.kind === 'employee') {
        if (f.edit && (payload.naioshId || f.data?.naioshId)) {
          const nid = payload.naioshId || f.data.naioshId;
          eng().updateIdentity?.(
            nid,
            {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              photo: payload.photo,
            },
            actor
          );
          toast?.('تم تحديث بيانات الموظف');
          ui.selectedUser = nid;
        } else {
          const created = eng().registerEmployee(
            {
              name: payload.name,
              email: payload.email,
              employeeNo: payload.employeeNo,
              naioshId: payload.naioshId,
              phone: payload.phone,
              photo: payload.photo,
              asEmployee: true,
            },
            actor
          );
          if (!created?.employeeNo) throw new Error('لا يمكن حفظ موظف بدون رقم موظف');
          ui.wizard = {
            step: 2,
            naioshId: created.naioshId,
            userQ: created.employeeNo,
            empQ: created.employeeNo,
            system: '',
            positionCode: '',
            roleCode: '',
            permissions: [],
            createFlow: true,
          };
          ui.tab = 'team';
          ui.selectedUser = created.naioshId;
          toast?.(`تم تسجيل الموظف ${created.employeeNo}`);
        }
      }
      ui.form = null;
    } catch (e) {
      const msg = e.message || 'تعذر الحفظ';
      f.error = msg;
      showFormError(msg);
      if (/موظف/.test(msg)) setFieldError('employeeNo', msg);
      else if (/صلاحية|رمز/.test(msg)) setFieldError('code', msg);
      toast?.(msg);
    }
    return true;
  };

  const handleFormAction = (action, btn, ui, ctx) => {
    if (action === 'hto-form-close') {
      ui.form = null;
      return true;
    }
    if (action === 'hto-form-save') return submitForm(ui, ctx);
    if (action === 'hto-form-gen-empno') {
      if (ui.form?.kind === 'employee') {
        ui.form.data = ui.form.data || {};
        syncFormDataFromDom(ui.form);
        ui.form.data.employeeNo = nextEmployeeNo();
      }
      return true;
    }
    if (action === 'hto-form-perm-all') {
      document.querySelectorAll('[data-hto-form-check="permissions"]').forEach((el) => {
        el.checked = true;
      });
      return true;
    }
    if (action === 'hto-form-perm-none') {
      document.querySelectorAll('[data-hto-form-check="permissions"]').forEach((el) => {
        el.checked = false;
      });
      return true;
    }
    if (action === 'hto-form-refresh') {
      if (ui.form) syncFormDataFromDom(ui.form);
      return true;
    }
    return false;
  };

  const afterPaintForm = (ui) => {
    if (!ui?.form) return;
    const root = document.querySelector('.hto-form-modal');
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    root.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches('[data-hto-form-watch]')) {
        syncFormDataFromDom(ui.form);
        window.__htoRerender?.();
      }
    });

    root.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.id === 'hto-f-nameAr' && ui.form.kind === 'system' && !ui.form.edit) {
        const codeEl = document.getElementById('hto-f-code');
        if (codeEl && (!codeEl.dataset.touched || codeEl.dataset.touched === '0')) {
          codeEl.value = slugCode(t.value);
        }
      }
      if (t.id === 'hto-f-code') t.dataset.touched = '1';
      if (t.id === 'hto-f-nameAr' && ui.form.kind === 'role' && !ui.form.edit) {
        const codeEl = document.getElementById('hto-f-code');
        if (codeEl && (!codeEl.dataset.touched || codeEl.dataset.touched === '0')) {
          codeEl.value = slugCode(t.value, 40);
        }
      }
      if (t.id === 'hto-f-permQ') {
        clearTimeout(window.__htoPermQTimer);
        window.__htoPermQTimer = setTimeout(() => {
          syncFormDataFromDom(ui.form);
          window.__htoRerender?.();
        }, 200);
      }
    });
  };

  window.HubTeamOpsForms = {
    ACTION_TYPES,
    SENSITIVITY,
    ORG_LEVELS,
    renderFormModal,
    openForm,
    handleFormAction,
    afterPaintForm,
    nextEmployeeNo,
    slugCode,
    suggestPermCode,
  };
})();
