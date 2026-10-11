/**
 * Profile 360 client — owner page + admin mount helper.
 */
(function () {
  'use strict';

  var EMPTY = 'لا توجد بيانات بعد';
  var LABELS = {
    client: 'عميل',
    employee: 'موظف',
    trainee: 'متدرب',
    trainer: 'مدرب',
    freelancer: 'مستقل',
    member: 'عضو',
  };

  function token() {
    return localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken') || '';
  }

  function authHeaders(extra) {
    var h = Object.assign({ Accept: 'application/json' }, extra || {});
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: authHeaders(opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    var j = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var err = new Error(j.error || j.message || 'فشل الطلب');
      err.status = res.status;
      err.payload = j;
      throw err;
    }
    return j;
  }

  function toast(msg) {
    var el = document.getElementById('p360-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () {
      el.classList.remove('show');
    }, 2600);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isEmpty(v) {
    return v === EMPTY || v == null || v === '' || (Array.isArray(v) && !v.length);
  }

  function renderValue(v) {
    if (v && typeof v === 'object' && v.restricted) {
      return '<div class="p360-restricted">' + esc(v.message || 'محجوب') + '</div>';
    }
    if (isEmpty(v)) return '<div class="p360-empty">' + esc(EMPTY) + '</div>';
    if (Array.isArray(v)) {
      return (
        '<ul class="p360-list">' +
        v
          .map(function (item) {
            if (typeof item === 'string') return '<li><span>' + esc(item) + '</span></li>';
            var title = item.name || item.title || item.subject || item.code || item.id || '—';
            var sub = item.status || item.plan || item.createdAt || '';
            return (
              '<li><span>' +
              esc(title) +
              (item.total != null || item.amount != null
                ? ' · ' + esc(String(item.total != null ? item.total : item.amount))
                : '') +
              '</span><small>' +
              esc(sub) +
              '</small></li>'
            );
          })
          .join('') +
        '</ul>'
      );
    }
    if (typeof v === 'object') {
      return (
        '<ul class="p360-list">' +
        Object.keys(v)
          .map(function (k) {
            return '<li><span>' + esc(k) + '</span><small>' + esc(String(v[k])) + '</small></li>';
          })
          .join('') +
        '</ul>'
      );
    }
    return '<div class="p360-empty" style="border-style:solid">' + esc(String(v)) + '</div>';
  }

  function avatarHtml(header) {
    if (header.avatarUrl) {
      return '<div class="p360-avatar"><img src="' + esc(header.avatarUrl) + '" alt="" /></div>';
    }
    var initial = (header.fullName || header.email || '؟').trim().charAt(0);
    return '<div class="p360-avatar" aria-hidden="true">' + esc(initial) + '</div>';
  }

  function kpisFor(persona, sections) {
    var s = sections[persona] || {};
    if (persona === 'client' && s.counts) {
      return [
        { label: 'الأنظمة', value: s.counts.systems },
        { label: 'الطلبات', value: s.counts.orders },
        { label: 'التذاكر', value: s.counts.tickets },
        { label: 'الاشتراكات', value: s.counts.subscriptions },
      ];
    }
    if (persona === 'employee') {
      return [
        { label: 'رقم الموظف', value: s.employeeNo || '—' },
        { label: 'القسم', value: s.department || '—' },
        { label: 'حالة التعيين', value: s.assignmentStatus || '—' },
        { label: 'الصلاحيات', value: s.permissionsCount != null ? s.permissionsCount : '—' },
      ];
    }
    return [
      { label: 'الصفة', value: LABELS[persona] || persona || '—' },
      { label: 'الحالة', value: s.available === false ? 'غير مفعّلة' : 'مفعّلة' },
      { label: 'البيانات', value: s.available === false ? 'بانتظار الربط' : 'من النظام' },
      { label: 'التكامل', value: s.connected === false ? 'غير متصل' : s.connected ? 'متصل' : '—' },
    ];
  }

  function sectionCards(persona, sections) {
    var s = sections[persona] || {};
    if (s.available === false) {
      return (
        '<div class="p360-card"><h2>بيانات ' +
        esc(LABELS[persona] || persona) +
        '</h2><div class="p360-empty">' +
        esc(s.reason || EMPTY) +
        '</div></div>'
      );
    }
    var blocks = [];
    function push(title, val) {
      blocks.push('<div class="p360-card"><h3>' + esc(title) + '</h3>' + renderValue(val) + '</div>');
    }
    if (persona === 'client') {
      push('الأنظمة المشتركة', s.systems);
      push('الطلبات / المشتريات', s.orders);
      push('التذاكر', s.tickets);
      push('طلبات الخدمة', s.serviceRequests);
      push('الاشتراكات', s.subscriptions);
      push('الفواتير', s.invoices);
      push('المحفظة', s.wallet);
    } else if (persona === 'employee') {
      push('البيانات الوظيفية', {
        'رقم الموظف': s.employeeNo || EMPTY,
        'المعرّف': s.naioshId || EMPTY,
        'القسم': s.department || EMPTY,
        'مكان العمل': s.workplace || EMPTY,
        'الجهة': s.orgName || EMPTY,
        'الدور التشغيلي': s.role || EMPTY,
      });
      push('المهام', s.tasks);
      push('الحضور', s.attendance);
      push('الإجازات', s.leaves);
      push('تقييم الأداء', s.performance);
      push('البيانات المالية', s.payroll);
      if (s.note) blocks.push('<div class="p360-card"><p class="p360-empty" style="border-style:solid">' + esc(s.note) + '</p></div>');
    } else if (persona === 'trainee') {
      push('الدورات', s.courses);
      push('نسبة الإنجاز', s.progress);
      push('الجدول', s.schedule);
      push('الاختبارات', s.exams);
      push('الشهادات', s.certificates);
    } else if (persona === 'trainer') {
      push('التخصصات', s.specialties);
      push('الدورات المقدمة', s.courses);
      push('المتدربون', s.trainees);
      push('المواعيد', s.schedule);
      push('التقييمات', s.ratings);
      push('المواد التعليمية', s.materials);
    } else if (persona === 'freelancer') {
      push('التخصص', s.specialty);
      push('المهارات', s.skills);
      push('معرض الأعمال', s.portfolio);
      push('المشاريع', s.projects);
      push('العقود', s.contracts);
      push('المهام', s.tasks);
      push('المستحقات', s.dues);
    } else if (persona === 'member') {
      push('رقم العضوية', s.membershipId);
      push('المستوى', s.tier);
      push('الخدمات', s.services);
      push('الأنظمة', s.systems);
      push('النشاط', s.activity);
      push('الاشتراكات', s.subscriptions);
    }
    return blocks.join('');
  }

  function renderPage(root, data, opts) {
    opts = opts || {};
    var header = data.header || {};
    var persona = header.activePersona || '';
    var kpis = kpisFor(persona, data.sections || {});
    root.innerHTML =
      '<section class="p360-hero">' +
      '<div class="p360-avatar-wrap">' +
      avatarHtml(header) +
      '</div>' +
      '<div class="p360-identity">' +
      '<h1>' +
      esc(header.fullName || '—') +
      '</h1>' +
      '<p class="p360-title">' +
      esc(header.personaLabel || header.title || '') +
      (header.department ? ' · ' + esc(header.department) : '') +
      '</p>' +
      '<div class="p360-meta-grid">' +
      '<div><span>رقم الحساب</span><strong>' +
      esc(header.accountNo || '—') +
      '</strong></div>' +
      '<div><span>المعرّف حسب الصفة</span><strong>' +
      esc(header.roleRef || '—') +
      '</strong></div>' +
      '<div><span>البريد</span><strong>' +
      esc(header.email || '—') +
      '</strong></div>' +
      '<div><span>حالة الحساب</span><strong><span class="p360-status">' +
      esc(header.status || 'active') +
      '</span></strong></div>' +
      '</div></div>' +
      '<div class="p360-hero-actions">' +
      (header.canEdit
        ? '<button type="button" class="p360-btn p360-btn-primary" id="p360-edit-btn"><i class="fas fa-pen"></i> تعديل البيانات</button>'
        : '') +
      (header.canEdit
        ? '<button type="button" class="p360-btn" id="p360-avatar-btn"><i class="fas fa-camera"></i> الصورة</button>'
        : '') +
      '<input type="file" id="p360-avatar-file" accept="image/*" hidden />' +
      '</div></section>' +
      '<div class="p360-persona-switch" role="tablist">' +
      (header.personas || [])
        .map(function (p) {
          return (
            '<button type="button" class="p360-persona-chip' +
            (p.active ? ' is-active' : '') +
            '" data-persona="' +
            esc(p.type) +
            '"' +
            (p.status !== 'active' ? ' disabled' : '') +
            '>' +
            esc(p.label || LABELS[p.type] || p.type) +
            '</button>'
          );
        })
        .join('') +
      (opts.showAddPersona
        ? '<button type="button" class="p360-btn" id="p360-add-persona"><i class="fas fa-plus"></i> إضافة صفة</button>'
        : '') +
      '</div>' +
      '<div class="p360-kpis">' +
      kpis
        .map(function (k) {
          return (
            '<article class="p360-kpi"><span>' +
            esc(k.label) +
            '</span><strong>' +
            esc(String(k.value)) +
            '</strong></article>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="p360-grid">' +
      sectionCards(persona, data.sections || {}) +
      '</div>' +
      '<div style="height:12px"></div>' +
      '<div class="p360-card"><h2>المرفقات</h2>' +
      renderValue(data.documents) +
      (header.canEdit
        ? '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="p360-btn" id="p360-doc-btn"><i class="fas fa-paperclip"></i> رفع مرفق</button>' +
          '<input type="file" id="p360-doc-file" hidden />' +
          '</div>'
        : '') +
      '</div>' +
      '<div style="height:12px"></div>' +
      '<div class="p360-card"><h2>حالة الأنظمة المرتبطة</h2><div class="p360-integrations">' +
      (data.integrations || [])
        .map(function (i) {
          return (
            '<div class="p360-int"><strong>' +
            esc(i.label) +
            '</strong><div class="' +
            (i.connected ? 'ok' : 'off') +
            '">' +
            (i.connected ? 'رابط متاح' : 'غير متصل') +
            '</div><small>' +
            esc(i.note || '') +
            '</small></div>'
          );
        })
        .join('') +
      '</div></div>' +
      '<div id="p360-edit-panel" hidden style="margin-top:12px" class="p360-card">' +
      '<h2>تعديل البيانات المسموح بها</h2>' +
      '<form class="p360-form" id="p360-edit-form">' +
      '<label>الاسم الكامل<input name="fullName" value="' +
      esc(header.fullName || '') +
      '" required /></label>' +
      '<label>الهاتف<input name="phone" value="' +
      esc(header.phone || '') +
      '" /></label>' +
      '<label>المسمى / الصفة<input name="title" value="' +
      esc(header.title || '') +
      '" /></label>' +
      '<label>القسم / الجهة<input name="department" value="' +
      esc(header.department || '') +
      '" /></label>' +
      '<button type="submit" class="p360-btn p360-btn-primary">حفظ</button>' +
      '</form></div>' +
      '<div id="p360-add-panel" hidden style="margin-top:12px" class="p360-card">' +
      '<h2>تفعيل صفة على نفس الحساب</h2>' +
      '<p class="p360-empty" style="border-style:solid;margin-bottom:10px">صفة الموظف لا تُفعَّل ذاتيًا — فقط عبر التعيين الإداري برقم موظف.</p>' +
      '<form class="p360-form" id="p360-add-form">' +
      '<label>الصفة<select name="type">' +
      ['trainee', 'trainer', 'freelancer', 'member', 'client']
        .map(function (t) {
          return '<option value="' + t + '">' + esc(LABELS[t]) + '</option>';
        })
        .join('') +
      '</select></label>' +
      '<label>تخصص / ملاحظة (اختياري)<input name="specialty" placeholder="مثال: تطوير واجهات" /></label>' +
      '<button type="submit" class="p360-btn p360-btn-primary">تفعيل الصفة</button>' +
      '</form></div>';

    bindPage(root, data, opts);
  }

  function bindPage(root, data, opts) {
    var header = data.header || {};
    root.querySelectorAll('[data-persona]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          if (opts.adminEmail) {
            // admin viewing: just reload compose with persona query
            var view = await api(
              '/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail) + '?persona=' + encodeURIComponent(btn.dataset.persona)
            );
            renderPage(root, view, opts);
            return;
          }
          await api('/api/hub/profiles/me/persona', {
            method: 'POST',
            body: { type: btn.dataset.persona, activate: true },
          });
          var me = await api('/api/hub/profiles/me?persona=' + encodeURIComponent(btn.dataset.persona));
          renderPage(root, me, opts);
          toast('تم التبديل إلى ملف ' + (LABELS[btn.dataset.persona] || btn.dataset.persona));
        } catch (e) {
          toast(e.message || 'تعذّر التبديل');
        }
      });
    });

    var editBtn = root.querySelector('#p360-edit-btn');
    var editPanel = root.querySelector('#p360-edit-panel');
    if (editBtn && editPanel) {
      editBtn.addEventListener('click', function () {
        editPanel.hidden = !editPanel.hidden;
      });
    }
    var form = root.querySelector('#p360-edit-form');
    if (form) {
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(form);
        var body = {
          fullName: fd.get('fullName'),
          phone: fd.get('phone'),
          title: fd.get('title'),
          department: fd.get('department'),
        };
        try {
          if (opts.adminEmail) {
            await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail), {
              method: 'PATCH',
              body: body,
            });
            var v = await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail));
            renderPage(root, v, opts);
          } else {
            await api('/api/hub/profiles/me', { method: 'PATCH', body: body });
            var me2 = await api('/api/hub/profiles/me');
            renderPage(root, me2, opts);
          }
          toast('تم حفظ البيانات');
        } catch (e) {
          toast(e.message || 'فشل الحفظ');
        }
      });
    }

    var addBtn = root.querySelector('#p360-add-persona');
    var addPanel = root.querySelector('#p360-add-panel');
    if (addBtn && addPanel) {
      addBtn.addEventListener('click', function () {
        addPanel.hidden = !addPanel.hidden;
      });
    }
    var addForm = root.querySelector('#p360-add-form');
    if (addForm) {
      addForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(addForm);
        var type = String(fd.get('type') || '');
        var specialty = String(fd.get('specialty') || '').trim();
        var meta = {};
        if (specialty) {
          if (type === 'freelancer') meta.specialty = specialty;
          else if (type === 'trainer') meta.specialties = [specialty];
          else if (type === 'member') meta.tier = specialty;
          else meta.note = specialty;
        }
        try {
          await api('/api/hub/profiles/me/persona', { method: 'POST', body: { type: type, meta: meta } });
          if (Object.keys(meta).length) {
            await api('/api/hub/profiles/me/persona/' + encodeURIComponent(type), {
              method: 'PATCH',
              body: { meta: meta },
            });
          }
          var me3 = await api('/api/hub/profiles/me?persona=' + encodeURIComponent(type));
          renderPage(root, me3, opts);
          toast('تم تفعيل صفة ' + (LABELS[type] || type));
        } catch (e) {
          toast(e.message || 'تعذّر التفعيل');
        }
      });
    }

    async function uploadFile(file) {
      if (!window.HubUploadLimits || !window.HubUploadLimits.uploadFile) {
        throw new Error('نظام الرفع غير متاح');
      }
      return window.HubUploadLimits.uploadFile(file, { token: token() });
    }

    var avBtn = root.querySelector('#p360-avatar-btn');
    var avFile = root.querySelector('#p360-avatar-file');
    if (avBtn && avFile) {
      avBtn.addEventListener('click', function () {
        avFile.click();
      });
      avFile.addEventListener('change', async function () {
        var file = avFile.files && avFile.files[0];
        if (!file) return;
        try {
          var up = await uploadFile(file);
          var url = up.url || up.path || up.publicUrl;
          if (!url) throw new Error('لم يُرجع مسار الصورة');
          if (opts.adminEmail) {
            await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail), {
              method: 'PATCH',
              body: { avatarUrl: url },
            });
            renderPage(root, await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail)), opts);
          } else {
            await api('/api/hub/profiles/me', { method: 'PATCH', body: { avatarUrl: url } });
            renderPage(root, await api('/api/hub/profiles/me'), opts);
          }
          toast('تم تحديث الصورة');
        } catch (e) {
          toast(e.message || 'فشل رفع الصورة');
        }
      });
    }

    var docBtn = root.querySelector('#p360-doc-btn');
    var docFile = root.querySelector('#p360-doc-file');
    if (docBtn && docFile) {
      docBtn.addEventListener('click', function () {
        docFile.click();
      });
      docFile.addEventListener('change', async function () {
        var file = docFile.files && docFile.files[0];
        if (!file) return;
        try {
          var up = await uploadFile(file);
          var url = up.url || up.path || up.publicUrl;
          await api('/api/hub/profiles/me/documents', {
            method: 'POST',
            body: {
              name: file.name,
              url: url,
              mime: file.type,
              kind: 'file',
              persona: header.activePersona || '',
            },
          });
          renderPage(root, await api('/api/hub/profiles/me'), opts);
          toast('تم إرفاق الملف');
        } catch (e) {
          toast(e.message || 'فشل رفع المرفق');
        }
      });
    }
  }

  async function bootOwnerPage() {
    if (!token()) {
      location.replace('login.html?next=' + encodeURIComponent('profile-360.html'));
      return;
    }
    var root = document.getElementById('p360-root');
    if (!root) return;
    try {
      var data = await api('/api/hub/profiles/me');
      renderPage(root, data, { showAddPersona: true });
    } catch (e) {
      root.innerHTML = '<div class="p360-card"><div class="p360-empty">' + esc(e.message || 'تعذّر التحميل') + '</div></div>';
      if (e.status === 401) location.replace('login.html?next=' + encodeURIComponent('profile-360.html'));
    }
  }

  async function mountAdmin(el, helpers) {
    if (!el) return;
    helpers = helpers || {};
    el.innerHTML =
      '<div class="p360-card" style="margin-bottom:12px">' +
      '<h2 style="margin:0 0 10px">إدارة الملفات الشخصية 360</h2>' +
      '<form id="p360-admin-search" class="p360-form" style="grid-template-columns:1fr auto;display:grid;gap:8px">' +
      '<input name="q" placeholder="ابحث بالاسم أو البريد أو رقم الحساب" />' +
      '<button class="p360-btn p360-btn-primary" type="submit">بحث</button></form>' +
      '<div style="overflow:auto;margin-top:12px"><table class="p360-admin-table"><thead><tr>' +
      '<th>الاسم</th><th>الحساب</th><th>الصفات</th><th></th></tr></thead><tbody id="p360-admin-rows"></tbody></table></div></div>' +
      '<div id="p360-admin-detail"></div>';

    async function loadList(q) {
      var data = await api('/api/hub/profiles?q=' + encodeURIComponent(q || '') + '&limit=50');
      var tbody = el.querySelector('#p360-admin-rows');
      tbody.innerHTML = (data.items || [])
        .map(function (p) {
          return (
            '<tr><td>' +
            esc(p.fullName) +
            '<br><small>' +
            esc(p.email) +
            '</small></td><td>' +
            esc(p.accountNo) +
            '</td><td>' +
            esc((p.personas || []).map(function (x) { return x.label; }).join(' · ') || '—') +
            '</td><td><button type="button" class="p360-btn" data-open="' +
            esc(p.email) +
            '">عرض</button></td></tr>'
          );
        })
        .join('') || '<tr><td colspan="4"><div class="p360-empty">لا توجد ملفات بعد</div></td></tr>';
      tbody.querySelectorAll('[data-open]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var detail = el.querySelector('#p360-admin-detail');
          try {
            var view = await api('/api/hub/profiles/by-email/' + encodeURIComponent(btn.dataset.open));
            detail.innerHTML = '';
            var wrap = document.createElement('div');
            detail.appendChild(wrap);
            renderPage(wrap, view, { adminEmail: btn.dataset.open, showAddPersona: false });
            detail.insertAdjacentHTML(
              'afterbegin',
              '<div class="p360-card" style="margin-bottom:12px"><h3>إجراءات إدارية</h3>' +
                '<form id="p360-admin-attach" class="p360-form" style="grid-template-columns:1fr 1fr auto;display:grid;gap:8px">' +
                '<select name="type"><option value="trainee">متدرب</option><option value="trainer">مدرب</option><option value="freelancer">مستقل</option><option value="member">عضو</option><option value="client">عميل</option><option value="employee">موظف (يتطلب رقم موظف معتمد)</option></select>' +
                '<input name="employeeNo" placeholder="رقم الموظف إن لزم EMP-...." />' +
                '<button class="p360-btn p360-btn-primary" type="submit">ربط صفة</button></form>' +
                '<div id="p360-admin-audit" style="margin-top:10px"></div></div>'
            );
            var audit = await api('/api/hub/profiles/by-email/' + encodeURIComponent(btn.dataset.open) + '/audit');
            el.querySelector('#p360-admin-audit').innerHTML =
              '<h4>سجل التغييرات</h4>' +
              renderValue(
                (audit.items || []).map(function (a) {
                  return { name: a.action, status: (a.by || '') + ' · ' + (a.at || '') };
                })
              );
            el.querySelector('#p360-admin-attach').addEventListener('submit', async function (ev) {
              ev.preventDefault();
              var fd = new FormData(ev.target);
              var type = String(fd.get('type'));
              var refs = {};
              if (type === 'employee') refs.employeeNo = String(fd.get('employeeNo') || '').trim();
              try {
                await api('/api/hub/profiles/by-email/' + encodeURIComponent(btn.dataset.open) + '/persona', {
                  method: 'POST',
                  body: { type: type, refs: refs },
                });
                if (helpers.toast) helpers.toast('تم ربط الصفة');
                btn.click();
              } catch (err) {
                if (helpers.toast) helpers.toast(err.message);
                else alert(err.message);
              }
            });
          } catch (err) {
            if (helpers.toast) helpers.toast(err.message);
          }
        });
      });
    }

    el.querySelector('#p360-admin-search').addEventListener('submit', function (ev) {
      ev.preventDefault();
      loadList(new FormData(ev.target).get('q'));
    });
    loadList('').catch(function (e) {
      if (helpers.toast) helpers.toast(e.message);
    });
  }

  window.HubProfile360 = {
    api: api,
    bootOwnerPage: bootOwnerPage,
    mountAdmin: mountAdmin,
    renderPage: renderPage,
  };

  if (document.body && document.body.classList.contains('p360-body')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootOwnerPage);
    } else {
      bootOwnerPage();
    }
  }
})();
