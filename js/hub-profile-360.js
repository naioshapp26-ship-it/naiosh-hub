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

  function renderValue(v, opts) {
    opts = opts || {};
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
            var num = item.number && item.number !== item.id ? item.number : item.id || '';
            var subParts = [item.status, item.assignee ? 'مسؤول: ' + item.assignee : '', item.createdAt || item.plan || ''].filter(
              Boolean
            );
            var linkHref = opts.admin ? item.adminHref || item.href : item.href;
            var opsHtml = '';
            if (opts.admin && opts.canOps && item.kind && item.id) {
              opsHtml =
                '<div class="p360-ops">' +
                '<button type="button" class="p360-btn p360-btn-sm" data-p360-ops="refer" data-kind="' +
                esc(item.kind) +
                '" data-id="' +
                esc(item.id) +
                '">إحالة</button>' +
                '<button type="button" class="p360-btn p360-btn-sm" data-p360-ops="open" data-kind="' +
                esc(item.kind) +
                '" data-id="' +
                esc(item.id) +
                '">متابعة</button>' +
                '<button type="button" class="p360-btn p360-btn-sm" data-p360-ops="close" data-kind="' +
                esc(item.kind) +
                '" data-id="' +
                esc(item.id) +
                '">إغلاق</button>' +
                '</div>';
            }
            return (
              '<li class="p360-tx-row">' +
              '<span><strong>' +
              esc(title) +
              '</strong>' +
              (num ? ' <small dir="ltr">#' + esc(String(num)) + '</small>' : '') +
              (item.total != null || item.amount != null
                ? ' · ' + esc(String(item.total != null ? item.total : item.amount))
                : '') +
              (linkHref
                ? ' · <a class="p360-tx-link" href="' + esc(linkHref) + '" target="_blank" rel="noopener">فتح السجل</a>'
                : '') +
              '</span><small>' +
              esc(subParts.join(' · ')) +
              '</small>' +
              opsHtml +
              '</li>'
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

  function sectionCards(persona, sections, opts) {
    opts = opts || {};
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
    var txOpts = { admin: !!opts.adminEmail, canOps: !!opts.canOps };
    function push(title, val, useTx) {
      blocks.push(
        '<div class="p360-card" data-p360-section="' +
          esc(title) +
          '"><h3>' +
          esc(title) +
          '</h3>' +
          renderValue(val, useTx ? txOpts : {}) +
          '</div>'
      );
    }
    if (persona === 'client') {
      if (s.basics) {
        push('البيانات الأساسية', {
          الاسم: s.basics.fullName || '—',
          البريد: s.basics.email || '—',
          الجوال: s.basics.phone || '—',
          'رقم الحساب': s.basics.accountNo || '—',
          'رقم العميل': s.basics.customerId || '—',
          الشركة: s.basics.company || '—',
          المدينة: s.basics.city || '—',
          الدولة: s.basics.country || '—',
          الحالة: s.basics.status || '—',
        });
      }
      if (s.adminSummary && opts.adminEmail) {
        push('ملخص إداري للمتابعة', {
          'إجمالي المعاملات': s.adminSummary.total,
          المفتوح: s.adminSummary.open,
          المتأخر: s.adminSummary.overdue,
          المغلق: s.adminSummary.closed,
          'يحتاج متابعة': s.adminSummary.needsFollowUp,
        });
        push('مشكلات تحتاج متابعة', s.needsFollowUp, true);
      }
      push('الطلبات والمعاملات', s.orders, true);
      push('طلبات الخدمة', s.serviceRequests, true);
      push('الحجوزات', s.bookings, true);
      push(
        'الشكاوى والدعم',
        (function () {
          var a = Array.isArray(s.complaints) ? s.complaints : [];
          var b = Array.isArray(s.tickets) ? s.tickets : [];
          var all = a.concat(b);
          return all.length ? all : EMPTY;
        })(),
        true
      );
      push('الاشتراكات', s.subscriptions, true);
      push('المرفقات', s.attachments);
      push('الأنظمة المشتركة', s.systems);
      push('الفواتير', s.invoices, true);
      push('المحفظة', s.wallet);
      push('الإشعارات', s.notifications);
      push('سجل النشاط', s.activity);
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
    var showAll = opts.showAllPersonas === true || (opts.showAllPersonas !== false && activePersonas.length > 1 && !opts.adminEmail);
    // Admin dossier: always surface every active persona block (client + employee…)
    if (opts.adminEmail) showAll = true;
    if (showAll && activePersonas.length) {
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
          sectionCards(p.type, data.sections || {}, opts) +
          '</div></div>';
      });
    } else {
      sectionsHtml = '<div class="p360-grid">' + sectionCards(persona || 'client', data.sections || {}, opts) + '</div>';
    }
    // If admin and no personas listed yet, still show client section when available
    if (opts.adminEmail && !sectionsHtml && data.sections && data.sections.client) {
      sectionsHtml = '<div class="p360-grid">' + sectionCards('client', data.sections, opts) + '</div>';
    }

    var kpisAdmin = [];
    if (opts.adminEmail && data.sections && data.sections.client && data.sections.client.adminSummary) {
      var sm = data.sections.client.adminSummary;
      kpisAdmin = [
        { label: 'المعاملات', value: sm.total },
        { label: 'مفتوح', value: sm.open },
        { label: 'متأخر', value: sm.overdue },
        { label: 'يحتاج متابعة', value: sm.needsFollowUp },
      ];
    }
    var kpisFinal = kpisAdmin.length ? kpisAdmin : kpis;

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
      '<p class="p360-eyebrow">' +
      (opts.adminEmail ? 'ملف الشخص 360 · إدارة' : 'ملفي الشخصي 360') +
      '</p>' +
      '<h1>' +
      esc(header.fullName || '—') +
      '</h1>' +
      '<p class="p360-title">' +
      esc(header.accountType || header.personaLabel || header.title || '') +
      (header.department ? ' · ' + esc(header.department) : '') +
      (header.role ? ' · ' + esc(header.role) : '') +
      '</p>' +
      '<div class="p360-meta-grid">' +
      '<div><span>رقم الحساب</span><strong dir="ltr">' +
      esc(header.accountNo || '—') +
      '</strong></div>' +
      '<div><span>رقم العميل</span><strong dir="ltr">' +
      esc(header.customerId || (persona === 'client' ? header.roleRef : '') || '—') +
      '</strong></div>' +
      '<div><span>رقم الموظف</span><strong dir="ltr">' +
      esc(header.employeeNo || '—') +
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
      '</div>' +
      (header.canEdit
        ? '<div id="p360-edit-panel" class="p360-card p360-inline-panel" hidden>' +
          '<h2>تعديل البيانات الشخصية</h2>' +
          '<p class="p360-panel-hint">يمكنك تعديل بياناتك الظاهرة للعميل. رقم الحساب ورقم العميل غير قابلين للتعديل.</p>' +
          '<form class="p360-form" id="p360-edit-form" novalidate>' +
          '<label>الاسم الكامل<input name="fullName" value="' +
          esc(header.fullName || '') +
          '" required autocomplete="name" /></label>' +
          '<label>رقم الجوال<input name="phone" value="' +
          esc(header.phone || '') +
          '" dir="ltr" inputmode="tel" autocomplete="tel" /></label>' +
          '<label>الدولة<input name="country" value="' +
          esc(header.country || '') +
          '" autocomplete="country-name" /></label>' +
          '<label>المدينة<input name="city" value="' +
          esc(header.city || '') +
          '" autocomplete="address-level2" /></label>' +
          '<label>البريد الإلكتروني (تسجيل الدخول)<input name="email" type="email" value="' +
          esc(header.email || '') +
          '" dir="ltr" autocomplete="email" /></label>' +
          '<label class="p360-confirm-pass" id="p360-email-confirm-wrap" hidden>كلمة المرور الحالية لتأكيد تغيير البريد' +
          '<input type="password" name="confirmCurrentPassword" autocomplete="current-password" /></label>' +
          '<p class="p360-panel-hint">لتغيير البريد المرتبط بتسجيل الدخول يلزم إدخال كلمة المرور الحالية للتحقق من ملكية الحساب.</p>' +
          '<div class="p360-form-actions">' +
          '<button type="submit" class="p360-btn p360-btn-primary" id="p360-edit-save">حفظ التغييرات</button>' +
          '<button type="button" class="p360-btn" id="p360-edit-cancel">إلغاء</button>' +
          '</div>' +
          '<p class="p360-form-msg" id="p360-edit-msg" hidden></p>' +
          '</form></div>'
        : '') +
      (header.isOwner
        ? '<div id="p360-pass-panel" class="p360-card p360-inline-panel" hidden>' +
          '<h2>تغيير كلمة المرور</h2>' +
          '<p class="p360-panel-hint">يُقبل الأرقام أو الحروف. الكلمات القصيرة ضعيفة — يُفضّل كلمة أطول وأقوى.</p>' +
          '<form class="p360-form" id="p360-pass-form" novalidate>' +
          '<label>كلمة المرور الحالية<input type="password" name="currentPassword" required autocomplete="current-password" /></label>' +
          '<label>كلمة المرور الجديدة<input type="password" name="newPassword" required autocomplete="new-password" id="p360-new-pass" /></label>' +
          '<label>تأكيد كلمة المرور الجديدة<input type="password" name="confirmPassword" required autocomplete="new-password" /></label>' +
          '<p class="p360-panel-hint" id="p360-pass-strength" aria-live="polite"></p>' +
          '<div class="p360-form-actions">' +
          '<button type="submit" class="p360-btn p360-btn-primary">حفظ كلمة المرور</button>' +
          '<button type="button" class="p360-btn" id="p360-pass-cancel">إلغاء</button>' +
          '</div>' +
          '<p class="p360-form-msg" id="p360-pass-msg" hidden></p>' +
          '</form></div>'
        : '') +
      '</section>' +
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
      kpisFinal
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
        ? '<div style="margin-top:10px" data-p360-attach-host></div>' +
          '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="p360-btn" id="p360-doc-btn"><i class="fas fa-paperclip"></i> رفع مرفق سريع</button>' +
          '<input type="file" id="p360-doc-file" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" multiple hidden />' +
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
      '</div></div>';

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

    function showPanel(panel) {
      if (!panel) return;
      panel.hidden = false;
      try {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        panel.scrollIntoView(true);
      }
      var first = panel.querySelector('input:not([type="hidden"]):not([disabled])');
      if (first) {
        setTimeout(function () {
          try {
            first.focus();
          } catch (e2) {
            /* ignore */
          }
        }, 200);
      }
    }

    function setFormMsg(id, text, kind) {
      var el = root.querySelector(id);
      if (!el) return;
      if (!text) {
        el.hidden = true;
        el.textContent = '';
        el.className = 'p360-form-msg';
        return;
      }
      el.hidden = false;
      el.textContent = text;
      el.className = 'p360-form-msg' + (kind ? ' is-' + kind : '');
    }

    var editBtn = root.querySelector('#p360-edit-btn');
    var editPanel = root.querySelector('#p360-edit-panel');
    var passBtn = root.querySelector('#p360-pass-btn');
    var passPanel = root.querySelector('#p360-pass-panel');
    if (editBtn && editPanel) {
      editBtn.addEventListener('click', function () {
        var opening = editPanel.hidden;
        if (passPanel) passPanel.hidden = true;
        if (opening) showPanel(editPanel);
        else editPanel.hidden = true;
      });
    }
    if (passBtn && passPanel) {
      passBtn.addEventListener('click', function () {
        var opening = passPanel.hidden;
        if (editPanel) editPanel.hidden = true;
        if (opening) showPanel(passPanel);
        else passPanel.hidden = true;
      });
    }
    var editCancel = root.querySelector('#p360-edit-cancel');
    if (editCancel && editPanel) {
      editCancel.addEventListener('click', function () {
        editPanel.hidden = true;
        setFormMsg('#p360-edit-msg', '');
      });
    }
    var passCancel = root.querySelector('#p360-pass-cancel');
    if (passCancel && passPanel) {
      passCancel.addEventListener('click', function () {
        passPanel.hidden = true;
        setFormMsg('#p360-pass-msg', '');
      });
    }

    var form = root.querySelector('#p360-edit-form');
    if (form) {
      var emailInput = form.querySelector('[name="email"]');
      var emailWrap = root.querySelector('#p360-email-confirm-wrap');
      var originalEmail = String(header.email || '').toLowerCase();
      function syncEmailConfirm() {
        if (!emailInput || !emailWrap) return;
        var next = String(emailInput.value || '')
          .trim()
          .toLowerCase();
        emailWrap.hidden = !next || next === originalEmail;
      }
      if (emailInput) {
        emailInput.addEventListener('input', syncEmailConfirm);
        syncEmailConfirm();
      }
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setFormMsg('#p360-edit-msg', '');
        var fd = new FormData(form);
        var fullName = String(fd.get('fullName') || '').trim();
        var phone = String(fd.get('phone') || '').trim();
        var city = String(fd.get('city') || '').trim();
        var country = String(fd.get('country') || '').trim();
        var email = String(fd.get('email') || '')
          .trim()
          .toLowerCase();
        var confirmCurrentPassword = String(fd.get('confirmCurrentPassword') || '');
        if (!fullName || fullName.length < 2) {
          setFormMsg('#p360-edit-msg', 'الاسم الكامل مطلوب (حرفان على الأقل).', 'error');
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setFormMsg('#p360-edit-msg', 'صيغة البريد الإلكتروني غير صحيحة.', 'error');
          return;
        }
        var emailChanged = !!email && email !== originalEmail;
        if (emailChanged && !confirmCurrentPassword) {
          setFormMsg('#p360-edit-msg', 'أدخل كلمة المرور الحالية لتأكيد تغيير البريد الإلكتروني.', 'error');
          if (emailWrap) emailWrap.hidden = false;
          return;
        }
        var body = { fullName: fullName, phone: phone, city: city, country: country };
        if (emailChanged) {
          body.email = email;
          body.confirmCurrentPassword = confirmCurrentPassword;
        }
        var saveBtn = root.querySelector('#p360-edit-save');
        if (saveBtn) saveBtn.disabled = true;
        try {
          if (opts.adminEmail) {
            await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail), {
              method: 'PATCH',
              body: body,
            });
            var v = await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail));
            toast('تم حفظ البيانات بنجاح', 'ok');
            renderPage(root, v, opts);
          } else {
            var patchRes = await api('/api/hub/profiles/me', { method: 'PATCH', body: body });
            if (patchRes.token) {
              try {
                localStorage.setItem('hubAuthToken', patchRes.token);
                sessionStorage.setItem('hubAuthToken', patchRes.token);
              } catch (eTok) {
                /* ignore */
              }
            }
            var me2 = await api('/api/hub/profiles/me');
            try {
              var hu = JSON.parse(localStorage.getItem('hubUser') || '{}');
              if (hu && typeof hu === 'object') {
                hu.name = me2.header?.fullName || fullName;
                hu.fullName = me2.header?.fullName || fullName;
                if (me2.header?.email) hu.email = me2.header.email;
                localStorage.setItem('hubUser', JSON.stringify(hu));
              }
            } catch (e3) {
              /* ignore */
            }
            try {
              window.dispatchEvent(
                new CustomEvent('hub-profile-updated', {
                  detail: { header: me2.header },
                })
              );
            } catch (e4) {
              /* ignore */
            }
            toast('تم حفظ البيانات بنجاح', 'ok');
            renderPage(root, me2, opts);
          }
        } catch (e) {
          setFormMsg('#p360-edit-msg', e.message || 'فشل حفظ البيانات. لم تُفقد قيم النموذج — صحّح ثم أعد المحاولة.', 'error');
          toast(e.message || 'فشل الحفظ', 'error');
        } finally {
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }

    var passForm = root.querySelector('#p360-pass-form');
    if (passForm) {
      var newPass = passForm.querySelector('[name="newPassword"]');
      var strength = root.querySelector('#p360-pass-strength');
      if (newPass && strength) {
        newPass.addEventListener('input', function () {
          var v = String(newPass.value || '');
          if (!v) {
            strength.textContent = '';
            return;
          }
          if (v.length < 6) strength.textContent = 'تنبيه: كلمة المرور قصيرة — يُفضّل 6 أحرف/أرقام فأكثر.';
          else if (v.length < 10) strength.textContent = 'مقبولة. يمكنك جعلها أطول لتقوية الحماية.';
          else strength.textContent = 'كلمة مرور جيدة الطول.';
        });
      }
      passForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        setFormMsg('#p360-pass-msg', '');
        var fd = new FormData(passForm);
        var currentPassword = String(fd.get('currentPassword') || '');
        var newPassword = String(fd.get('newPassword') || '');
        var confirmPassword = String(fd.get('confirmPassword') || '');
        if (!currentPassword || !newPassword) {
          setFormMsg('#p360-pass-msg', 'كلمة المرور الحالية والجديدة مطلوبتان.', 'error');
          return;
        }
        if (newPassword !== confirmPassword) {
          setFormMsg('#p360-pass-msg', 'تأكيد كلمة المرور غير متطابق.', 'error');
          return;
        }
        try {
          var res = await api('/api/hub/profiles/me/password', {
            method: 'POST',
            body: { currentPassword: currentPassword, newPassword: newPassword, confirmPassword: confirmPassword },
          });
          if (res.token) {
            try {
              localStorage.setItem('hubAuthToken', res.token);
              sessionStorage.setItem('hubAuthToken', res.token);
            } catch (e5) {
              /* ignore */
            }
          }
          passForm.reset();
          if (strength) strength.textContent = '';
          setFormMsg('#p360-pass-msg', 'تم تغيير كلمة المرور بنجاح. سجّل الدخول لاحقًا بالكلمة الجديدة.', 'ok');
          toast('تم تغيير كلمة المرور بنجاح', 'ok');
          if (passPanel) {
            setTimeout(function () {
              passPanel.hidden = true;
            }, 1600);
          }
        } catch (e) {
          setFormMsg('#p360-pass-msg', e.message || 'فشل تغيير كلمة المرور.', 'error');
          toast(e.message || 'فشل تغيير كلمة المرور', 'error');
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

    var attachHost = root.querySelector('[data-p360-attach-host]');
    if (attachHost && window.HubFormAttachments && HubFormAttachments.mount) {
      HubFormAttachments.mount(attachHost, { title: 'رفع مرفقات الملف 360', multi: true, showLink: false });
      var saveAttBtn = document.createElement('button');
      saveAttBtn.type = 'button';
      saveAttBtn.className = 'p360-btn';
      saveAttBtn.style.marginTop = '8px';
      saveAttBtn.innerHTML = '<i class="fas fa-save"></i> حفظ المرفقات في الملف';
      attachHost.appendChild(saveAttBtn);
      saveAttBtn.addEventListener('click', async function () {
        try {
          var collected = HubFormAttachments.collect(attachHost) || { items: [] };
          if (!collected.items.length) return toast('اختر مرفقًا أولًا');
          for (var i = 0; i < collected.items.length; i++) {
            var it = collected.items[i];
            var docPath = opts.adminEmail
              ? '/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail) + '/documents'
              : '/api/hub/profiles/me/documents';
            await api(docPath, {
              method: 'POST',
              body: {
                name: it.name,
                url: it.url,
                mime: it.mime,
                kind: it.kind || 'file',
                persona: header.activePersona || '',
              },
            });
          }
          var entityId = (data.header && (data.header.accountNo || data.header.email)) || '';
          if (entityId) {
            await HubFormAttachments.softPersistToEntity({
              entityType: 'identity',
              entityId: entityId,
              ownerEmail: (data.header && data.header.email) || '',
              items: collected.items,
            });
          }
          HubFormAttachments.reset(attachHost);
          var reloadPath = opts.adminEmail
            ? '/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail)
            : '/api/hub/profiles/me';
          renderPage(root, await api(reloadPath), opts);
          toast('تم حفظ المرفقات');
        } catch (e) {
          toast(e.message || 'فشل حفظ المرفقات');
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
        var files = Array.prototype.slice.call(docFile.files || []);
        if (!files.length) return;
        try {
          var docPath = opts.adminEmail
            ? '/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail) + '/documents'
            : '/api/hub/profiles/me/documents';
          for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var up = await uploadFile(file);
            var url = up.url || up.path || up.publicUrl;
            var kind = file.type.indexOf('image/') === 0 ? 'image' : file.type.indexOf('video/') === 0 ? 'video' : 'file';
            await api(docPath, {
              method: 'POST',
              body: {
                name: file.name,
                url: url,
                mime: file.type,
                kind: kind,
                persona: header.activePersona || '',
              },
            });
          }
          var reloadPath = opts.adminEmail
            ? '/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail)
            : '/api/hub/profiles/me';
          renderPage(root, await api(reloadPath), opts);
          toast(files.length > 1 ? 'تم إرفاق ' + files.length + ' ملفات' : 'تم إرفاق الملف');
        } catch (e) {
          toast(e.message || 'فشل رفع المرفق');
        }
      });
    }

    // Admin operational actions on linked transactions
    if (opts.adminEmail) {
      root.querySelectorAll('[data-p360-ops]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            btn.disabled = true;
            await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail) + '/ops', {
              method: 'POST',
              body: {
                action: btn.getAttribute('data-p360-ops'),
                kind: btn.getAttribute('data-kind'),
                id: btn.getAttribute('data-id'),
              },
            });
            toast('تم تحديث المعاملة', 'ok');
            renderPage(root, await api('/api/hub/profiles/by-email/' + encodeURIComponent(opts.adminEmail)), opts);
          } catch (e) {
            toast(e.message || 'فشل الإجراء', 'error');
          } finally {
            btn.disabled = false;
          }
        });
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
    var pageOffset = 0;
    var pageLimit = 40;
    var lastQuery = '';
    el.innerHTML =
      '<div id="p360-admin-detail" class="p360-admin-detail" hidden></div>' +
      '<div id="p360-admin-list" class="p360-card" style="margin-bottom:12px">' +
      '<h2 style="margin:0 0 6px">إدارة الملفات الشخصية 360</h2>' +
      '<p style="margin:0 0 12px;color:var(--p360-muted);font-weight:700;font-size:13px">اضغط «عرض» لفتح ملف الشخص الكامل فوق القائمة — معاملات · دعم · حجوزات · ملخص متابعة · إجراءات</p>' +
      '<form id="p360-admin-search" class="p360-form" style="grid-template-columns:1fr auto;display:grid;gap:8px">' +
      '<input name="q" placeholder="الاسم · البريد · ACC- · CL- · EMP-" />' +
      '<button class="p360-btn p360-btn-primary" type="submit">بحث</button></form>' +
      '<p id="p360-admin-count" style="margin:10px 0 0;font-size:13px;font-weight:700;color:var(--p360-muted)"></p>' +
      '<div style="overflow:auto;margin-top:12px"><table class="p360-admin-table"><thead><tr>' +
      '<th>الاسم</th><th>الحساب / العميل</th><th>الصفات</th><th></th></tr></thead><tbody id="p360-admin-rows"></tbody></table></div>' +
      '<div id="p360-admin-pager" class="p360-pager" style="margin-top:10px;display:flex;gap:8px;align-items:center"></div></div>';

    function showList() {
      selectedEmail = '';
      var detail = el.querySelector('#p360-admin-detail');
      var list = el.querySelector('#p360-admin-list');
      if (detail) {
        detail.hidden = true;
        detail.innerHTML = '';
      }
      if (list) list.hidden = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      loadList(lastQuery, pageOffset).catch(function () {});
    }

    async function openProfile(email) {
      selectedEmail = email;
      var detail = el.querySelector('#p360-admin-detail');
      var list = el.querySelector('#p360-admin-list');
      if (list) list.hidden = true;
      detail.hidden = false;
      detail.innerHTML =
        '<div class="p360-card p360-admin-dossier-bar">' +
        '<button type="button" class="p360-btn p360-btn-primary" id="p360-back-list"><i class="fas fa-arrow-right"></i> رجوع للقائمة</button>' +
        '<div class="p360-empty" style="margin:12px 0 0">جاري تحميل ملف <span dir="ltr">' +
        esc(email) +
        '</span>…</div></div>';
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e0) {
        /* ignore */
      }
      detail.querySelector('#p360-back-list').addEventListener('click', showList);

      try {
        var view = await api('/api/hub/profiles/by-email/' + encodeURIComponent(email));
        if (!view || !view.ok) throw new Error((view && view.error) || 'تعذّر تحميل الملف');
        var summary = view.sections && view.sections.client && view.sections.client.adminSummary;
        detail.innerHTML =
          '<div class="p360-card p360-admin-dossier-bar" style="margin-bottom:12px">' +
          '<div class="p360-dossier-toolbar">' +
          '<button type="button" class="p360-btn p360-btn-primary" id="p360-back-list"><i class="fas fa-arrow-right"></i> رجوع للقائمة</button>' +
          '<strong class="p360-dossier-title">ملف الشخص 360</strong>' +
          '</div>' +
          '<p style="margin:10px 0 0;font-weight:800">' +
          esc(view.header?.fullName || email) +
          ' · <span dir="ltr">' +
          esc(email) +
          '</span></p>' +
          '<p style="margin:6px 0 0;font-weight:700;color:var(--p360-muted)" dir="ltr">' +
          esc(view.header?.accountNo || '') +
          (view.header?.customerId ? ' · CL ' + esc(view.header.customerId) : '') +
          (view.header?.employeeNo ? ' · EMP ' + esc(view.header.employeeNo) : '') +
          '</p>' +
          (summary
            ? '<div class="p360-kpis" style="margin-top:12px">' +
              [
                ['المعاملات', summary.total],
                ['مفتوح', summary.open],
                ['متأخر', summary.overdue],
                ['متابعة', summary.needsFollowUp],
              ]
                .map(function (k) {
                  return (
                    '<article class="p360-kpi"><span>' +
                    esc(k[0]) +
                    '</span><strong>' +
                    esc(String(k[1])) +
                    '</strong></article>'
                  );
                })
                .join('') +
              '</div>'
            : '') +
          '<form id="p360-admin-attach" class="p360-form" style="grid-template-columns:1fr 1fr auto;display:grid;gap:8px;margin-top:12px">' +
          '<select name="type"><option value="trainee">متدرب</option><option value="trainer">مدرب</option><option value="freelancer">مستقل</option><option value="member">عضو</option><option value="client">عميل</option><option value="employee">موظف (يتطلب رقم موظف معتمد)</option></select>' +
          '<input name="employeeNo" placeholder="رقم الموظف إن لزم EMP-...." />' +
          '<button class="p360-btn p360-btn-primary" type="submit">ربط صفة لهذا الحساب</button></form>' +
          '<div id="p360-admin-audit" style="margin-top:10px"></div></div>' +
          '<div id="p360-admin-dossier"></div>';
        detail.querySelector('#p360-back-list').addEventListener('click', showList);
        var wrap = detail.querySelector('#p360-admin-dossier');
        renderPage(wrap, view, {
          adminEmail: email,
          showAllPersonas: true,
          canOps: !!(view.header && (view.header.canOps || view.header.canEdit)),
        });
        if (helpers.toast) helpers.toast('تم فتح ملف ' + (view.header?.fullName || email));
        try {
          var audit = await api('/api/hub/profiles/by-email/' + encodeURIComponent(email) + '/audit');
          el.querySelector('#p360-admin-audit').innerHTML =
            '<h4>سجل التغييرات</h4>' +
            renderValue(
              (audit.items || []).map(function (a) {
                return { name: a.action, status: (a.by || '') + ' · ' + (a.at || '') };
              })
            );
        } catch (auditErr) {
          el.querySelector('#p360-admin-audit').innerHTML =
            '<p class="p360-empty">تعذّر تحميل سجل التغييرات: ' + esc(auditErr.message || '') + '</p>';
        }
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
          } catch (err) {
            if (helpers.toast) helpers.toast(err.message);
            else alert(err.message);
          }
        });
      } catch (err) {
        detail.innerHTML =
          '<div class="p360-card">' +
          '<button type="button" class="p360-btn p360-btn-primary" id="p360-back-list"><i class="fas fa-arrow-right"></i> رجوع للقائمة</button>' +
          '<div class="p360-empty" style="border-color:#b91c1c;color:#b91c1c;margin-top:12px">' +
          '<strong>تعذّر فتح الملف</strong><br>' +
          esc(err.message || 'خطأ غير معروف') +
          (err.status ? ' <small>(HTTP ' + err.status + ')</small>' : '') +
          '</div></div>';
        detail.querySelector('#p360-back-list').addEventListener('click', showList);
        if (helpers.toast) helpers.toast(err.message || 'تعذّر فتح الملف');
      }
    }

    async function loadList(q, offset) {
      lastQuery = q || '';
      pageOffset = Math.max(0, Number(offset) || 0);
      var data = await api(
        '/api/hub/profiles?q=' +
          encodeURIComponent(lastQuery) +
          '&limit=' +
          pageLimit +
          '&offset=' +
          pageOffset
      );
      var tbody = el.querySelector('#p360-admin-rows');
      var count = el.querySelector('#p360-admin-count');
      var total = data.total != null ? data.total : (data.items || []).length;
      if (count) {
        count.textContent =
          'عدد النتائج: ' +
          total +
          (data.synced ? ' (مزامنة من الحسابات الحقيقية)' : '') +
          ' · عرض ' +
          (pageOffset + 1) +
          '–' +
          Math.min(pageOffset + pageLimit, total);
      }
      tbody.innerHTML =
        (data.items || [])
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
              (p.customerId ? '<br><small>CL ' + esc(p.customerId) + '</small>' : '') +
              (p.employeeNo ? '<br><small>EMP ' + esc(p.employeeNo) + '</small>' : '') +
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
          openProfile(btn.dataset.open);
        });
      });
      var pager = el.querySelector('#p360-admin-pager');
      if (pager) {
        var hasPrev = pageOffset > 0;
        var hasNext = pageOffset + pageLimit < total;
        pager.innerHTML =
          '<button type="button" class="p360-btn" id="p360-prev" ' +
          (hasPrev ? '' : 'disabled') +
          '>السابق</button>' +
          '<button type="button" class="p360-btn" id="p360-next" ' +
          (hasNext ? '' : 'disabled') +
          '>التالي</button>';
        var prev = pager.querySelector('#p360-prev');
        var next = pager.querySelector('#p360-next');
        if (prev) {
          prev.addEventListener('click', function () {
            loadList(lastQuery, Math.max(0, pageOffset - pageLimit)).catch(function (e) {
              if (helpers.toast) helpers.toast(e.message);
            });
          });
        }
        if (next) {
          next.addEventListener('click', function () {
            loadList(lastQuery, pageOffset + pageLimit).catch(function (e) {
              if (helpers.toast) helpers.toast(e.message);
            });
          });
        }
      }
    }

    el.querySelector('#p360-admin-search').addEventListener('submit', function (ev) {
      ev.preventDefault();
      loadList(new FormData(ev.target).get('q'), 0).catch(function (e) {
        if (helpers.toast) helpers.toast(e.message);
      });
    });
    loadList('', 0).catch(function (e) {
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
