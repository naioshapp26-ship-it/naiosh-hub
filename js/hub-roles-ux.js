/**
 * Hub Roles UX — human-readable role & permission management over /api/admin
 */
(() => {
  'use strict';

  const API = '/api/admin';
  const state = {
    roles: [],
    systems: [],
    levels: [],
    templates: [],
    help: {},
    filters: { q: '', status: 'all', kind: 'all', sensitive: 'all' },
    selectedRoleCode: '',
    draftPerms: [],
    baselinePerms: [],
    advanced: false,
    drawerRole: null,
    drawerUsers: [],
    drawerTab: 'overview',
    wizardStep: 1,
    wizard: {
      template: 'CUSTOM',
      template_level: 'NONE',
      title_ar: '',
      description: '',
      hierarchy_level: 3,
      systems: {},
    },
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headers = (extra = {}) => {
    if (typeof window.getAdminHeaders === 'function') return window.getAdminHeaders(extra);
    return { Accept: 'application/json', ...extra };
  };

  const toast = (msg, type = 'success') => {
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
    alert(msg);
  };

  const levelMeta = (code) => state.levels.find((l) => l.code === code) || { code, name_ar: code, summary_ar: '', risk: 'low' };

  const isDirty = () => JSON.stringify(state.draftPerms) !== JSON.stringify(state.baselinePerms);

  const diffSummary = () => {
    const base = new Map(state.baselinePerms.map((p) => [p.system_code, p.permission_level]));
    let up = 0;
    let down = 0;
    let changed = 0;
    state.draftPerms.forEach((p) => {
      const prev = base.get(p.system_code) || 'NONE';
      if (prev === p.permission_level) return;
      changed += 1;
      const a = levelMeta(prev).priority || 0;
      const b = levelMeta(p.permission_level).priority || 0;
      if (b > a) up += 1;
      else down += 1;
    });
    return { changed, up, down };
  };

  const ensureHosts = () => {
    if (!document.getElementById('rux-root-roles')) {
      const rolesTab = document.getElementById('rolesTab');
      if (rolesTab) {
        const wrap = document.createElement('div');
        wrap.id = 'rux-root-roles';
        rolesTab.insertBefore(wrap, rolesTab.firstChild);
        const legacy = rolesTab.querySelector('.bg-white.rounded-xl');
        if (legacy) legacy.classList.add('rux-legacy-table-wrap');
      }
    }
    if (!document.getElementById('rux-root-perms')) {
      const permTab = document.getElementById('permissionsTab');
      if (permTab) {
        const wrap = document.createElement('div');
        wrap.id = 'rux-root-perms';
        permTab.insertBefore(wrap, permTab.firstChild);
        const legacy = permTab.querySelector('.bg-white.rounded-xl');
        if (legacy) legacy.classList.add('rux-legacy-table-wrap');
      }
    }
    if (!document.getElementById('rux-overlay')) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `
        <div class="rux-overlay" id="rux-overlay" role="dialog" aria-modal="true" aria-labelledby="rux-drawer-title">
          <aside class="rux-drawer" id="rux-drawer"></aside>
        </div>
        <div class="rux-wizard" id="rux-wizard" role="dialog" aria-modal="true" aria-labelledby="rux-wizard-title"></div>
        <div class="rux-confirm" id="rux-confirm" role="alertdialog" aria-modal="true"></div>`
      );
    }

    // Make summary cards filterable
    document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > *').forEach((el, idx) => {
      el.classList.add('rux-stat');
      if (!el.dataset.ruxStatBound) {
        el.dataset.ruxStatBound = '1';
        el.addEventListener('click', () => {
          if (idx === 0) {
            state.filters.kind = 'all';
            state.filters.status = 'all';
            switchTo('roles');
            paintRoles();
          } else if (idx === 1) {
            switchTo('permissions');
          } else if (idx === 2) {
            state.filters.sensitive = state.filters.sensitive === 'yes' ? 'all' : 'yes';
            switchTo('roles');
            paintRoles();
          } else if (idx === 3) {
            switchTo('users');
          }
        });
      }
    });
  };

  const switchTo = (tab) => {
    const btn = document.getElementById(`${tab}TabButton`);
    if (typeof window.switchTab === 'function' && btn) window.switchTab(tab, btn);
  };

  const filteredRoles = () => {
    const q = state.filters.q.trim().toLowerCase();
    return state.roles.filter((role) => {
      if (state.filters.status === 'active' && !role.is_active) return false;
      if (state.filters.status === 'inactive' && role.is_active) return false;
      if (state.filters.kind === 'system' && !role.is_system) return false;
      if (state.filters.kind === 'custom' && role.is_system) return false;
      if (state.filters.sensitive === 'yes' && !role.is_sensitive) return false;
      if (!q) return true;
      return [role.title_ar, role.title_en, role.code, role.plain_description, role.audience]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  };

  const paintRoles = () => {
    const host = document.getElementById('rux-root-roles');
    if (!host) return;
    const list = filteredRoles();
    host.innerHTML = `
      <section class="rux-intro">
        <h2>من هنا تقرّر ماذا يرى كل نوع موظف ويفعله</h2>
        <p>اختر دورًا، افهم لمن هو، ثم فعّل أو أوقف صلاحيات الأنظمة بلغة واضحة. التفاصيل التقنية متاحة في الوضع المتقدم فقط.</p>
        <div class="rux-intro-actions">
          <span class="rux-chip"><i class="fas fa-user-shield"></i> ${state.roles.length} دور</span>
          <span class="rux-chip"><i class="fas fa-server"></i> ${state.systems.length} نظام</span>
          <span class="rux-chip"><i class="fas fa-shield-halved"></i> بسيط للجميع · قوي للخبراء</span>
        </div>
      </section>
      <div class="rux-toolbar">
        <div class="rux-filters">
          <input class="rux-search" id="rux-role-search" type="search" placeholder="ابحث بالاسم أو الوصف أو لمن الدور…" value="${esc(state.filters.q)}" aria-label="بحث الأدوار" />
          <select id="rux-filter-status" aria-label="تصفية الحالة">
            <option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>كل الحالات</option>
            <option value="active" ${state.filters.status === 'active' ? 'selected' : ''}>نشط</option>
            <option value="inactive" ${state.filters.status === 'inactive' ? 'selected' : ''}>غير نشط</option>
          </select>
          <select id="rux-filter-kind" aria-label="تصفية النوع">
            <option value="all" ${state.filters.kind === 'all' ? 'selected' : ''}>نظامي ومخصص</option>
            <option value="system" ${state.filters.kind === 'system' ? 'selected' : ''}>أدوار النظام</option>
            <option value="custom" ${state.filters.kind === 'custom' ? 'selected' : ''}>أدوار مخصصة</option>
          </select>
          <select id="rux-filter-sensitive" aria-label="تصفية الحساسية">
            <option value="all" ${state.filters.sensitive === 'all' ? 'selected' : ''}>كل المستويات</option>
            <option value="yes" ${state.filters.sensitive === 'yes' ? 'selected' : ''}>صلاحيات حسّاسة فقط</option>
          </select>
        </div>
        <button type="button" class="rux-btn rux-btn--primary" id="rux-create-role"><i class="fas fa-plus"></i> إنشاء دور</button>
      </div>
      ${
        list.length
          ? `<div class="rux-role-grid">${list.map(roleCard).join('')}</div>`
          : `<div class="rux-empty"><h3>لا توجد أدوار مطابقة</h3><p>جرّب بحثًا آخر أو أنشئ دورًا جديدًا للتحكم بما يراه الموظفون.</p><button type="button" class="rux-btn rux-btn--primary" id="rux-create-role-empty">إنشاء دور</button></div>`
      }`;

    host.querySelector('#rux-role-search')?.addEventListener('input', (e) => {
      state.filters.q = e.target.value;
      paintRoles();
      host.querySelector('#rux-role-search')?.focus();
      const el = host.querySelector('#rux-role-search');
      if (el) el.selectionStart = el.selectionEnd = el.value.length;
    });
    host.querySelector('#rux-filter-status')?.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      paintRoles();
    });
    host.querySelector('#rux-filter-kind')?.addEventListener('change', (e) => {
      state.filters.kind = e.target.value;
      paintRoles();
    });
    host.querySelector('#rux-filter-sensitive')?.addEventListener('change', (e) => {
      state.filters.sensitive = e.target.value;
      paintRoles();
    });
    host.querySelectorAll('#rux-create-role, #rux-create-role-empty').forEach((btn) =>
      btn.addEventListener('click', () => openWizard())
    );
    host.querySelectorAll('[data-rux-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleRoleAction(btn.dataset.ruxAction, btn.dataset.code));
    });
  };

  const roleCard = (role) => {
    const status = role.is_active
      ? '<span class="rux-badge rux-badge--ok">نشط</span>'
      : '<span class="rux-badge rux-badge--off">موقوف</span>';
    return `
      <article class="rux-role-card ${role.is_sensitive ? 'is-sensitive' : ''}" data-code="${esc(role.code)}">
        <div class="rux-role-head">
          <div>
            <h3 class="rux-role-title">${esc(role.title_ar || role.name_ar)}</h3>
            <div class="rux-badges" style="margin-top:8px">
              ${status}
              ${role.is_system ? '<span class="rux-badge rux-badge--sys">دور نظام</span>' : '<span class="rux-badge">مخصص</span>'}
              ${role.is_sensitive ? '<span class="rux-badge rux-badge--hot">حساس</span>' : ''}
              <span class="rux-badge">مستوى ${esc(role.hierarchy_level)}</span>
            </div>
          </div>
        </div>
        <p class="rux-role-desc">${esc(role.plain_description || role.description || '')}</p>
        <p class="rux-role-desc" style="min-height:auto;font-size:12px;font-weight:700;color:#334155">لمن؟ ${esc(role.audience || 'المستخدمون')}</p>
        <div class="rux-metrics">
          <div class="rux-metric"><strong>${Number(role.users_count || 0)}</strong><span>مستخدمون</span></div>
          <div class="rux-metric"><strong>${Number(role.systems_count || 0)}</strong><span>أنظمة</span></div>
          <div class="rux-metric"><strong>${Number(role.permissions_count || role.systems_count || 0)}</strong><span>صلاحيات</span></div>
        </div>
        <div class="rux-actions">
          <button type="button" class="rux-btn rux-btn--primary" data-rux-action="view" data-code="${esc(role.code)}"><i class="fas fa-eye"></i> عرض الدور</button>
          <button type="button" class="rux-btn" data-rux-action="perms" data-code="${esc(role.code)}"><i class="fas fa-sliders"></i> تعديل الصلاحيات</button>
          <button type="button" class="rux-btn" data-rux-action="users" data-code="${esc(role.code)}"><i class="fas fa-users"></i> المستخدمون</button>
          <button type="button" class="rux-btn" data-rux-action="duplicate" data-code="${esc(role.code)}"><i class="fas fa-copy"></i> نسخ</button>
          <button type="button" class="rux-btn" data-rux-action="edit" data-code="${esc(role.code)}"><i class="fas fa-pen"></i> تعديل</button>
          <button type="button" class="rux-btn rux-btn--danger" data-rux-action="delete" data-code="${esc(role.code)}" ${role.can_delete === false ? 'disabled title="دور محمي"' : ''}><i class="fas fa-trash"></i> حذف</button>
        </div>
      </article>`;
  };

  const handleRoleAction = async (action, code) => {
    if (action === 'view') return openDrawer(code, 'overview');
    if (action === 'users') return openDrawer(code, 'users');
    if (action === 'perms') {
      state.selectedRoleCode = code;
      switchTo('permissions');
      await loadRoleDraft(code);
      paintPermissions();
      return;
    }
    if (action === 'edit' && typeof window.editRole === 'function') return window.editRole(code);
    if (action === 'duplicate') return duplicateRole(code);
    if (action === 'delete') return confirmDelete(code);
  };

  const openDrawer = async (code, tab = 'overview') => {
    try {
      const res = await fetch(`${API}/roles/${encodeURIComponent(code)}`, { headers: headers() });
      const data = await res.json();
      if (!data.success) return toast(data.message || 'تعذر فتح الدور', 'error');
      state.drawerRole = data.role;
      state.drawerUsers = data.users || [];
      state.drawerTab = tab;
      paintDrawer();
      document.getElementById('rux-overlay')?.classList.add('is-open');
    } catch {
      toast('خطأ في الاتصال', 'error');
    }
  };

  const paintDrawer = () => {
    const role = state.drawerRole;
    const host = document.getElementById('rux-drawer');
    if (!role || !host) return;
    const perms = (role.permissions || []).filter((p) => p.permission_level !== 'NONE');
    host.innerHTML = `
      <div class="rux-drawer-head">
        <div>
          <h2 id="rux-drawer-title" style="margin:0 0 6px;font-size:1.2rem">${esc(role.title_ar)}</h2>
          <p style="margin:0;color:#64748b;line-height:1.6">${esc(role.plain_description || role.description || '')}</p>
          <div class="rux-badges" style="margin-top:10px">
            ${role.is_protected ? '<span class="rux-badge rux-badge--sys">محمي</span>' : ''}
            ${role.is_sensitive ? '<span class="rux-badge rux-badge--hot">حساس</span>' : ''}
            <span class="rux-badge">${role.is_active ? 'نشط' : 'موقوف'}</span>
          </div>
        </div>
        <button type="button" class="rux-btn" id="rux-drawer-close" aria-label="إغلاق"><i class="fas fa-times"></i></button>
      </div>
      <div class="rux-drawer-body">
        <div class="rux-drawer-tabs">
          ${['overview', 'permissions', 'users', 'systems', 'advanced']
            .map((t) => {
              const labels = { overview: 'نظرة عامة', permissions: 'الصلاحيات', users: 'المستخدمون', systems: 'الأنظمة', advanced: 'متقدم' };
              return `<button type="button" class="rux-drawer-tab ${state.drawerTab === t ? 'is-on' : ''}" data-tab="${t}">${labels[t]}</button>`;
            })
            .join('')}
        </div>
        <div class="rux-panel ${state.drawerTab === 'overview' ? 'is-on' : ''}">
          <div class="rux-kv">
            <article><h4>لمن هذا الدور؟</h4><p>${esc(role.audience || 'المستخدمون')}</p></article>
            <article><h4>المستخدمون المعيّنون</h4><p>${Number(role.users_count || state.drawerUsers.length)}</p></article>
            <article><h4>الأنظمة المتاحة</h4><p>${Number(role.systems_count || 0)}</p></article>
            <article><h4>أعلى مستوى صلاحية</h4><p>${esc(role.highest_level_ar || '')}</p></article>
            <article><h4>آخر تحديث</h4><p>${esc((role.updated_at || role.created_at || '').toString().slice(0, 16).replace('T', ' '))}</p></article>
          </div>
          <div class="rux-actions" style="margin-top:14px">
            <button type="button" class="rux-btn rux-btn--primary" id="rux-drawer-edit-perms"><i class="fas fa-sliders"></i> تعديل الصلاحيات</button>
            <button type="button" class="rux-btn" id="rux-drawer-edit-meta"><i class="fas fa-pen"></i> تعديل البيانات</button>
          </div>
        </div>
        <div class="rux-panel ${state.drawerTab === 'permissions' ? 'is-on' : ''}">
          ${
            perms.length
              ? perms
                  .map((p) => {
                    const sys = state.systems.find((s) => s.code === p.system_code);
                    const lvl = levelMeta(p.permission_level);
                    return `<article class="rux-kv" style="margin-bottom:8px"><article><h4>${esc(sys?.name_ar || p.system_code)}</h4><p>${esc(lvl.name_ar)}</p><small style="color:#64748b">${esc(lvl.summary_ar || '')}</small></article></article>`;
                  })
                  .join('')
              : '<div class="rux-empty"><h3>لا صلاحيات مفعّلة</h3><p>فعّل وصول النظام من تبويب الصلاحيات.</p></div>'
          }
        </div>
        <div class="rux-panel ${state.drawerTab === 'users' ? 'is-on' : ''}">
          ${
            state.drawerUsers.length
              ? state.drawerUsers
                  .map(
                    (u) => `<div class="rux-user-row">
                      <div><strong>${esc(u.name)}</strong><div style="font-size:12px;color:#64748b">${esc(u.email || '')} · ${esc(u.entity_name || u.job_title || '')}</div></div>
                      <button type="button" class="rux-btn rux-btn--danger" data-revoke="${esc(u.id)}">إزالة</button>
                    </div>`
                  )
                  .join('')
              : '<div class="rux-empty"><h3>لا مستخدمين بعد</h3><p>عيّن مستخدمين من تبويب تعيين الأدوار.</p></div>'
          }
          <div class="rux-actions" style="margin-top:12px">
            <button type="button" class="rux-btn rux-btn--primary" id="rux-go-assign"><i class="fas fa-user-plus"></i> تعيين مستخدمين</button>
          </div>
        </div>
        <div class="rux-panel ${state.drawerTab === 'systems' ? 'is-on' : ''}">
          <div class="rux-sys-toggles">
            ${state.systems
              .map((s) => {
                const p = (role.permissions || []).find((x) => x.system_code === s.code);
                const on = p && p.permission_level !== 'NONE';
                return `<div class="rux-sys-toggle"><i class="fas ${on ? 'fa-check-circle' : 'fa-circle'}" style="color:${on ? '#059669' : '#cbd5e1'}"></i><div><strong>${esc(s.name_ar)}</strong><div style="font-size:12px;color:#64748b">${esc(on ? levelMeta(p.permission_level).name_ar : 'بدون صلاحية')}</div></div></div>`;
              })
              .join('')}
          </div>
        </div>
        <div class="rux-panel ${state.drawerTab === 'advanced' ? 'is-on' : ''}">
          <p style="font-size:13px;color:#64748b;margin:0 0 10px">معلومات تقنية للمطورين ومسؤولي الأنظمة المتقدمين.</p>
          <pre class="rux-advanced">${esc(
            JSON.stringify(
              {
                code: role.code,
                hierarchy_level: role.hierarchy_level,
                max_approval_limit: role.max_approval_limit,
                is_protected: role.is_protected,
                permissions: role.permissions,
              },
              null,
              2
            )
          )}</pre>
        </div>
      </div>`;

    host.querySelector('#rux-drawer-close')?.addEventListener('click', closeDrawer);
    host.querySelectorAll('.rux-drawer-tab').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.drawerTab = btn.dataset.tab;
        paintDrawer();
      })
    );
    host.querySelector('#rux-drawer-edit-perms')?.addEventListener('click', () => {
      closeDrawer();
      handleRoleAction('perms', role.code);
    });
    host.querySelector('#rux-drawer-edit-meta')?.addEventListener('click', () => {
      closeDrawer();
      if (typeof window.editRole === 'function') window.editRole(role.code);
    });
    host.querySelector('#rux-go-assign')?.addEventListener('click', () => {
      closeDrawer();
      switchTo('users');
    });
    host.querySelectorAll('[data-revoke]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.revoke;
        if (!confirm('إزالة هذا المستخدم من الدور؟')) return;
        const res = await fetch(`${API}/users/${id}/role`, { method: 'DELETE', headers: headers() });
        const data = await res.json();
        if (data.success) {
          toast('تمت إزالة المستخدم من الدور');
          openDrawer(role.code, 'users');
          if (typeof window.loadRoles === 'function') window.loadRoles();
          if (typeof window.loadUsersDirectory === 'function') window.loadUsersDirectory();
        } else toast(data.message || 'فشل', 'error');
      })
    );
  };

  const closeDrawer = () => document.getElementById('rux-overlay')?.classList.remove('is-open');

  const confirmDelete = (code) => {
    const role = state.roles.find((r) => r.code === code);
    if (!role) return;
    if (role.can_delete === false) {
      return showConfirm({
        title: 'دور محمي',
        body: 'هذا دور نظام مدمج ومحمي من الحذف العرضي. يمكنك تعديل صلاحياته أو إنشاء دور مخصص.',
        confirmLabel: 'حسناً',
        danger: false,
        onConfirm: () => {},
      });
    }
    showConfirm({
      title: `حذف «${role.title_ar}»؟`,
      body: `هذا الدور معيّن حاليًا لـ ${role.users_count || 0} مستخدمًا. الحذف قد يؤثر على وصولهم للأنظمة.`,
      confirmLabel: 'تأكيد الحذف',
      danger: true,
      onConfirm: async () => {
        const force = (role.users_count || 0) > 0 ? '?force=1' : '';
        const res = await fetch(`${API}/roles/${encodeURIComponent(code)}${force}`, {
          method: 'DELETE',
          headers: headers(),
        });
        const data = await res.json();
        if (data.success) {
          toast('تم حذف الدور');
          if (typeof window.loadRoles === 'function') window.loadRoles();
        } else toast(data.message || 'فشل الحذف', 'error');
      },
    });
  };

  const showConfirm = ({ title, body, confirmLabel, danger, onConfirm }) => {
    const host = document.getElementById('rux-confirm');
    if (!host) return;
    host.classList.add('is-open');
    host.innerHTML = `
      <div class="rux-confirm-card">
        <h3>${esc(title)}</h3>
        <p>${esc(body)}</p>
        <div class="rux-confirm-actions">
          <button type="button" class="rux-btn" id="rux-confirm-cancel">إلغاء</button>
          <button type="button" class="rux-btn ${danger ? 'rux-btn--danger' : 'rux-btn--primary'}" id="rux-confirm-ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    host.querySelector('#rux-confirm-cancel')?.addEventListener('click', () => host.classList.remove('is-open'));
    host.querySelector('#rux-confirm-ok')?.addEventListener('click', async () => {
      host.classList.remove('is-open');
      await onConfirm?.();
    });
  };

  const duplicateRole = async (code) => {
    const role = state.roles.find((r) => r.code === code);
    if (!role) return;
    const title = `${role.title_ar} (نسخة)`;
    const newCode = `${role.code}_COPY_${Date.now().toString(36).toUpperCase()}`.slice(0, 48);
    const res = await fetch(`${API}/roles`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        code: newCode,
        title_ar: title,
        title_en: `${role.title_en || role.code}_COPY`,
        description: role.plain_description || role.description || '',
        hierarchy_level: role.hierarchy_level,
        max_approval_limit: role.max_approval_limit,
        permissions: role.permissions || [],
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast('تم نسخ الدور');
      if (typeof window.loadRoles === 'function') window.loadRoles();
    } else toast(data.message || 'فشل النسخ', 'error');
  };

  const paintPermissions = () => {
    const host = document.getElementById('rux-root-perms');
    if (!host) return;
    if (!state.selectedRoleCode && state.roles[0]) state.selectedRoleCode = state.roles[0].code;
    const role = state.roles.find((r) => r.code === state.selectedRoleCode);
    const dirty = isDirty();
    const diff = diffSummary();

    host.innerHTML = `
      <section class="rux-intro">
        <h2>صلاحيات بلغة العمل — مش أكواد تقنية</h2>
        <p>لكل نظام مستوى واضح: عرض، تعديل، تشغيل، اعتماد، أو تحكم كامل. الصلاحيات الحساسة معلّمة بتحذير قبل الحفظ.</p>
      </section>
      <div class="rux-perm-shell">
        <aside class="rux-side">
          <h3>اختر الدور <button type="button" class="rux-tip" title="${esc(state.help.role || 'الدور مجموعة صلاحيات')}">?</button></h3>
          <select class="rux-role-pick" id="rux-perm-role" aria-label="اختيار الدور">
            ${state.roles
              .map((r) => `<option value="${esc(r.code)}" ${r.code === state.selectedRoleCode ? 'selected' : ''}>${esc(r.title_ar)}</option>`)
              .join('')}
          </select>
          <div class="rux-help">
            ${
              role
                ? `<strong>${esc(role.title_ar)}</strong><br>${esc(role.plain_description || '')}<br><br>المستخدمون: <strong>${role.users_count || 0}</strong>`
                : 'اختر دورًا لعرض صلاحياته.'
            }
          </div>
          <div class="rux-actions" style="margin-top:12px">
            <button type="button" class="rux-btn" id="rux-toggle-advanced">${state.advanced ? 'إخفاء الوضع المتقدم' : 'الوضع المتقدم'}</button>
            <button type="button" class="rux-btn" id="rux-enable-all">تفعيل كل الأنظمة (عرض)</button>
            <button type="button" class="rux-btn" id="rux-disable-all">إيقاف كل الأنظمة</button>
          </div>
        </aside>
        <section class="rux-main">
          <div class="rux-main-head">
            <div>
              <h2>${esc(role?.title_ar || 'الصلاحيات')}</h2>
              <p style="margin:4px 0 0;color:#64748b;font-size:13px">نظّم الوصول حسب النظام — احفظ بعد المراجعة</p>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700">
              <input type="checkbox" id="rux-advanced-check" ${state.advanced ? 'checked' : ''} /> إظهار المفاتيح التقنية
            </label>
          </div>
          <div class="rux-main-body">
            <div class="rux-level-legend">
              ${state.levels
                .filter((l) => l.code !== 'NONE')
                .map(
                  (l) => `<div class="rux-level-pill"><strong>${esc(l.name_ar)}</strong><span>${esc(l.summary_ar || '')}</span></div>`
                )
                .join('')}
            </div>
            ${state.systems.map(systemCard).join('')}
          </div>
          <div class="rux-sticky-bar">
            <div class="rux-diff">
              ${
                dirty
                  ? `ستحفظ <strong>${diff.changed}</strong> تغييرًا · +${diff.up} ترقية · −${diff.down} تخفيض`
                  : 'لا تغييرات معلّقة'
              }
            </div>
            <div class="rux-actions">
              <button type="button" class="rux-btn" id="rux-discard" ${dirty ? '' : 'disabled'}>تجاهل</button>
              <button type="button" class="rux-btn rux-btn--primary" id="rux-save-perms" ${dirty ? '' : 'disabled'}><i class="fas fa-save"></i> حفظ التغييرات</button>
            </div>
          </div>
        </section>
      </div>`;

    host.querySelector('#rux-perm-role')?.addEventListener('change', async (e) => {
      if (isDirty() && !confirm('لديك تغييرات غير محفوظة. المتابعة؟')) {
        e.target.value = state.selectedRoleCode;
        return;
      }
      state.selectedRoleCode = e.target.value;
      await loadRoleDraft(state.selectedRoleCode);
      paintPermissions();
    });
    host.querySelector('#rux-toggle-advanced')?.addEventListener('click', () => {
      state.advanced = !state.advanced;
      paintPermissions();
    });
    host.querySelector('#rux-advanced-check')?.addEventListener('change', (e) => {
      state.advanced = e.target.checked;
      paintPermissions();
    });
    host.querySelector('#rux-enable-all')?.addEventListener('click', () => {
      showConfirm({
        title: 'تفعيل كل الأنظمة؟',
        body: `سيتم ضبط جميع أنظمة ${state.systems.length} على مستوى «عرض فقط». يمكنك ترقية كل نظام لاحقًا.`,
        confirmLabel: 'تفعيل الكل',
        danger: false,
        onConfirm: () => {
          state.draftPerms = state.systems.map((s) => ({ system_code: s.code, permission_level: 'VIEW' }));
          paintPermissions();
        },
      });
    });
    host.querySelector('#rux-disable-all')?.addEventListener('click', () => {
      showConfirm({
        title: 'إيقاف كل الأنظمة؟',
        body: 'سيُزال وصول هذا الدور لكل الأنظمة. لن يتمكن المستخدمون المعيّنون من فتح أي نظام عبر هذا الدور.',
        confirmLabel: 'إيقاف الكل',
        danger: true,
        onConfirm: () => {
          state.draftPerms = state.systems.map((s) => ({ system_code: s.code, permission_level: 'NONE' }));
          paintPermissions();
        },
      });
    });
    host.querySelector('#rux-discard')?.addEventListener('click', () => {
      state.draftPerms = state.baselinePerms.map((p) => ({ ...p }));
      paintPermissions();
    });
    host.querySelector('#rux-save-perms')?.addEventListener('click', savePermissionsUx);
    host.querySelectorAll('[data-sys-toggle]').forEach((el) =>
      el.addEventListener('click', () => {
        const code = el.dataset.sysToggle;
        const card = host.querySelector(`[data-sys-card="${code}"]`);
        card?.classList.toggle('is-open');
      })
    );
    host.querySelectorAll('input[name^="lvl-"]').forEach((input) =>
      input.addEventListener('change', () => {
        const system = input.dataset.system;
        const level = input.value;
        const meta = levelMeta(level);
        const apply = () => {
          const row = state.draftPerms.find((p) => p.system_code === system);
          if (row) row.permission_level = level;
          else state.draftPerms.push({ system_code: system, permission_level: level });
          paintPermissions();
        };
        if (meta.risk === 'critical' || meta.risk === 'high') {
          showConfirm({
            title: 'صلاحية حسّاسة',
            body: meta.summary_ar || 'هذه صلاحية عالية التأثير. هل تريد تفعيلها؟',
            confirmLabel: 'تفعيل الصلاحية',
            danger: true,
            onConfirm: apply,
          });
          paintPermissions();
        } else apply();
      })
    );
    host.querySelectorAll('[data-module-level]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const system = btn.dataset.system;
        const level = btn.dataset.moduleLevel;
        const row = state.draftPerms.find((p) => p.system_code === system);
        if (row) row.permission_level = level;
        paintPermissions();
      })
    );
  };

  const systemCard = (system) => {
    const current = state.draftPerms.find((p) => p.system_code === system.code)?.permission_level || 'NONE';
    const meta = levelMeta(current);
    const critical = meta.risk === 'critical' || meta.risk === 'high';
    return `
      <article class="rux-sys-card ${critical ? 'is-critical' : ''} is-open" data-sys-card="${esc(system.code)}">
        <div class="rux-sys-head" data-sys-toggle="${esc(system.code)}" tabindex="0" role="button" aria-expanded="true">
          <div>
            <strong>${esc(system.name_ar)}</strong>
            <div style="font-size:12px;color:#64748b;margin-top:2px">${esc(system.description || '')}</div>
            ${state.advanced ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;direction:ltr;text-align:left">${esc(system.code)}</div>` : ''}
          </div>
          <div class="rux-badges">
            <span class="rux-badge ${critical ? 'rux-badge--hot' : current === 'NONE' ? '' : 'rux-badge--ok'}">${esc(meta.name_ar)}</span>
            <button type="button" class="rux-btn" data-module-level="NONE" data-system="${esc(system.code)}">إيقاف</button>
            <button type="button" class="rux-btn" data-module-level="VIEW" data-system="${esc(system.code)}">عرض</button>
            <button type="button" class="rux-btn" data-module-level="FULL_ACCESS" data-system="${esc(system.code)}">كامل</button>
          </div>
        </div>
        <div class="rux-sys-body">
          <div class="rux-level-options">
            ${state.levels
              .map((l) => {
                const on = current === l.code;
                const riskClass = l.risk === 'critical' ? 'is-critical' : l.risk === 'high' ? 'is-risk' : '';
                return `<label class="rux-level-option ${on ? 'is-on' : ''} ${riskClass}">
                  <input type="radio" name="lvl-${esc(system.code)}" value="${esc(l.code)}" data-system="${esc(system.code)}" ${on ? 'checked' : ''} />
                  <span>
                    <strong>${esc(l.name_ar)}${state.advanced ? ` <code style="font-size:11px;color:#94a3b8">${esc(l.code)}</code>` : ''}</strong>
                    <small>${esc(l.summary_ar || '')}</small>
                    ${
                      (l.risk === 'high' || l.risk === 'critical') && on
                        ? `<div class="rux-warn">⚠ صلاحية حسّاسة — تؤثر على ${esc(system.name_ar)} للمستخدمين المعيّنين لهذا الدور.</div>`
                        : ''
                    }
                  </span>
                </label>`;
              })
              .join('')}
          </div>
        </div>
      </article>`;
  };

  const loadRoleDraft = async (code) => {
    const res = await fetch(`${API}/roles/${encodeURIComponent(code)}`, { headers: headers() });
    const data = await res.json();
    if (!data.success) return;
    const perms = state.systems.map((s) => {
      const found = (data.permissions || []).find((p) => p.system_code === s.code);
      return { system_code: s.code, permission_level: found?.permission_level || 'NONE' };
    });
    state.draftPerms = perms.map((p) => ({ ...p }));
    state.baselinePerms = perms.map((p) => ({ ...p }));
    const idx = state.roles.findIndex((r) => r.code === code);
    if (idx >= 0) state.roles[idx] = { ...state.roles[idx], ...data.role };
  };

  const savePermissionsUx = async () => {
    const diff = diffSummary();
    showConfirm({
      title: 'حفظ تغييرات الصلاحيات؟',
      body: `سيتم تطبيق ${diff.changed} تغييرًا على دور «${state.roles.find((r) => r.code === state.selectedRoleCode)?.title_ar || ''}» (ترقية ${diff.up} · تخفيض ${diff.down}).`,
      confirmLabel: 'حفظ الآن',
      danger: false,
      onConfirm: async () => {
        const res = await fetch(`${API}/roles/${encodeURIComponent(state.selectedRoleCode)}/permissions`, {
          method: 'PUT',
          headers: headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            permissions: state.draftPerms,
            change_summary: { enabled_upgrades: diff.up, disabled_downgrades: diff.down, changed: diff.changed },
          }),
        });
        const data = await res.json();
        if (data.success) {
          state.baselinePerms = state.draftPerms.map((p) => ({ ...p }));
          toast('تم حفظ الصلاحيات');
          if (typeof window.loadRoles === 'function') await window.loadRoles();
          paintPermissions();
        } else toast(data.message || 'فشل الحفظ', 'error');
      },
    });
  };

  const openWizard = () => {
    state.wizardStep = 1;
    state.wizard = {
      template: 'CUSTOM',
      template_level: 'NONE',
      title_ar: '',
      description: '',
      hierarchy_level: 3,
      systems: Object.fromEntries(state.systems.map((s) => [s.code, false])),
    };
    paintWizard();
    document.getElementById('rux-wizard')?.classList.add('is-open');
  };

  const paintWizard = () => {
    const host = document.getElementById('rux-wizard');
    if (!host) return;
    const steps = ['البيانات', 'الأنظمة', 'الصلاحيات', 'مراجعة'];
    host.innerHTML = `
      <div class="rux-wizard-card">
        <div class="rux-wizard-head">
          <h2 id="rux-wizard-title" style="margin:0;font-size:1.15rem">إنشاء دور جديد</h2>
          <button type="button" class="rux-btn" id="rux-wizard-close" aria-label="إغلاق"><i class="fas fa-times"></i></button>
        </div>
        <div class="rux-steps">
          ${steps.map((s, i) => `<div class="rux-step ${state.wizardStep === i + 1 ? 'is-on' : ''}">${i + 1}. ${s}</div>`).join('')}
        </div>
        <div class="rux-wizard-body">${wizardBody()}</div>
        <div class="rux-wizard-foot">
          <button type="button" class="rux-btn" id="rux-wizard-back" ${state.wizardStep === 1 ? 'disabled' : ''}>رجوع</button>
          <div class="rux-actions">
            ${
              state.wizardStep < 4
                ? `<button type="button" class="rux-btn rux-btn--primary" id="rux-wizard-next">التالي</button>`
                : `<button type="button" class="rux-btn rux-btn--primary" id="rux-wizard-submit"><i class="fas fa-check"></i> إنشاء الدور</button>`
            }
          </div>
        </div>
      </div>`;
    host.querySelector('#rux-wizard-close')?.addEventListener('click', () => host.classList.remove('is-open'));
    host.querySelector('#rux-wizard-back')?.addEventListener('click', () => {
      syncWizardFields();
      state.wizardStep = Math.max(1, state.wizardStep - 1);
      paintWizard();
    });
    host.querySelector('#rux-wizard-next')?.addEventListener('click', () => {
      syncWizardFields();
      if (state.wizardStep === 1 && !state.wizard.title_ar.trim()) {
        toast('أدخل اسم الدور', 'error');
        return;
      }
      state.wizardStep = Math.min(4, state.wizardStep + 1);
      paintWizard();
    });
    host.querySelector('#rux-wizard-submit')?.addEventListener('click', submitWizard);
    host.querySelectorAll('[data-template]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.wizard.template = btn.dataset.template;
        state.wizard.template_level = btn.dataset.level || 'NONE';
        paintWizard();
      })
    );
  };

  const wizardBody = () => {
    if (state.wizardStep === 1) {
      return `
        <h3 style="margin:0 0 12px">ابدأ من قالب أو من الصفر</h3>
        <div class="rux-template-grid" style="margin-bottom:16px">
          ${(state.templates.length ? state.templates : [{ code: 'CUSTOM', title_ar: 'دور مخصص', description: 'من الصفر', base_level: 'NONE' }])
            .map(
              (t) => `<button type="button" class="rux-template ${state.wizard.template === t.code ? 'is-on' : ''}" data-template="${esc(t.code)}" data-level="${esc(t.base_level || 'NONE')}"><strong>${esc(t.title_ar)}</strong><span>${esc(t.description || '')}</span></button>`
            )
            .join('')}
        </div>
        <div class="rux-field"><label>اسم الدور</label><input id="rux-w-title" value="${esc(state.wizard.title_ar)}" placeholder="مثال: مدير المبيعات" /></div>
        <div class="rux-field"><label>وصف بسيط</label><textarea id="rux-w-desc" rows="3" placeholder="ماذا يستطيع صاحب هذا الدور أن يفعل؟">${esc(state.wizard.description)}</textarea></div>
        <div class="rux-field"><label>المستوى الإداري</label>
          <select id="rux-w-level">
            ${[0, 1, 2, 3, 4].map((n) => `<option value="${n}" ${Number(state.wizard.hierarchy_level) === n ? 'selected' : ''}>مستوى ${n}</option>`).join('')}
          </select>
        </div>`;
    }
    if (state.wizardStep === 2) {
      return `
        <h3 style="margin:0 0 8px">اختر الأنظمة التي يصل إليها الدور</h3>
        <p style="margin:0 0 14px;color:#64748b;font-size:13px">فعّل الأنظمة أولًا، ثم حدّد مستوى الصلاحية في الخطوة التالية.</p>
        <div class="rux-sys-toggles">
          ${state.systems
            .map(
              (s) => `<label class="rux-sys-toggle"><input type="checkbox" data-w-sys="${esc(s.code)}" ${state.wizard.systems[s.code] ? 'checked' : ''} /><span><strong>${esc(s.name_ar)}</strong><div style="font-size:12px;color:#64748b">${esc(s.description || '')}</div></span></label>`
            )
            .join('')}
        </div>`;
    }
    if (state.wizardStep === 3) {
      const level = state.wizard.template_level || 'VIEW';
      return `
        <h3 style="margin:0 0 8px">مستوى الصلاحية الافتراضي للأنظمة المختارة</h3>
        <p style="margin:0 0 14px;color:#64748b;font-size:13px">يمكنك تعديل كل نظام لاحقًا من تبويب الصلاحيات.</p>
        <div class="rux-level-options">
          ${state.levels
            .filter((l) => l.code !== 'NONE')
            .map(
              (l) => `<label class="rux-level-option ${level === l.code ? 'is-on' : ''}">
                <input type="radio" name="rux-w-perm" value="${esc(l.code)}" ${level === l.code ? 'checked' : ''} />
                <span><strong>${esc(l.name_ar)}</strong><small>${esc(l.summary_ar || '')}</small></span>
              </label>`
            )
            .join('')}
        </div>`;
    }
    const selectedSystems = state.systems.filter((s) => state.wizard.systems[s.code]);
    const lvl = levelMeta(state.wizard.template_level || 'NONE');
    return `
      <h3 style="margin:0 0 12px">مراجعة قبل الإنشاء</h3>
      <div class="rux-kv">
        <article><h4>الدور</h4><p>${esc(state.wizard.title_ar)}</p></article>
        <article><h4>الوصف</h4><p>${esc(state.wizard.description || '—')}</p></article>
        <article><h4>الأنظمة</h4><p>${selectedSystems.length ? selectedSystems.map((s) => s.name_ar).join(' · ') : 'لا أنظمة بعد'}</p></article>
        <article><h4>مستوى الصلاحية</h4><p>${esc(lvl.name_ar)} — ${esc(lvl.summary_ar || '')}</p></article>
      </div>`;
  };

  const syncWizardFields = () => {
    const title = document.getElementById('rux-w-title');
    const desc = document.getElementById('rux-w-desc');
    const level = document.getElementById('rux-w-level');
    if (title) state.wizard.title_ar = title.value;
    if (desc) state.wizard.description = desc.value;
    if (level) state.wizard.hierarchy_level = Number(level.value);
    document.querySelectorAll('[data-w-sys]').forEach((cb) => {
      state.wizard.systems[cb.dataset.wSys] = cb.checked;
    });
    const perm = document.querySelector('input[name="rux-w-perm"]:checked');
    if (perm) state.wizard.template_level = perm.value;
  };

  const submitWizard = async () => {
    syncWizardFields();
    const code = state.wizard.title_ar
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u0600-\u06FF-]+/g, '')
      .toUpperCase()
      .slice(0, 40) || `ROLE_${Date.now().toString(36).toUpperCase()}`;
    const level = state.wizard.template_level || 'NONE';
    const permissions = state.systems.map((s) => ({
      system_code: s.code,
      permission_level: state.wizard.systems[s.code] ? level : 'NONE',
    }));
    const res = await fetch(`${API}/roles`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        code,
        title_ar: state.wizard.title_ar.trim(),
        title_en: code,
        description: state.wizard.description.trim(),
        hierarchy_level: state.wizard.hierarchy_level,
        permissions,
        template_level: level,
      }),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('rux-wizard')?.classList.remove('is-open');
      toast('تم إنشاء الدور');
      if (typeof window.loadRoles === 'function') await window.loadRoles();
      state.selectedRoleCode = data.role.code;
      switchTo('permissions');
      await loadRoleDraft(data.role.code);
      paintPermissions();
    } else toast(data.message || 'فشل الإنشاء', 'error');
  };

  // Override legacy displays
  window.displayRoles = function displayRoles(roles) {
    state.roles = Array.isArray(roles) ? roles : [];
    ensureHosts();
    paintRoles();
    const loading = document.getElementById('rolesLoading');
    if (loading) loading.classList.add('hidden');
    const table = document.getElementById('rolesTable');
    if (table) table.classList.add('hidden');
  };

  window.filterRoles = function filterRoles() {
    const legacy = document.getElementById('roleSearch');
    if (legacy) state.filters.q = legacy.value || state.filters.q;
    paintRoles();
  };

  window.displayPermissions = function displayPermissions() {
    ensureHosts();
    if (!state.draftPerms.length && state.selectedRoleCode) {
      loadRoleDraft(state.selectedRoleCode).then(paintPermissions);
      return;
    }
    paintPermissions();
  };

  window.showCreateRoleModal = function showCreateRoleModal() {
    openWizard();
  };

  window.confirmDeleteRole = function confirmDeleteRole(code) {
    confirmDelete(code);
  };

  const originalLoadRolePermissions = window.loadRolePermissions;
  window.loadRolePermissions = async function loadRolePermissions() {
    const select = document.getElementById('permissionRoleSelect');
    if (select?.value) state.selectedRoleCode = select.value;
    await loadRoleDraft(state.selectedRoleCode);
    ensureHosts();
    paintPermissions();
    if (typeof originalLoadRolePermissions === 'function') {
      /* keep select sync only */
    }
    const loading = document.getElementById('permissionsLoading');
    const content = document.getElementById('permissionsContent');
    if (loading) loading.classList.add('hidden');
    if (content) content.classList.add('hidden');
  };

  const boot = async () => {
    ensureHosts();
    try {
      const res = await fetch(`${API}/metadata`, { headers: headers() });
      const data = await res.json();
      if (data.success) {
        state.systems = data.systems || [];
        state.levels = data.permission_levels || [];
        state.templates = data.templates || [];
        state.help = data.help || {};
      }
    } catch {}
    if (Array.isArray(window.rolesData) && window.rolesData.length) {
      state.roles = window.rolesData;
      paintRoles();
    }
    document.getElementById('rux-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'rux-overlay') closeDrawer();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  const originalSwitchTab = window.switchTab;
  if (typeof originalSwitchTab === 'function' && !originalSwitchTab.__ruxHooked) {
    window.switchTab = function switchTab(tabName, btnElement, opts) {
      const result = originalSwitchTab.apply(this, arguments);
      ensureHosts();
      if (tabName === 'roles') paintRoles();
      if (tabName === 'permissions') {
        const run = async () => {
          if (!state.selectedRoleCode && state.roles[0]) state.selectedRoleCode = state.roles[0].code;
          if (state.selectedRoleCode && !state.draftPerms.length) await loadRoleDraft(state.selectedRoleCode);
          paintPermissions();
        };
        run();
      }
      return result;
    };
    window.switchTab.__ruxHooked = true;
  }

  // Re-paint after legacy loadRoles finishes updating globals
  const hookLoadRoles = () => {
    const original = window.loadRoles;
    if (typeof original !== 'function' || original.__ruxHooked) return;
    window.loadRoles = async function loadRoles() {
      await original.apply(this, arguments);
      state.roles = Array.isArray(window.rolesData) ? window.rolesData : state.roles;
      if (Array.isArray(window.systemsData) && window.systemsData.length) state.systems = window.systemsData;
      if (Array.isArray(window.permissionLevelsData) && window.permissionLevelsData.length) {
        // merge summaries if metadata already loaded
        state.levels = window.permissionLevelsData.map((l) => {
          const rich = state.levels.find((x) => x.code === l.code);
          return rich ? { ...l, ...rich } : l;
        });
      }
      ensureHosts();
      paintRoles();
    };
    window.loadRoles.__ruxHooked = true;
  };
  hookLoadRoles();
  setTimeout(hookLoadRoles, 0);
  setTimeout(hookLoadRoles, 500);
  setTimeout(() => {
    if (typeof window.switchTab === 'function' && !window.switchTab.__ruxHooked) {
      /* retry hook if switchTab defined late */
      const late = window.switchTab;
      window.switchTab = function switchTab(tabName, btnElement, opts) {
        const result = late.apply(this, arguments);
        ensureHosts();
        if (tabName === 'roles') paintRoles();
        if (tabName === 'permissions') {
          (async () => {
            if (!state.selectedRoleCode && state.roles[0]) state.selectedRoleCode = state.roles[0].code;
            if (state.selectedRoleCode && !state.draftPerms.length) await loadRoleDraft(state.selectedRoleCode);
            paintPermissions();
          })();
        }
        return result;
      };
      window.switchTab.__ruxHooked = true;
    }
  }, 800);

  window.HubRolesUX = {
    paintRoles,
    paintPermissions,
    openWizard,
    openDrawer,
    state,
  };
})();
