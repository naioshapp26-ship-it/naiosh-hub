/**
 * Dashboard: حسابي + إدارة الإداريين (server-backed staff credentials).
 */
(() => {
  'use strict';

  function authHeaders() {
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      'X-Hub-Token': token,
    };
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: authHeaders(),
      ...opts,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || data.message || 'فشل الطلب');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function mountAccount(el, { toast } = {}) {
    if (!el) return;
    el.innerHTML = '<p class="text-muted">جاري التحميل…</p>';
    try {
      const data = await api('/api/admin/account');
      const a = data.account || {};
      const accountId = a.accountId || a.naioshId || '—';
      el.innerHTML = `
        <div class="panel-card sa-account-panel" style="max-width:960px;width:100%">
          <section class="sa-profile-section" style="margin-bottom:28px">
            <h3 style="margin:0 0 6px">بيانات حسابي</h3>
            <p style="margin:0 0 16px;color:#64748b;font-size:14px">بيانات الحساب الإداري المرتبط بجلستك الحالية.</p>
            <form id="sa-profile-form" class="sa-profile-form" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px">
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">الاسم</label>
                <div class="sa-readonly" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">${esc(a.name || '—')}</div>
              </div>
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">البريد الإلكتروني</label>
                <div class="sa-readonly" dir="ltr" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;text-align:left">${esc(a.email || '—')}</div>
              </div>
              <div class="sa-field">
                <label for="sa-phone" style="display:block;font-weight:700;margin-bottom:6px">رقم الجوال</label>
                <input id="sa-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr"
                  value="${esc(a.phone || '')}" placeholder="+97059XXXXXXX"
                  style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;text-align:left;box-sizing:border-box" />
                <small style="display:block;margin-top:4px;color:#64748b">يمكن إضافة رمز الدولة. مثال: +97059XXXXXXX</small>
              </div>
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">رقم الموظف</label>
                <div class="sa-readonly" dir="ltr" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;text-align:left">${esc(a.employeeNo || '—')}</div>
              </div>
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">رقم الحساب</label>
                <div class="sa-readonly" dir="ltr" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;text-align:left">${esc(accountId)}</div>
              </div>
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">الدور</label>
                <div class="sa-readonly" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">${esc(a.roleLabel || a.role || '—')}</div>
              </div>
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">الحالة</label>
                <div class="sa-readonly" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">${esc(a.statusLabel || a.status || '—')}</div>
              </div>
              <div class="sa-field">
                <label style="display:block;font-weight:700;margin-bottom:6px">مكان العمل</label>
                <div class="sa-readonly" style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">${esc(a.workplace || '—')}</div>
              </div>
              <div class="sa-field" style="grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:4px">
                <button type="submit" class="btn btn-primary" id="sa-profile-save">حفظ التغييرات</button>
                <p id="sa-profile-msg" style="margin:0;font-weight:700"></p>
              </div>
            </form>
          </section>
          ${a.mustChangePassword ? '<p class="alert alert-warn" style="color:#991b1b;font-weight:700">يُفضَّل تغيير كلمة المرور الأولية قبل الإطلاق العام.</p>' : ''}
          <section class="sa-security-section" style="border-top:1px solid #e5e7eb;padding-top:22px">
            <h3 style="margin:0 0 6px">الأمان وكلمة المرور</h3>
            <p style="margin:0 0 14px;color:#64748b;font-size:14px">تغيير كلمة المرور منفصل عن حفظ بيانات الحساب.</p>
            <form id="sa-pwd-form" class="cp-form" style="display:grid;gap:10px;max-width:480px">
              <label style="font-weight:700">كلمة المرور الحالية<input type="password" name="currentPassword" required autocomplete="current-password" class="form-control" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;margin-top:6px;box-sizing:border-box"></label>
              <label style="font-weight:700">كلمة المرور الجديدة<input type="password" name="newPassword" required autocomplete="new-password" class="form-control" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;margin-top:6px;box-sizing:border-box"></label>
              <label style="font-weight:700">تأكيد كلمة المرور الجديدة<input type="password" name="confirmPassword" required autocomplete="new-password" class="form-control" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;margin-top:6px;box-sizing:border-box"></label>
              <button type="submit" class="btn btn-primary">تغيير كلمة المرور</button>
              <p id="sa-pwd-msg" style="margin:0;font-weight:700"></p>
            </form>
          </section>
        </div>
        <style>
          @media (max-width:720px){
            .sa-profile-form{grid-template-columns:1fr !important}
          }
        </style>`;

      const profileForm = el.querySelector('#sa-profile-form');
      const profileMsg = el.querySelector('#sa-profile-msg');
      profileForm?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const phone = String(new FormData(profileForm).get('phone') || '').trim();
        profileMsg.style.color = '#475569';
        profileMsg.textContent = 'جاري الحفظ…';
        try {
          const result = await api('/api/admin/account', {
            method: 'PATCH',
            body: { phone },
          });
          profileMsg.style.color = '#166534';
          profileMsg.textContent = result.message || 'تم حفظ بيانات الحساب بنجاح.';
          toast?.(profileMsg.textContent);
          const input = el.querySelector('#sa-phone');
          if (input && result.account) input.value = result.account.phone || '';
        } catch (err) {
          profileMsg.style.color = '#991b1b';
          profileMsg.textContent = err.message || 'تعذر الحفظ';
          toast?.(profileMsg.textContent);
        }
      });

      const form = el.querySelector('#sa-pwd-form');
      const msg = el.querySelector('#sa-pwd-msg');
      form?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        try {
          const result = await api('/api/admin/account/password', {
            method: 'POST',
            body: {
              currentPassword: fd.get('currentPassword'),
              newPassword: fd.get('newPassword'),
              confirmPassword: fd.get('confirmPassword'),
            },
          });
          if (result.token && window.HubAuth?.setSession) {
            window.HubAuth.setSession(result.user || window.HubAuth.getUser(), result.token, { remember: true });
          } else if (result.token) {
            localStorage.setItem('hubAuthToken', result.token);
            if (result.user) localStorage.setItem('hubUser', JSON.stringify(result.user));
          }
          msg.style.color = '#166534';
          msg.textContent = result.message || 'تم تغيير كلمة المرور بنجاح.';
          toast?.(msg.textContent);
          form.reset();
        } catch (err) {
          msg.style.color = '#991b1b';
          msg.textContent = err.message || 'تعذر التغيير';
          toast?.(msg.textContent);
        }
      });
    } catch (err) {
      el.innerHTML = `<p style="color:#991b1b">${esc(err.message)}</p>`;
    }
  }

  const PERM_AR = {
    'clients.view': 'عرض العملاء',
    'clients.create': 'إنشاء عميل',
    'clients.edit': 'تعديل عميل',
    'clients.suspend': 'إيقاف عميل',
    'clients.manage': 'إدارة العملاء',
    'permissions.manage': 'إدارة الصلاحيات',
    'orders.view': 'عرض الطلبات',
    'orders.manage': 'إدارة الطلبات',
    'reports.view': 'عرض التقارير',
    'support.view': 'عرض الدعم',
    'support.reply': 'الرد على الدعم',
  };
  function permLabel(code) {
    return PERM_AR[code] || code;
  }
  function dash(v) {
    const s = String(v ?? '').trim();
    return s ? s : 'غير مسجل';
  }
  function fmtDate(iso) {
    if (!iso) return 'غير مسجل';
    try {
      return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  }

  async function mountStaffAdmin(el, { toast } = {}) {
    if (!el) return;
    el.innerHTML = '<p class="text-muted">جاري التحميل…</p>';
    let catalog = [];
    let roles = [];
    let allStaff = [];
    let stats = {};
    let pageInfo = {};
    const filters = { q: '', affiliation: '', role: '', status: '', perm: '' };

    function filteredStaff() {
      const q = filters.q.trim().toLowerCase();
      return allStaff.filter((s) => {
        if (filters.affiliation && s.affiliationKind !== filters.affiliation) return false;
        if (filters.role && s.role !== filters.role) return false;
        if (filters.status === 'active' && !(s.active && s.assignmentStatus !== 'revoked')) return false;
        if (filters.status === 'suspended' && !(!s.active && s.assignmentStatus !== 'revoked')) return false;
        if (filters.status === 'revoked' && s.assignmentStatus !== 'revoked') return false;
        if (filters.perm) {
          const perms = Array.isArray(s.permissions) ? s.permissions : [];
          if (!perms.includes(filters.perm)) return false;
        }
        if (!q) return true;
        const blob = [s.name, s.email, s.employeeNo, s.accountId, s.phone, s.orgName, s.department]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        return blob.includes(q);
      });
    }

    function permChecks(selected) {
      const set = new Set(selected || []);
      return catalog
        .map(
          (p) =>
            `<label style="display:inline-flex;gap:6px;align-items:center;margin:4px 8px 4px 0;font-size:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:999px;padding:4px 10px"><input type="checkbox" name="perm" value="${esc(p)}" ${set.has(p) ? 'checked' : ''}/> ${esc(permLabel(p))}</label>`
        )
        .join('');
    }

    function renderTable(rows) {
      if (!rows.length) {
        return `<tr><td colspan="13" style="padding:20px;text-align:center;color:#64748b">لا يوجد إداريون مطابقون للبحث أو الفلاتر.</td></tr>`;
      }
      return rows
        .map((s) => {
          const perms = Array.isArray(s.permissions) ? s.permissions : [];
          const permText =
            s.permissions == null
              ? 'كامل (قائد أعلى)'
              : perms.length
                ? perms.slice(0, 4).map(permLabel).join(' · ') + (perms.length > 4 ? ` (+${perms.length - 4})` : '')
                : 'لا صلاحيات';
          const isLeader = s.role === 'supreme_leader' || s.role === 'super_admin';
          return `<tr data-email="${esc(s.email)}">
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;min-width:120px"><strong>${esc(dash(s.name))}</strong></td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9" dir="ltr">${esc(dash(s.employeeNo))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9" dir="ltr">${esc(dash(s.accountId))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9" dir="ltr">${esc(dash(s.email))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9" dir="ltr">${esc(dash(s.phone))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${esc(s.affiliationLabel || 'غير مسجل')}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${esc(dash(s.orgName))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${esc(dash(s.department || s.workplace))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">${esc(s.roleLabel || 'غير مسجل')}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;max-width:220px;font-size:12px;color:#334155">${esc(permText)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${s.assignmentStatus === 'revoked' ? '#fee2e2' : s.active ? '#dcfce7' : '#ffedd5'};font-size:12px;font-weight:700">${esc(s.statusLabel)}</span></td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-size:12px">${esc(fmtDate(s.updatedAt))}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9">
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                <button type="button" class="btn btn-sm" data-act="view" data-email="${esc(s.email)}">عرض</button>
                <button type="button" class="btn btn-sm" data-act="edit" data-email="${esc(s.email)}">تعديل</button>
                ${isLeader ? '' : `<button type="button" class="btn btn-sm" data-act="perms" data-email="${esc(s.email)}">الصلاحيات</button>`}
                ${
                  isLeader
                    ? ''
                    : s.active && s.assignmentStatus !== 'revoked'
                      ? `<button type="button" class="btn btn-sm" data-act="disable" data-email="${esc(s.email)}">إيقاف</button>`
                      : `<button type="button" class="btn btn-sm" data-act="enable" data-email="${esc(s.email)}">تفعيل</button>`
                }
                ${isLeader || s.assignmentStatus === 'revoked' ? '' : `<button type="button" class="btn btn-sm" data-act="revoke" data-email="${esc(s.email)}">إلغاء التكليف</button>`}
              </div>
            </td>
          </tr>`;
        })
        .join('');
    }

    function paint() {
      const rows = filteredStaff();
      const st = stats || {};
      el.innerHTML = `
        <div class="panel-card sa-admins-panel" style="max-width:100%">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            <div style="max-width:720px">
              <h3 style="margin:0">إدارة الإداريين</h3>
              <p style="margin:6px 0 0;color:#475569;line-height:1.7">${esc(pageInfo.purpose || 'إدارة الأشخاص الذين لديهم صلاحيات إدارية داخل المنصة.')}</p>
              <p style="margin:8px 0 0;font-size:13px">
                <a href="${esc(pageInfo.teamOpsLink || 'dashboard.html#roles-permissions')}" style="color:#b91c1c;font-weight:700;text-decoration:none">← ${esc(pageInfo.teamOpsLabel || 'إدارة فريق العمل والصلاحيات')}</a>
                <span style="color:#94a3b8"> · فريق العمل = جميع المكلّفين · الإداريون = من لديهم صلاحيات إدارية فعلية</span>
              </p>
            </div>
            <button type="button" class="btn btn-primary" id="sa-add-btn">+ إضافة إداري</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px" class="sa-stats-grid">
            ${[
              ['إجمالي الإداريين', st.total || 0],
              ['النشطون', st.active || 0],
              ['الموقوفون', st.suspended || 0],
              ['تابعون لنايوش', st.naiosh || 0],
              ['جهات خارجية', st.external || 0],
            ]
              .map(
                ([label, val]) =>
                  `<div style="background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px"><div style="font-size:12px;color:#64748b">${esc(label)}</div><div style="font-size:22px;font-weight:800;margin-top:4px">${esc(val)}</div></div>`
              )
              .join('')}
          </div>

          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1.2fr;gap:8px;margin-bottom:12px" class="sa-filters-grid">
            <input id="sa-q" type="search" placeholder="بحث بالاسم أو رقم الموظف أو البريد…" value="${esc(filters.q)}" style="padding:10px 12px;border:1px solid #d1d5db;border-radius:10px"/>
            <select id="sa-f-aff" style="padding:10px;border:1px solid #d1d5db;border-radius:10px">
              <option value="">جهة العمل</option>
              <option value="naiosh" ${filters.affiliation === 'naiosh' ? 'selected' : ''}>نايوش</option>
              <option value="external" ${filters.affiliation === 'external' ? 'selected' : ''}>جهة خارجية</option>
            </select>
            <select id="sa-f-role" style="padding:10px;border:1px solid #d1d5db;border-radius:10px">
              <option value="">الدور</option>
              ${roles.map((r) => `<option value="${esc(r.code)}" ${filters.role === r.code ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
            </select>
            <select id="sa-f-status" style="padding:10px;border:1px solid #d1d5db;border-radius:10px">
              <option value="">الحالة</option>
              <option value="active" ${filters.status === 'active' ? 'selected' : ''}>نشط</option>
              <option value="suspended" ${filters.status === 'suspended' ? 'selected' : ''}>موقوف</option>
              <option value="revoked" ${filters.status === 'revoked' ? 'selected' : ''}>ملغى التكليف</option>
            </select>
            <select id="sa-f-perm" style="padding:10px;border:1px solid #d1d5db;border-radius:10px">
              <option value="">الصلاحيات</option>
              ${catalog.slice(0, 40).map((p) => `<option value="${esc(p)}" ${filters.perm === p ? 'selected' : ''}>${esc(permLabel(p))}</option>`).join('')}
            </select>
          </div>

          <div id="sa-form-wrap" class="hidden" style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;background:#f8fafc"></div>

          <div style="overflow:auto;border:1px solid #e2e8f0;border-radius:12px">
            <table class="table" style="width:100%;border-collapse:collapse;min-width:1100px;font-size:13px">
              <thead>
                <tr style="background:#f1f5f9">
                  <th style="text-align:right;padding:10px 8px">الاسم</th>
                  <th style="text-align:right;padding:10px 8px">رقم الموظف</th>
                  <th style="text-align:right;padding:10px 8px">رقم الحساب</th>
                  <th style="text-align:right;padding:10px 8px">البريد</th>
                  <th style="text-align:right;padding:10px 8px">الجوال</th>
                  <th style="text-align:right;padding:10px 8px">جهة العمل</th>
                  <th style="text-align:right;padding:10px 8px">المؤسسة</th>
                  <th style="text-align:right;padding:10px 8px">القسم</th>
                  <th style="text-align:right;padding:10px 8px">الدور</th>
                  <th style="text-align:right;padding:10px 8px">الصلاحيات</th>
                  <th style="text-align:right;padding:10px 8px">الحالة</th>
                  <th style="text-align:right;padding:10px 8px">آخر تعديل</th>
                  <th style="text-align:right;padding:10px 8px">إجراءات</th>
                </tr>
              </thead>
              <tbody id="sa-tbody">${renderTable(rows)}</tbody>
            </table>
          </div>
          <p style="margin:8px 0 0;color:#64748b;font-size:12px">عرض ${rows.length} من ${allStaff.length}</p>

          <details style="margin-top:18px" open>
            <summary style="cursor:pointer;font-weight:700">سجل التدقيق</summary>
            <div id="sa-audit" style="margin-top:10px;font-size:13px;color:#444">جاري التحميل…</div>
          </details>
        </div>
        <style>
          @media (max-width:900px){
            .sa-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
            .sa-filters-grid{grid-template-columns:1fr 1fr !important}
          }
          @media (max-width:560px){
            .sa-stats-grid{grid-template-columns:1fr 1fr !important}
            .sa-filters-grid{grid-template-columns:1fr !important}
          }
        </style>`;

      const bindFilter = (id, key) => {
        el.querySelector(id)?.addEventListener('input', (ev) => {
          filters[key] = ev.target.value;
          const tbody = el.querySelector('#sa-tbody');
          if (tbody) tbody.innerHTML = renderTable(filteredStaff());
          bindRowActions();
        });
        el.querySelector(id)?.addEventListener('change', (ev) => {
          filters[key] = ev.target.value;
          const tbody = el.querySelector('#sa-tbody');
          if (tbody) tbody.innerHTML = renderTable(filteredStaff());
          bindRowActions();
        });
      };
      bindFilter('#sa-q', 'q');
      bindFilter('#sa-f-aff', 'affiliation');
      bindFilter('#sa-f-role', 'role');
      bindFilter('#sa-f-status', 'status');
      bindFilter('#sa-f-perm', 'perm');
      el.querySelector('#sa-add-btn')?.addEventListener('click', () => showAddForm());
      bindRowActions();
      loadAudit();
    }

    function bindRowActions() {
      el.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => handleRow(btn.dataset.act, btn.dataset.email));
      });
    }

    async function reload() {
      const data = await api('/api/admin/staff');
      catalog = data.permissionCatalog || [];
      roles = data.roles || [];
      allStaff = data.staff || [];
      stats = data.stats || {};
      pageInfo = data.pageInfo || {};
      paint();
    }

    function fieldGrid(html) {
      return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${html}</div>`;
    }

    function showAddForm() {
      const wrap = el.querySelector('#sa-form-wrap');
      if (!wrap) return;
      wrap.classList.remove('hidden');
      wrap.innerHTML = `
        <h4 style="margin:0 0 8px">إضافة إداري</h4>
        <p style="margin:0 0 12px;color:#64748b;font-size:13px">يُنشأ حساب بهوية وظيفية (رقم موظف + رقم حساب) وصلاحيات محددة. الانتماء لنايوش أو لجهة خارجية لا يمنح صلاحيات تلقائيًا.</p>
        <form id="sa-add-form" style="display:grid;gap:12px">
          ${fieldGrid(`
            <label style="font-weight:700">الاسم<input name="name" required style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box"/></label>
            <label style="font-weight:700">البريد الإلكتروني<input name="email" type="email" required dir="ltr" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box;text-align:left"/></label>
            <label style="font-weight:700">رقم الجوال<input name="phone" dir="ltr" placeholder="+97059XXXXXXX" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box;text-align:left"/></label>
            <label style="font-weight:700">جهة العمل
              <select name="affiliationKind" id="sa-aff-kind" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px">
                <option value="naiosh">نايوش</option>
                <option value="external">جهة خارجية</option>
              </select>
            </label>
            <label style="font-weight:700">اسم الجهة / المؤسسة<input name="orgName" id="sa-org-name" value="نايوش" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box"/></label>
            <label style="font-weight:700">القسم / مكان العمل<input name="department" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box"/></label>
            <label style="font-weight:700">الدور الإداري
              <select name="role" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px">
                ${roles
                  .filter((r) => r.code !== 'supreme_leader')
                  .map((r) => `<option value="${esc(r.code)}">${esc(r.label)}</option>`)
                  .join('')}
              </select>
            </label>
            <label style="font-weight:700">كلمة مرور مؤقتة<input name="temporaryPassword" type="password" required autocomplete="new-password" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box"/></label>
          `)}
          <fieldset style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:0">
            <legend style="font-weight:800;padding:0 6px">الصلاحيات الممنوحة</legend>
            <div style="max-height:180px;overflow:auto">${permChecks([])}</div>
          </fieldset>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="submit" class="btn btn-primary">إنشاء الإداري</button>
            <button type="button" class="btn" id="sa-cancel-add">إلغاء</button>
            <p id="sa-add-msg" style="margin:0;font-weight:700"></p>
          </div>
        </form>`;
      const aff = wrap.querySelector('#sa-aff-kind');
      const org = wrap.querySelector('#sa-org-name');
      aff?.addEventListener('change', () => {
        if (aff.value === 'naiosh') org.value = org.value || 'نايوش';
        else if (org.value === 'نايوش') org.value = '';
      });
      wrap.querySelector('#sa-cancel-add')?.addEventListener('click', () => {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      });
      wrap.querySelector('#sa-add-form')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const permissions = [...ev.target.querySelectorAll('input[name=perm]:checked')].map((i) => i.value);
        const msg = wrap.querySelector('#sa-add-msg');
        try {
          const result = await api('/api/admin/staff', {
            method: 'POST',
            body: {
              name: fd.get('name'),
              email: fd.get('email'),
              phone: fd.get('phone'),
              affiliationKind: fd.get('affiliationKind'),
              orgName: fd.get('orgName'),
              department: fd.get('department'),
              workplace: fd.get('department'),
              role: fd.get('role'),
              temporaryPassword: fd.get('temporaryPassword'),
              permissions,
            },
          });
          msg.style.color = '#166534';
          msg.textContent = `${result.message || 'تم الإنشاء'} — ${result.staff?.employeeNo || ''} / ${result.staff?.accountId || ''}`;
          toast?.(msg.textContent);
          setTimeout(() => reload().catch(() => {}), 500);
        } catch (err) {
          msg.style.color = '#991b1b';
          msg.textContent = err.message;
          toast?.(err.message);
        }
      });
    }

    function showEditForm(row) {
      const wrap = el.querySelector('#sa-form-wrap');
      if (!wrap || !row) return;
      wrap.classList.remove('hidden');
      const isLeader = row.role === 'supreme_leader' || row.role === 'super_admin';
      wrap.innerHTML = `
        <h4 style="margin:0 0 8px">${isLeader ? 'عرض / تعديل محدود' : 'تعديل بيانات الإداري'}: ${esc(row.name)}</h4>
        <form id="sa-edit-form" style="display:grid;gap:12px">
          ${fieldGrid(`
            <label style="font-weight:700">الاسم<input name="name" ${isLeader ? 'readonly' : ''} value="${esc(row.name || '')}" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box;background:${isLeader ? '#f8fafc' : '#fff'}"/></label>
            <label style="font-weight:700">البريد<input value="${esc(row.email)}" readonly dir="ltr" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;background:#f8fafc;text-align:left"/></label>
            <label style="font-weight:700">رقم الموظف<input value="${esc(row.employeeNo || '')}" readonly dir="ltr" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;background:#f8fafc;text-align:left"/></label>
            <label style="font-weight:700">رقم الحساب<input value="${esc(row.accountId || '')}" readonly dir="ltr" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;background:#f8fafc;text-align:left"/></label>
            <label style="font-weight:700">رقم الجوال<input name="phone" value="${esc(row.phone || '')}" dir="ltr" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box;text-align:left"/></label>
            <label style="font-weight:700">جهة العمل
              <select name="affiliationKind" ${isLeader ? 'disabled' : ''} style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px">
                <option value="naiosh" ${row.affiliationKind === 'naiosh' ? 'selected' : ''}>نايوش</option>
                <option value="external" ${row.affiliationKind === 'external' ? 'selected' : ''}>جهة خارجية</option>
              </select>
            </label>
            <label style="font-weight:700">اسم الجهة / المؤسسة<input name="orgName" value="${esc(row.orgName || '')}" ${isLeader ? 'readonly' : ''} style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box"/></label>
            <label style="font-weight:700">القسم / مكان العمل<input name="department" value="${esc(row.department || row.workplace || '')}" style="width:100%;margin-top:6px;padding:9px 11px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box"/></label>
          `)}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
            <button type="button" class="btn" id="sa-cancel-edit">إغلاق</button>
            <p id="sa-edit-msg" style="margin:0;font-weight:700"></p>
          </div>
        </form>`;
      wrap.querySelector('#sa-cancel-edit')?.addEventListener('click', () => {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      });
      wrap.querySelector('#sa-edit-form')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const msg = wrap.querySelector('#sa-edit-msg');
        try {
          await api(`/api/admin/staff/${encodeURIComponent(row.email)}`, {
            method: 'PATCH',
            body: {
              name: fd.get('name'),
              phone: fd.get('phone'),
              affiliationKind: fd.get('affiliationKind') || row.affiliationKind,
              orgName: fd.get('orgName'),
              department: fd.get('department'),
            },
          });
          msg.style.color = '#166534';
          msg.textContent = 'تم حفظ التعديلات.';
          toast?.(msg.textContent);
          await reload();
        } catch (err) {
          msg.style.color = '#991b1b';
          msg.textContent = err.message;
        }
      });
    }

    function showView(row) {
      const wrap = el.querySelector('#sa-form-wrap');
      if (!wrap || !row) return;
      wrap.classList.remove('hidden');
      const perms = Array.isArray(row.permissions) ? row.permissions : [];
      wrap.innerHTML = `
        <h4 style="margin:0 0 10px">بيانات الإداري</h4>
        <dl style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin:0 0 14px">
          <div><dt style="color:#64748b;font-size:12px">الاسم</dt><dd style="margin:2px 0 0;font-weight:700">${esc(dash(row.name))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">البريد</dt><dd style="margin:2px 0 0" dir="ltr">${esc(dash(row.email))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">رقم الموظف</dt><dd style="margin:2px 0 0" dir="ltr">${esc(dash(row.employeeNo))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">رقم الحساب</dt><dd style="margin:2px 0 0" dir="ltr">${esc(dash(row.accountId))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">الجوال</dt><dd style="margin:2px 0 0" dir="ltr">${esc(dash(row.phone))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">جهة العمل</dt><dd style="margin:2px 0 0">${esc(row.affiliationLabel || 'غير مسجل')}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">المؤسسة</dt><dd style="margin:2px 0 0">${esc(dash(row.orgName))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">القسم</dt><dd style="margin:2px 0 0">${esc(dash(row.department || row.workplace))}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">الدور</dt><dd style="margin:2px 0 0">${esc(row.roleLabel || 'غير مسجل')}</dd></div>
          <div><dt style="color:#64748b;font-size:12px">الحالة</dt><dd style="margin:2px 0 0">${esc(row.statusLabel)}</dd></div>
          <div style="grid-column:1/-1"><dt style="color:#64748b;font-size:12px">الصلاحيات</dt><dd style="margin:2px 0 0">${esc(row.permissions == null ? 'كامل (قائد أعلى)' : perms.length ? perms.map(permLabel).join(' · ') : 'لا صلاحيات')}</dd></div>
        </dl>
        <button type="button" class="btn" id="sa-close-view">إغلاق</button>`;
      wrap.querySelector('#sa-close-view')?.addEventListener('click', () => {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
      });
    }

    async function handleRow(act, email) {
      try {
        const row = allStaff.find((s) => s.email === email);
        if (act === 'view') return showView(row);
        if (act === 'edit') return showEditForm(row);
        if (act === 'disable') {
          if (!confirm('إيقاف هذا الإداري؟ لن يتمكن من استخدام الجلسات الحالية.')) return;
          await api(`/api/admin/staff/${encodeURIComponent(email)}/disable`, { method: 'POST', body: {} });
          toast?.('تم إيقاف الإداري.');
          await reload();
        } else if (act === 'enable') {
          await api(`/api/admin/staff/${encodeURIComponent(email)}/enable`, { method: 'POST', body: {} });
          toast?.('تم إعادة تفعيل الإداري.');
          await reload();
        } else if (act === 'revoke') {
          if (!confirm('إلغاء التكليف الإداري مع الحفاظ على السجل؟')) return;
          await api(`/api/admin/staff/${encodeURIComponent(email)}/revoke`, { method: 'POST', body: {} });
          toast?.('تم إلغاء التكليف.');
          await reload();
        } else if (act === 'perms') {
          const wrap = el.querySelector('#sa-form-wrap');
          wrap.classList.remove('hidden');
          wrap.innerHTML = `
            <h4 style="margin-top:0">صلاحيات: ${esc(row?.name || email)}</h4>
            <form id="sa-perm-form">
              <div style="max-height:240px;overflow:auto;margin-bottom:12px">${permChecks(row?.permissions || [])}</div>
              <button type="submit" class="btn btn-primary">حفظ الصلاحيات</button>
              <button type="button" class="btn" id="sa-cancel-perm">إلغاء</button>
              <p id="sa-perm-msg" style="font-weight:700"></p>
            </form>`;
          wrap.querySelector('#sa-cancel-perm')?.addEventListener('click', () => {
            wrap.classList.add('hidden');
          });
          wrap.querySelector('#sa-perm-form')?.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const permissions = [...ev.target.querySelectorAll('input[name=perm]:checked')].map((i) => i.value);
            try {
              await api(`/api/admin/staff/${encodeURIComponent(email)}/permissions`, {
                method: 'POST',
                body: { permissions },
              });
              toast?.('تم تحديث الصلاحيات.');
              await reload();
            } catch (err) {
              wrap.querySelector('#sa-perm-msg').textContent = err.message;
            }
          });
        }
      } catch (err) {
        toast?.(err.message);
      }
    }

    async function loadAudit() {
      const box = el.querySelector('#sa-audit');
      if (!box) return;
      try {
        const data = await api('/api/admin/staff/audit');
        const rows = data.audit || [];
        const ACTION_AR = {
          ADMIN_CREATED: 'إنشاء إداري',
          ADMIN_UPDATED: 'تحديث بيانات',
          ADMIN_DISABLED: 'إيقاف',
          ADMIN_ENABLED: 'إعادة تفعيل',
          ADMIN_PERMISSIONS_UPDATED: 'تحديث صلاحيات',
          ADMIN_ROLE_CHANGED: 'تغيير دور',
          ADMIN_ASSIGNMENT_REVOKED: 'إلغاء تكليف',
          PROFILE_UPDATED: 'تحديث ملف شخصي',
          SUPER_ADMIN_BOOTSTRAP: 'تهيئة القائد الأعلى',
        };
        box.innerHTML = rows.length
          ? `<ul style="padding:0;list-style:none;margin:0">${rows
              .slice(0, 50)
              .map(
                (r) =>
                  `<li style="padding:8px 0;border-bottom:1px solid #f0f0f0"><strong>${esc(ACTION_AR[r.action] || r.action)}</strong> · ${esc(r.actorEmail || '')} → ${esc(r.targetEmail || '')} · <small>${esc(fmtDate(r.at))}</small>${r.detail ? ' · ' + esc(r.detail) : ''}</li>`
              )
              .join('')}</ul>`
          : '<p>لا سجلات بعد.</p>';
      } catch (err) {
        box.textContent = err.message;
      }
    }

    try {
      await reload();
    } catch (err) {
      el.innerHTML = `<p style="color:#991b1b">${esc(err.message)}</p>`;
    }
  }

  window.HubStaffAdmin = { mountAccount, mountStaffAdmin };
})();
