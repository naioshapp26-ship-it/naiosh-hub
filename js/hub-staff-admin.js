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
      el.innerHTML = `
        <div class="panel-card" style="max-width:640px">
          <h3 style="margin-top:0">حسابي</h3>
          <dl class="hto-staff-dl" style="display:grid;gap:8px;margin:12px 0 20px">
            <div><dt>الاسم</dt><dd>${esc(a.name)}</dd></div>
            <div><dt>البريد الإلكتروني</dt><dd dir="ltr">${esc(a.email)}</dd></div>
            <div><dt>رقم الموظف</dt><dd dir="ltr">${esc(a.employeeNo || '—')}</dd></div>
            <div><dt>الدور</dt><dd>${esc(a.role)}</dd></div>
            <div><dt>الحالة</dt><dd>${esc(a.status)}</dd></div>
            <div><dt>مكان العمل</dt><dd>${esc(a.workplace || '—')}</dd></div>
          </dl>
          ${a.mustChangePassword ? '<p class="alert alert-warn" style="color:#991b1b;font-weight:700">يُفضَّل تغيير كلمة المرور الأولية قبل الإطلاق العام.</p>' : ''}
          <h4>الأمان وكلمة المرور</h4>
          <form id="sa-pwd-form" class="cp-form" style="display:grid;gap:10px;max-width:420px">
            <label>كلمة المرور الحالية<input type="password" name="currentPassword" required autocomplete="current-password" class="form-control" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <label>كلمة المرور الجديدة<input type="password" name="newPassword" required minlength="8" autocomplete="new-password" class="form-control" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <label>تأكيد كلمة المرور الجديدة<input type="password" name="confirmPassword" required minlength="8" autocomplete="new-password" class="form-control" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px"></label>
            <button type="submit" class="btn btn-primary">حفظ</button>
            <p id="sa-pwd-msg" style="margin:0;font-weight:700"></p>
          </form>
        </div>`;
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

  async function mountStaffAdmin(el, { toast } = {}) {
    if (!el) return;
    el.innerHTML = '<p class="text-muted">جاري التحميل…</p>';
    let catalog = [];
    let roles = [];

    async function reload() {
      const data = await api('/api/admin/staff');
      catalog = data.permissionCatalog || [];
      roles = data.roles || [];
      const staff = data.staff || [];
      el.innerHTML = `
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            <div>
              <h3 style="margin:0">إدارة الإداريين</h3>
              <p style="margin:4px 0 0;color:#666">تعيين موظفين بصلاحيات حقيقية عبر Employee ID.</p>
            </div>
            <button type="button" class="btn btn-primary" id="sa-add-btn">+ إضافة إداري</button>
          </div>
          <div id="sa-form-wrap" class="hidden" style="border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:18px;background:#fafafa"></div>
          <div style="overflow:auto">
            <table class="table" style="width:100%;border-collapse:collapse">
              <thead><tr>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #eee">الموظف</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #eee">البريد</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #eee">الدور</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #eee">الحالة</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid #eee">إجراءات</th>
              </tr></thead>
              <tbody>
                ${staff
                  .map(
                    (s) => `<tr data-email="${esc(s.email)}">
                  <td style="padding:8px;border-bottom:1px solid #f3f3f3"><strong>${esc(s.name)}</strong><br><small dir="ltr">${esc(s.employeeNo)}</small></td>
                  <td style="padding:8px;border-bottom:1px solid #f3f3f3" dir="ltr">${esc(s.email)}</td>
                  <td style="padding:8px;border-bottom:1px solid #f3f3f3">${esc(s.role)}</td>
                  <td style="padding:8px;border-bottom:1px solid #f3f3f3">${s.active ? 'نشط' : 'موقوف'}</td>
                  <td style="padding:8px;border-bottom:1px solid #f3f3f3;display:flex;gap:6px;flex-wrap:wrap">
                    <button type="button" class="btn btn-sm" data-act="perms" data-email="${esc(s.email)}">الصلاحيات</button>
                    ${
                      s.active
                        ? `<button type="button" class="btn btn-sm" data-act="disable" data-email="${esc(s.email)}">إيقاف</button>`
                        : `<button type="button" class="btn btn-sm" data-act="enable" data-email="${esc(s.email)}">تفعيل</button>`
                    }
                  </td>
                </tr>`
                  )
                  .join('') || '<tr><td colspan="5" style="padding:16px">لا يوجد إداريون بعد.</td></tr>'}
              </tbody>
            </table>
          </div>
          <details style="margin-top:18px">
            <summary style="cursor:pointer;font-weight:700">سجل التدقيق</summary>
            <div id="sa-audit" style="margin-top:10px;font-size:13px;color:#444">جاري التحميل…</div>
          </details>
        </div>`;

      el.querySelector('#sa-add-btn')?.addEventListener('click', () => showAddForm());
      el.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => handleRow(btn.dataset.act, btn.dataset.email));
      });
      loadAudit();
    }

    function permChecks(selected) {
      const set = new Set(selected || []);
      return catalog
        .map(
          (p) =>
            `<label style="display:inline-flex;gap:6px;align-items:center;margin:4px 8px 4px 0;font-size:13px"><input type="checkbox" name="perm" value="${esc(p)}" ${set.has(p) ? 'checked' : ''}/> ${esc(p)}</label>`
        )
        .join('');
    }

    function showAddForm() {
      const wrap = el.querySelector('#sa-form-wrap');
      if (!wrap) return;
      wrap.classList.remove('hidden');
      wrap.innerHTML = `
        <h4 style="margin-top:0">إضافة إداري جديد</h4>
        <form id="sa-add-form" style="display:grid;gap:10px;max-width:720px">
          <input name="name" required placeholder="الاسم" style="padding:8px;border:1px solid #ddd;border-radius:8px"/>
          <input name="email" type="email" required placeholder="البريد" dir="ltr" style="padding:8px;border:1px solid #ddd;border-radius:8px"/>
          <input name="phone" placeholder="الهاتف" dir="ltr" style="padding:8px;border:1px solid #ddd;border-radius:8px"/>
          <input name="workplace" placeholder="مكان العمل" style="padding:8px;border:1px solid #ddd;border-radius:8px"/>
          <select name="role" style="padding:8px;border:1px solid #ddd;border-radius:8px">
            ${roles
              .filter((r) => r.code !== 'supreme_leader')
              .map((r) => `<option value="${esc(r.code)}">${esc(r.label)}</option>`)
              .join('')}
          </select>
          <input name="temporaryPassword" type="password" required minlength="8" placeholder="كلمة مرور مؤقتة (سيُطلب تغييرها)" autocomplete="new-password" style="padding:8px;border:1px solid #ddd;border-radius:8px"/>
          <fieldset style="border:1px solid #eee;border-radius:8px;padding:10px">
            <legend>الصلاحيات</legend>
            <div style="max-height:180px;overflow:auto">${permChecks([])}</div>
          </fieldset>
          <div style="display:flex;gap:8px">
            <button type="submit" class="btn btn-primary">إنشاء</button>
            <button type="button" class="btn" id="sa-cancel-add">إلغاء</button>
          </div>
          <p id="sa-add-msg" style="margin:0;font-weight:700"></p>
        </form>`;
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
              workplace: fd.get('workplace'),
              role: fd.get('role'),
              temporaryPassword: fd.get('temporaryPassword'),
              permissions,
            },
          });
          msg.style.color = '#166534';
          msg.textContent = `${result.message || 'تم الإنشاء'} — ${result.staff?.employeeNo || ''}`;
          toast?.(msg.textContent);
          setTimeout(() => reload().catch(() => {}), 600);
        } catch (err) {
          msg.style.color = '#991b1b';
          msg.textContent = err.message;
          toast?.(err.message);
        }
      });
    }

    async function handleRow(act, email) {
      try {
        if (act === 'disable') {
          await api(`/api/admin/staff/${encodeURIComponent(email)}/disable`, { method: 'POST', body: {} });
          toast?.('تم تعطيل الحساب.');
          await reload();
        } else if (act === 'enable') {
          await api(`/api/admin/staff/${encodeURIComponent(email)}/enable`, { method: 'POST', body: {} });
          toast?.('تم إعادة التفعيل.');
          await reload();
        } else if (act === 'perms') {
          const data = await api('/api/admin/staff');
          const row = (data.staff || []).find((s) => s.email === email);
          const wrap = el.querySelector('#sa-form-wrap');
          wrap.classList.remove('hidden');
          wrap.innerHTML = `
            <h4 style="margin-top:0">صلاحيات: ${esc(email)}</h4>
            <form id="sa-perm-form">
              <div style="max-height:220px;overflow:auto;margin-bottom:12px">${permChecks(row?.permissions || [])}</div>
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
        box.innerHTML = rows.length
          ? `<ul style="padding:0;list-style:none;margin:0">${rows
              .slice(0, 40)
              .map(
                (r) =>
                  `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0"><strong>${esc(r.action)}</strong> · ${esc(r.actorEmail || '')} → ${esc(r.targetEmail || '')} · <small>${esc(r.at)}</small>${r.detail ? ' · ' + esc(r.detail) : ''}</li>`
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
