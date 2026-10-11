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

  function toast(msg, kind) {
    var el = document.getElementById('p360-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'p360-toast';
      el.className = 'p360-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg || '';
    el.classList.remove('is-error', 'is-ok', 'show');
    if (kind === 'error') el.classList.add('is-error');
    if (kind === 'ok') el.classList.add('is-ok');
    el.classList.add('show');
    // Also surface in client portal toast when embedded
    try {
      if (window.HubClientPortal?.toast) window.HubClientPortal.toast(msg);
      else {
        var cp = document.getElementById('cp-toast');
        if (cp) {
          cp.textContent = msg || '';
          cp.classList.add('show');
          setTimeout(function () {
            cp.classList.remove('show');
          }, 2600);
        }
      }
    } catch (e) {
      /* ignore */
    }
    setTimeout(function () {
      el.classList.remove('show');
    }, 2800);
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

  function avatarSrc(header) {
    var url = header.avatarUrl || '';
    if (!url) return '';
    // Cache-bust when server did not already add ?v=
    if (url.indexOf('?') === -1 && header.avatarUpdatedAt) {
      return url + '?v=' + encodeURIComponent(String(header.avatarUpdatedAt));
    }
    return url;
  }

  function avatarHtml(header) {
    var src = avatarSrc(header);
    if (src) {
      return (
        '<div class="p360-avatar" data-has-photo="1">' +
        '<img src="' +
        esc(src) +
        '" alt="الصورة الشخصية" loading="eager" decoding="async" />' +
        '</div>'
      );
    }
    var initial = (header.fullName || header.email || '؟').trim().charAt(0);
    return '<div class="p360-avatar" aria-hidden="true" data-has-photo="0">' + esc(initial) + '</div>';
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
      push('الإشعارات', s.notifications);
      push('النشاط', s.activity);
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
    var activePersonas = (header.personas || []).filter(function (p) {
      return p.status === 'active';
    });
    var sectionsHtml = '';
    if (opts.showAllPersonas !== false && activePersonas.length > 1 && !opts.adminEmail) {
      activePersonas.forEach(function (p) {
        sectionsHtml +=
          '<div class="p360-persona-block" data-persona-block="' +
          esc(p.type) +
          '">' +
          '<h2 class="p360-section-title">' +
          esc(p.label || LABELS[p.type] || p.type) +
          (p.type === persona ? ' · الحالي' : '') +
          '</h2>' +
          '<div class="p360-grid">' +
          sectionCards(p.type, data.sections || {}) +
          '</div></div>';
      });
    } else {
      sectionsHtml = '<div class="p360-grid">' + sectionCards(persona, data.sections || {}) + '</div>';
    }

    root.innerHTML =
      '<section class="p360-hero">' +
      '<div class="p360-avatar-wrap">' +
      avatarHtml(header) +
      (header.canEdit
        ? '<button type="button" class="p360-avatar-edit" id="p360-avatar-btn" title="تغيير الصورة الشخصية" aria-label="تغيير الصورة الشخصية"><i class="fas fa-camera"></i></button>'
        : '') +
      '<input type="file" id="p360-avatar-file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden data-hub-skip-limit />' +
      '<div class="p360-avatar-status" id="p360-avatar-status" hidden></div>' +
      '</div>' +
      '<div class="p360-identity">' +
      '<p class="p360-eyebrow">ملفي الشخصي 360</p>' +
      '<h1>' +
      esc(header.fullName || '—') +
      '</h1>' +
      '<p class="p360-title">' +
      esc(header.accountType || header.personaLabel || header.title || '') +
      (header.department ? ' · ' + esc(header.department) : '') +
      '</p>' +
      '<div class="p360-meta-grid">' +
      '<div><span>رقم الحساب</span><strong dir="ltr">' +
      esc(header.accountNo || '—') +
      '</strong></div>' +
      '<div><span>رقم العميل</span><strong dir="ltr">' +
      esc(header.customerId || (persona === 'client' ? header.roleRef : '') || '—') +
      '</strong></div>' +
      '<div><span>رقم الجوال</span><strong dir="ltr">' +
      esc(header.phone || '—') +
      '</strong></div>' +
      '<div><span>البريد الإلكتروني</span><strong dir="ltr">' +
      esc(header.email || '—') +
      '</strong></div>' +
      '<div><span>الدولة</span><strong>' +
      esc(header.country || '—') +
      '</strong></div>' +
      '<div><span>المدينة</span><strong>' +
      esc(header.city || '—') +
      '</strong></div>' +
      '<div><span>المعرّف حسب الصفة</span><strong dir="ltr">' +
      esc(header.roleRef || '—') +
      '</strong></div>' +
      '<div><span>حالة الحساب</span><strong><span class="p360-status">' +
      esc(header.status || 'active') +
      '</span></strong></div>' +
      '</div></div>' +
      '<div class="p360-hero-actions">' +
      (header.canEdit
        ? '<button type="button" class="p360-btn p360-btn-primary" id="p360-edit-btn"><i class="fas fa-pen"></i> تعديل البيانات</button>'
        : '') +
      (header.isOwner
        ? '<button type="button" class="p360-btn" id="p360-pass-btn"><i class="fas fa-key"></i> كلمة المرور</button>'
        : '') +
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
      sectionsHtml +
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
      '<h2>تعديل البيانات الشخصية</h2>' +
      '<form class="p360-form" id="p360-edit-form">' +
      '<label>الاسم الكامل<input name="fullName" value="' +
      esc(header.fullName || '') +
      '" required /></label>' +
      '<label>رقم الجوال<input name="phone" value="' +
      esc(header.phone || '') +
      '" dir="ltr" /></label>' +
      '<label>الدولة<input name="country" value="' +
      esc(header.country || '') +
      '" /></label>' +
      '<label>المدينة<input name="city" value="' +
      esc(header.city || '') +
      '" /></label>' +
      '<label>المسمى / الصفة<input name="title" value="' +
      esc(header.title || '') +
      '" /></label>' +
      '<label>القسم / الجهة<input name="department" value="' +
      esc(header.department || '') +
      '" /></label>' +
      '<button type="submit" class="p360-btn p360-btn-primary">حفظ التغييرات</button>' +
      '</form></div>' +
      (header.isOwner
        ? '<div id="p360-pass-panel" hidden style="margin-top:12px" class="p360-card">' +
          '<h2>تغيير كلمة المرور</h2>' +
          '<form class="p360-form" id="p360-pass-form">' +
          '<label>كلمة المرور الحالية<input type="password" name="currentPassword" required autocomplete="current-password" /></label>' +
          '<label>كلمة المرور الجديدة<input type="password" name="newPassword" required autocomplete="new-password" /></label>' +
          '<label>تأكيد كلمة المرور<input type="password" name="confirmPassword" required autocomplete="new-password" /></label>' +
          '<button type="submit" class="p360-btn p360-btn-primary">حفظ كلمة المرور</button>' +
          '</form></div>'
        : '');

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
        var pp = root.querySelector('#p360-pass-panel');
        if (pp) pp.hidden = true;
      });
    }
    var passBtn = root.querySelector('#p360-pass-btn');
    var passPanel = root.querySelector('#p360-pass-panel');
    if (passBtn && passPanel) {
      passBtn.addEventListener('click', function () {
        passPanel.hidden = !passPanel.hidden;
        if (editPanel) editPanel.hidden = true;
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
          city: fd.get('city'),
          country: fd.get('country'),
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
    var passForm = root.querySelector('#p360-pass-form');
    if (passForm) {
      passForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(passForm);
        try {
          await api('/api/hub/profiles/me/password', {
            method: 'POST',
            body: {
              currentPassword: fd.get('currentPassword'),
              newPassword: fd.get('newPassword'),
              confirmPassword: fd.get('confirmPassword'),
            },
          });
          passForm.reset();
          toast('تم تغيير كلمة المرور بنجاح');
        } catch (e) {
          toast(e.message || 'فشل تغيير كلمة المرور');
        }
      });
    }

    async function uploadFile(file) {
      if (!window.HubUploadLimits || !window.HubUploadLimits.uploadFile) {
        throw new Error('نظام الرفع غير متاح');
      }
      return window.HubUploadLimits.uploadFile(file, {
        token: token(),
        headers: authHeaders(),
      });
    }

    function setAvatarStatus(text, kind) {
      var st = root.querySelector('#p360-avatar-status');
      if (!st) return;
      if (!text) {
        st.hidden = true;
        st.textContent = '';
        st.className = 'p360-avatar-status';
        return;
      }
      st.hidden = false;
      st.textContent = text;
      st.className = 'p360-avatar-status' + (kind ? ' is-' + kind : '');
    }

    function previewAvatarLocal(file) {
      var wrap = root.querySelector('.p360-avatar');
      if (!wrap || !file) return null;
      var url = URL.createObjectURL(file);
      wrap.setAttribute('data-has-photo', '1');
      wrap.innerHTML = '<img src="' + url + '" alt="معاينة الصورة" />';
      return url;
    }

    async function uploadAvatarDurable(file, onProgress) {
      var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      var type = String(file.type || '').toLowerCase();
      var name = String(file.name || '').toLowerCase();
      var okExt = /\.(jpe?g|png|webp)$/i.test(name);
      if (type && allowed.indexOf(type) === -1 && !okExt) {
        throw new Error('يُسمح فقط بصور JPG أو PNG أو WEBP');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('حجم الصورة أكبر من 5 ميجابايت — صغّرها ثم أعد المحاولة');
      }
      var endpoint = opts.adminEmail
        ? '/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail) + '/avatar'
        : '/api/hub/profiles/me/avatar';
      return await new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint);
        xhr.responseType = 'json';
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'avatar.jpg'));
        xhr.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
        var h = authHeaders();
        Object.keys(h).forEach(function (k) {
          if (h[k] != null && h[k] !== '') xhr.setRequestHeader(k, String(h[k]));
        });
        xhr.upload.onprogress = function (ev) {
          if (!onProgress || !ev.lengthComputable) return;
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = function () {
          var data = xhr.response && typeof xhr.response === 'object' ? xhr.response : null;
          if (xhr.status >= 200 && xhr.status < 300 && data && data.ok && (data.avatarUrl || data.url)) {
            resolve(data);
            return;
          }
          reject(new Error((data && data.error) || 'فشل رفع الصورة الشخصية'));
        };
        xhr.onerror = function () {
          reject(new Error('تعذر الاتصال بخادم رفع الصور'));
        };
        xhr.send(file);
      });
    }

    var avBtn = root.querySelector('#p360-avatar-btn');
    var avFile = root.querySelector('#p360-avatar-file');
    if (avBtn && avFile) {
      avBtn.addEventListener('click', function () {
        avFile.value = '';
        avFile.click();
      });
      avFile.addEventListener('change', async function () {
        var file = avFile.files && avFile.files[0];
        if (!file) return;
        var previewUrl = null;
        try {
          previewUrl = previewAvatarLocal(file);
          setAvatarStatus('جاري رفع الصورة… 0%', 'progress');
          avBtn.disabled = true;
          var up = await uploadAvatarDurable(file, function (pct) {
            setAvatarStatus('جاري رفع الصورة… ' + pct + '%', 'progress');
          });
          var url = up.avatarUrl || up.url;
          if (!url) throw new Error('لم يُرجع الخادم رابط الصورة');
          setAvatarStatus('تم حفظ الصورة بنجاح', 'ok');
          toast('تم حفظ الصورة الشخصية بنجاح', 'ok');
          if (opts.adminEmail) {
            renderPage(root, await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail)), opts);
          } else {
            renderPage(root, await api('/api/hub/profiles/me'), opts);
          }
          try {
            window.dispatchEvent(new CustomEvent('hub-profile-avatar-updated', { detail: { avatarUrl: url } }));
          } catch (e2) {
            /* ignore */
          }
        } catch (e) {
          setAvatarStatus(e.message || 'فشل رفع الصورة', 'error');
          toast(e.message || 'فشل رفع الصورة', 'error');
        } finally {
          avBtn.disabled = false;
          if (previewUrl) {
            try {
              URL.revokeObjectURL(previewUrl);
            } catch (e3) {
              /* ignore */
            }
          }
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

  async function bootOwnerPage(mountEl) {
    if (!token()) {
      location.replace('login.html?next=' + encodeURIComponent(location.pathname + location.search + location.hash));
      return;
    }
    var root = mountEl || document.getElementById('p360-root');
    if (!root) return;
    try {
      var data = await api('/api/hub/profiles/me');
      renderPage(root, data, { showAllPersonas: true });
    } catch (e) {
      root.innerHTML = '<div class="p360-card"><div class="p360-empty">' + esc(e.message || 'تعذّر التحميل') + '</div></div>';
      if (e.status === 401) {
        location.replace('login.html?next=' + encodeURIComponent(location.pathname + location.hash));
      }
    }
  }

  async function mountAdmin(el, helpers) {
    if (!el) return;
    helpers = helpers || {};
    var selectedEmail = '';
    el.innerHTML =
      '<div class="p360-card" style="margin-bottom:12px">' +
      '<h2 style="margin:0 0 6px">إدارة الملفات الشخصية 360</h2>' +
      '<p style="margin:0 0 12px;color:var(--p360-muted);font-weight:700;font-size:13px">عرض الحسابات الحقيقية من قاعدة الهوية — بحث بالاسم والبريد ورقم الحساب ورقم العميل ورقم الموظف</p>' +
      '<form id="p360-admin-search" class="p360-form" style="grid-template-columns:1fr auto;display:grid;gap:8px">' +
      '<input name="q" placeholder="الاسم · البريد · ACC- · CL- · EMP-" />' +
      '<button class="p360-btn p360-btn-primary" type="submit">بحث</button></form>' +
      '<p id="p360-admin-count" style="margin:10px 0 0;font-size:13px;font-weight:700;color:var(--p360-muted)"></p>' +
      '<div style="overflow:auto;margin-top:12px"><table class="p360-admin-table"><thead><tr>' +
      '<th>الاسم</th><th>الحساب / العميل</th><th>الصفات</th><th></th></tr></thead><tbody id="p360-admin-rows"></tbody></table></div></div>' +
      '<div id="p360-admin-detail"></div>';

    async function openProfile(email) {
      selectedEmail = email;
      var detail = el.querySelector('#p360-admin-detail');
      var view = await api('/api/hub/profiles/by-email/' + encodeURIComponent(email));
      detail.innerHTML =
        '<div class="p360-card" style="margin-bottom:12px">' +
        '<h3 style="margin:0 0 8px">الحساب المحدد</h3>' +
        '<p style="margin:0 0 12px;font-weight:800">' +
        esc(view.header?.fullName || email) +
        ' · <span dir="ltr">' +
        esc(email) +
        '</span> · ' +
        esc(view.header?.accountNo || '') +
        (view.header?.customerId ? ' · عميل ' + esc(view.header.customerId) : '') +
        '</p>' +
        '<form id="p360-admin-attach" class="p360-form" style="grid-template-columns:1fr 1fr auto;display:grid;gap:8px">' +
        '<select name="type"><option value="trainee">متدرب</option><option value="trainer">مدرب</option><option value="freelancer">مستقل</option><option value="member">عضو</option><option value="client">عميل</option><option value="employee">موظف (يتطلب رقم موظف معتمد)</option></select>' +
        '<input name="employeeNo" placeholder="رقم الموظف إن لزم EMP-...." />' +
        '<button class="p360-btn p360-btn-primary" type="submit">ربط صفة لهذا الحساب</button></form>' +
        '<div id="p360-admin-audit" style="margin-top:10px"></div></div>';
      var wrap = document.createElement('div');
      detail.appendChild(wrap);
      renderPage(wrap, view, { adminEmail: email, showAllPersonas: false });
      var audit = await api('/api/hub/profiles/by-email/' + encodeURIComponent(email) + '/audit');
      el.querySelector('#p360-admin-audit').innerHTML =
        '<h4>سجل التغييرات</h4>' +
        renderValue(
          (audit.items || []).map(function (a) {
            return { name: a.action, status: (a.by || '') + ' · ' + (a.at || '') };
          })
        );
      el.querySelector('#p360-admin-attach').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        if (!selectedEmail) {
          if (helpers.toast) helpers.toast('اختر حسابًا أولًا عبر عرض');
          return;
        }
        var fd = new FormData(ev.target);
        var type = String(fd.get('type'));
        var refs = {};
        if (type === 'employee') refs.employeeNo = String(fd.get('employeeNo') || '').trim();
        try {
          await api('/api/hub/profiles/by-email/' + encodeURIComponent(selectedEmail) + '/persona', {
            method: 'POST',
            body: { type: type, refs: refs },
          });
          if (helpers.toast) helpers.toast('تم ربط صفة ' + (LABELS[type] || type) + ' بالحساب المحدد');
          await openProfile(selectedEmail);
          await loadList(el.querySelector('#p360-admin-search [name=q]')?.value || '');
        } catch (err) {
          if (helpers.toast) helpers.toast(err.message);
          else alert(err.message);
        }
      });
    }

    async function loadList(q) {
      var data = await api('/api/hub/profiles?q=' + encodeURIComponent(q || '') + '&limit=100');
      var tbody = el.querySelector('#p360-admin-rows');
      var count = el.querySelector('#p360-admin-count');
      if (count) count.textContent = 'عدد النتائج: ' + (data.items || []).length + (data.synced ? ' (مزامنة من الحسابات الحقيقية)' : '');
      tbody.innerHTML = (data.items || [])
        .map(function (p) {
          return (
            '<tr class="' +
            (selectedEmail === p.email ? 'is-selected' : '') +
            '"><td>' +
            esc(p.fullName) +
            '<br><small dir="ltr">' +
            esc(p.email) +
            '</small></td><td dir="ltr">' +
            esc(p.accountNo) +
            (p.customerId ? '<br><small>عميل ' + esc(p.customerId) + '</small>' : '') +
            (p.employeeNo ? '<br><small>موظف ' + esc(p.employeeNo) + '</small>' : '') +
            '</td><td>' +
            esc(
              (p.personas || [])
                .filter(function (x) {
                  return x.status === 'active';
                })
                .map(function (x) {
                  return x.label;
                })
                .join(' · ') || '—'
            ) +
            '</td><td><button type="button" class="p360-btn" data-open="' +
            esc(p.email) +
            '">عرض</button></td></tr>'
          );
        })
        .join('') || '<tr><td colspan="4"><div class="p360-empty">لا توجد حسابات مطابقة</div></td></tr>';
      tbody.querySelectorAll('[data-open]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openProfile(btn.dataset.open).catch(function (err) {
            if (helpers.toast) helpers.toast(err.message);
          });
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
    mountOwner: bootOwnerPage,
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
