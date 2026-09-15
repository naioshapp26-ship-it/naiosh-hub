/**
 * سياسات نايوش هوب — واجهة المكتبة + إضافة/مراجعة/نشر
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-pol-root]');
  if (!root || !window.HubPoliciesStore) return;

  var Store = window.HubPoliciesStore;
  var ui = {
    q: '',
    cat: 'all',
    adminTab: 'published',
    viewId: '',
    formOpen: false,
    form: blankForm(),
    editId: '',
  };

  function blankForm() {
    return {
      title: '',
      cat: 'ops',
      summary: '',
      body: '',
      version: '0.1',
      effectiveAt: '',
      department: '',
      keywords: '',
      status: 'draft',
      fileName: '',
      fileDataUrl: '',
    };
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (window.HubUI && HubUI.toast) HubUI.toast(msg, type || 'info');
    else if (window.HubActions && HubActions.toast) HubActions.toast(msg);
    else
      try {
        alert(msg);
      } catch (e) {}
  }

  function manage() {
    return Store.canManage();
  }

  function requireManage() {
    if (window.HubAuth && HubAuth.requireLogin && !HubAuth.isLoggedIn()) {
      HubAuth.requireLogin({ next: 'policies.html#add' });
      return false;
    }
    if (!manage()) {
      toast('إضافة السياسات متاحة لحسابات الإدارة فقط. سجّل الدخول بحساب مخوّل.', 'info');
      if (window.HubAuth && HubAuth.requireLogin) {
        HubAuth.requireLogin({ next: 'policies.html#add' });
      }
      return false;
    }
    return true;
  }

  function openAddForm() {
    if (!requireManage()) return;
    ui.formOpen = true;
    ui.editId = '';
    ui.form = blankForm();
    ui.viewId = '';
    render();
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-SA');
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }

  function statusCls(s) {
    if (s === 'published') return 'is-pub';
    if (s === 'draft') return 'is-draft';
    if (s === 'pending_review') return 'is-pending';
    if (s === 'needs_changes' || s === 'rejected') return 'is-warn';
    return 'is-arch';
  }

  function publicList() {
    return Store.list({ q: ui.q, cat: ui.cat, status: 'published' });
  }

  function adminList() {
    var status = ui.adminTab === 'all' ? '' : ui.adminTab;
    return Store.list({ q: ui.q, cat: ui.cat, status: status, manage: true });
  }

  function actionsFor(p) {
    var btns = [];
    btns.push('<button type="button" class="info-btn sm primary" data-pol-view="' + esc(p.id) + '">عرض السياسة</button>');
    if (p.fileDataUrl) {
      btns.push(
        '<a class="info-btn sm" href="' +
          esc(p.fileDataUrl) +
          '" download="' +
          esc(p.fileName || p.title + '.pdf') +
          '">تحميل</a>'
      );
    } else {
      btns.push('<button type="button" class="info-btn sm" data-pol-download="' + esc(p.id) + '">تحميل</button>');
    }
    btns.push('<button type="button" class="info-btn sm" data-pol-versions="' + esc(p.id) + '">الإصدارات</button>');
    if (!manage()) return btns.join('');

    if (p.status === 'draft' || p.status === 'needs_changes') {
      btns.push('<button type="button" class="info-btn sm" data-pol-edit="' + esc(p.id) + '">تعديل</button>');
      btns.push('<button type="button" class="info-btn sm" data-pol-submit="' + esc(p.id) + '">إرسال للمراجعة</button>');
      if (!p.seed) btns.push('<button type="button" class="info-btn sm" data-pol-del="' + esc(p.id) + '">حذف</button>');
    } else if (p.status === 'pending_review') {
      btns.push('<button type="button" class="info-btn sm" data-pol-publish="' + esc(p.id) + '">نشر</button>');
      btns.push('<button type="button" class="info-btn sm" data-pol-changes="' + esc(p.id) + '">طلب تعديل</button>');
      btns.push('<button type="button" class="info-btn sm" data-pol-reject="' + esc(p.id) + '">رفض</button>');
    } else if (p.status === 'published') {
      btns.push('<button type="button" class="info-btn sm" data-pol-edit="' + esc(p.id) + '">تعديل</button>');
      btns.push('<button type="button" class="info-btn sm" data-pol-unpublish="' + esc(p.id) + '">إلغاء النشر</button>');
      btns.push('<button type="button" class="info-btn sm" data-pol-archive="' + esc(p.id) + '">أرشفة</button>');
    } else if (p.status === 'archived' || p.status === 'rejected') {
      btns.push('<button type="button" class="info-btn sm" data-pol-edit="' + esc(p.id) + '">تعديل</button>');
    }
    return btns.join('');
  }

  function cardHtml(p) {
    return (
      '<article class="pol-card">' +
      '<div class="pol-card-top">' +
      '<span class="pol-chip">' +
      esc(Store.catLabel(p.cat)) +
      '</span>' +
      '<span class="pol-chip ' +
      statusCls(p.status) +
      '">' +
      esc(Store.statusLabel(p.status)) +
      '</span>' +
      '</div>' +
      '<h3>' +
      esc(p.title) +
      '</h3>' +
      '<p>' +
      esc(p.summary) +
      '</p>' +
      '<div class="pol-meta">' +
      '<span>الإصدار ' +
      esc(p.version || '—') +
      '</span>' +
      '<span>آخر تحديث: ' +
      esc(fmtDate(p.updatedAt)) +
      '</span>' +
      '<span>' +
      esc(p.department || '—') +
      '</span>' +
      '</div>' +
      '<div class="pol-actions">' +
      actionsFor(p) +
      '</div></article>'
    );
  }

  function viewModal() {
    var p = Store.get(ui.viewId);
    if (!p) return '';
    if (!manage() && p.status !== 'published') return '';
    return (
      '<div class="pol-modal-overlay" data-pol-view-overlay>' +
      '<div class="pol-modal wide" role="dialog" aria-modal="true">' +
      '<button type="button" class="info-btn sm ghost" data-pol-close-view>إغلاق</button>' +
      '<div class="pol-card-top" style="margin-top:8px">' +
      '<span class="pol-chip">' +
      esc(Store.catLabel(p.cat)) +
      '</span>' +
      '<span class="pol-chip ' +
      statusCls(p.status) +
      '">' +
      esc(Store.statusLabel(p.status)) +
      '</span>' +
      '</div>' +
      '<h2 style="margin:10px 0 6px;font-weight:900">' +
      esc(p.title) +
      '</h2>' +
      '<div class="pol-meta">' +
      '<span>الإصدار ' +
      esc(p.version) +
      '</span>' +
      '<span>النشر: ' +
      esc(fmtDate(p.publishedAt || p.effectiveAt)) +
      '</span>' +
      '<span>آخر تحديث: ' +
      esc(fmtDate(p.updatedAt)) +
      '</span>' +
      '<span>' +
      esc(p.department || '—') +
      '</span>' +
      '</div>' +
      '<h3 style="margin:18px 0 8px;font-weight:900">محتوى السياسة</h3>' +
      '<div class="pol-body">' +
      esc(p.body).replace(/\n/g, '<br>') +
      '</div>' +
      '<div class="pol-actions" style="margin-top:18px">' +
      (p.fileDataUrl
        ? '<a class="info-btn primary" href="' +
          esc(p.fileDataUrl) +
          '" download="' +
          esc(p.fileName || 'policy.pdf') +
          '">تحميل PDF</a>'
        : '<button type="button" class="info-btn" data-pol-download="' + esc(p.id) + '">تحميل PDF</button>') +
      '<button type="button" class="info-btn" data-pol-versions="' +
      esc(p.id) +
      '">الإصدارات السابقة</button>' +
      (manage()
        ? '<button type="button" class="info-btn" data-pol-edit="' + esc(p.id) + '">تعديل السياسة</button>'
        : '') +
      '</div></div></div>'
    );
  }

  function formModal() {
    if (!ui.formOpen) return '';
    var f = ui.form;
    var opts = Store.CATEGORIES.filter(function (c) {
      return c.id !== 'all';
    })
      .map(function (c) {
        return (
          '<option value="' +
          esc(c.id) +
          '"' +
          (f.cat === c.id ? ' selected' : '') +
          '>' +
          esc(c.label) +
          '</option>'
        );
      })
      .join('');
    var statusOpts = [
      ['draft', 'مسودة'],
      ['pending_review', 'قيد المراجعة'],
      ['published', 'منشورة'],
    ]
      .map(function (s) {
        return (
          '<option value="' +
          s[0] +
          '"' +
          (f.status === s[0] ? ' selected' : '') +
          '>' +
          s[1] +
          '</option>'
        );
      })
      .join('');
    return (
      '<div class="pol-modal-overlay" data-pol-form-overlay>' +
      '<div class="pol-modal wide" role="dialog" aria-modal="true">' +
      '<h3>' +
      (ui.editId ? 'تعديل سياسة' : 'إضافة سياسة جديدة') +
      '</h3>' +
      '<label>اسم السياسة *</label><input data-pol-f="title" value="' +
      esc(f.title) +
      '" placeholder="مثال: سياسة اختبار مركز المعلومات" />' +
      '<label>التصنيف *</label><select data-pol-f="cat">' +
      opts +
      '</select>' +
      '<label>وصف مختصر *</label><textarea data-pol-f="summary" placeholder="ملخص يظهر في بطاقة السياسة">' +
      esc(f.summary) +
      '</textarea>' +
      '<label>محتوى السياسة *</label><textarea data-pol-f="body" style="min-height:160px" placeholder="النص الكامل للسياسة">' +
      esc(f.body) +
      '</textarea>' +
      '<label>رقم الإصدار</label><input data-pol-f="version" value="' +
      esc(f.version) +
      '" placeholder="1.0" />' +
      '<label>تاريخ السريان</label><input type="date" data-pol-f="effectiveAt" value="' +
      esc(f.effectiveAt) +
      '" />' +
      '<label>القسم المسؤول</label><input data-pol-f="department" value="' +
      esc(f.department) +
      '" placeholder="الحوكمة والجودة" />' +
      '<label>الكلمات المفتاحية</label><input data-pol-f="keywords" value="' +
      esc(f.keywords) +
      '" placeholder="خصوصية، بيانات، أمن..." />' +
      '<label>حالة السياسة</label><select data-pol-f="status">' +
      statusOpts +
      '</select>' +
      '<p class="info-lead">الافتراضي «مسودة». النشر المباشر يتطلب صلاحية إدارة — يُفضَّل الحفظ كمسودة ثم الإرسال للمراجعة.</p>' +
      '<label>إرفاق ملف (PDF / DOCX)</label><input type="file" accept=".pdf,.doc,.docx,application/pdf" data-pol-file />' +
      (f.fileName ? '<p class="info-lead">الملف: ' + esc(f.fileName) + '</p>' : '') +
      '<div class="pol-actions">' +
      '<button type="button" class="info-btn ghost" data-pol-close-form>إلغاء</button>' +
      '<button type="button" class="info-btn" data-pol-save-draft>حفظ كمسودة</button>' +
      '<button type="button" class="info-btn primary" data-pol-save-submit>إرسال للمراجعة</button>' +
      '</div></div></div>'
    );
  }

  function render() {
    var list = manage() && ui.adminTab !== 'published' ? adminList() : publicList();
    if (manage() && ui.adminTab === 'published') list = Store.list({ q: ui.q, cat: ui.cat, status: 'published', manage: true });
    if (manage() && ui.adminTab === 'draft') list = Store.list({ q: ui.q, cat: ui.cat, status: 'draft', manage: true });
    if (manage() && ui.adminTab === 'pending_review')
      list = Store.list({ q: ui.q, cat: ui.cat, status: 'pending_review', manage: true });

    var cats = Store.CATEGORIES.map(function (c) {
      return (
        '<button type="button" class="' +
        (ui.cat === c.id ? 'is-on' : '') +
        '" data-pol-cat="' +
        esc(c.id) +
        '">' +
        esc(c.label) +
        '</button>'
      );
    }).join('');

    root.innerHTML =
      '<div data-info-crumbs=\'[{"label":"السياسات"}]\'></div>' +
      '<div data-info-subnav></div>' +
      '<section class="info-hero">' +
      '<h1>سياسات نايوش هوب</h1>' +
      '<p>مركز موحد لعرض وإدارة السياسات والإجراءات المنظمة للعمل داخل نايوش هوب.</p>' +
      '</section>' +
      '<section class="info-section" id="policies-catalog">' +
      '<div class="pol-head-row">' +
      '<div><h2 style="margin:0">مكتبة السياسات</h2>' +
      '<p class="info-lead" style="margin-top:6px">ابحث أو صفِّ حسب التصنيف. المنشور فقط يظهر للعملاء.</p></div>' +
      '<button type="button" class="info-btn primary pol-add-btn" data-pol-add><i class="fas fa-plus"></i> إضافة سياسة جديدة</button>' +
      '</div>' +
      (manage()
        ? '<div class="pol-admin-tabs">' +
          [
            ['published', 'منشورة'],
            ['draft', 'مسودات'],
            ['pending_review', 'قيد المراجعة'],
            ['all', 'الكل (إدارة)'],
          ]
            .map(function (t) {
              return (
                '<button type="button" class="' +
                (ui.adminTab === t[0] ? 'is-on' : '') +
                '" data-pol-admin-tab="' +
                t[0] +
                '">' +
                t[1] +
                '</button>'
              );
            })
            .join('') +
          '</div>'
        : '') +
      '<div class="pol-toolbar">' +
      '<input type="search" data-pol-q value="' +
      esc(ui.q) +
      '" placeholder="ابحث باسم السياسة أو محتواها..." aria-label="بحث السياسات" />' +
      '</div>' +
      '<div class="pol-cats">' +
      cats +
      '</div>' +
      '<div class="pol-list">' +
      (list.length
        ? list.map(cardHtml).join('')
        : '<div class="pol-empty">لا توجد سياسات مطابقة.</div>') +
      '</div></section>' +
      viewModal() +
      formModal();

    if (window.HubInfoCenter) {
      HubInfoCenter.mountNav(root.querySelector('[data-info-subnav]'));
      HubInfoCenter.mountCrumbs(root.querySelector('[data-info-crumbs]'), [
        { label: 'الرئيسية', href: 'index.html' },
        { label: HubInfoCenter.LABEL, href: HubInfoCenter.HOME },
        { label: 'السياسات' },
      ]);
    }
    bind();
  }

  function saveForm(submitReview) {
    if (!requireManage()) return;
    var f = ui.form;
    if (!String(f.title || '').trim() || !String(f.summary || '').trim() || !String(f.body || '').trim() || !String(f.cat || '').trim()) {
      toast('أكمل الحقول المطلوبة: الاسم · التصنيف · الوصف · المحتوى', 'error');
      return;
    }
    var wantedStatus = submitReview ? 'pending_review' : f.status === 'published' ? 'draft' : f.status || 'draft';
    if (submitReview) wantedStatus = 'pending_review';
    else if (!submitReview && f.status === 'pending_review') wantedStatus = 'pending_review';
    else wantedStatus = 'draft';

    var row;
    if (ui.editId) {
      row = Store.update(ui.editId, {
        title: f.title,
        cat: f.cat,
        summary: f.summary,
        body: f.body,
        version: f.version,
        effectiveAt: f.effectiveAt,
        department: f.department,
        keywords: f.keywords,
        fileName: f.fileName,
        fileDataUrl: f.fileDataUrl,
        status: wantedStatus,
      });
    } else {
      row = Store.create({
        title: f.title,
        cat: f.cat,
        summary: f.summary,
        body: f.body,
        version: f.version,
        effectiveAt: f.effectiveAt,
        department: f.department,
        keywords: f.keywords,
        fileName: f.fileName,
        fileDataUrl: f.fileDataUrl,
      });
      if (row && wantedStatus !== 'draft') {
        row = Store.setStatus(row.id, wantedStatus, wantedStatus === 'pending_review' ? 'إرسال للمراجعة' : 'تحديث الحالة');
      }
    }
    if (!row) {
      toast('تعذر الحفظ — تحقق من الصلاحية', 'error');
      return;
    }
    if (f.status === 'published' && manage()) {
      Store.setStatus(row.id, 'published', 'نشر من نموذج الإضافة');
      wantedStatus = 'published';
      row = Store.get(row.id);
    }
    ui.formOpen = false;
    ui.editId = '';
    ui.form = blankForm();
    ui.adminTab = wantedStatus === 'published' ? 'published' : wantedStatus === 'pending_review' ? 'pending_review' : 'draft';
    toast(
      wantedStatus === 'published'
        ? 'تم نشر السياسة'
        : wantedStatus === 'pending_review'
          ? 'تم إرسال السياسة للمراجعة'
          : 'تم حفظ المسودة',
      'success'
    );
    render();
  }

  function downloadText(p) {
    var blob = new Blob([p.title + '\n\n' + p.body], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (p.title || 'policy') + '.txt';
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function bind() {
    root.querySelectorAll('[data-pol-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.cat = btn.getAttribute('data-pol-cat') || 'all';
        render();
      });
    });
    root.querySelectorAll('[data-pol-admin-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.adminTab = btn.getAttribute('data-pol-admin-tab') || 'published';
        render();
      });
    });
    var qEl = root.querySelector('[data-pol-q]');
    if (qEl) {
      qEl.addEventListener('input', function () {
        ui.q = qEl.value;
        render();
        var again = root.querySelector('[data-pol-q]');
        if (again) {
          again.focus();
          try {
            again.setSelectionRange(again.value.length, again.value.length);
          } catch (e) {}
        }
      });
    }
    root.querySelectorAll('[data-pol-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.viewId = btn.getAttribute('data-pol-view') || '';
        render();
      });
    });
    root.querySelectorAll('[data-pol-download]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = Store.get(btn.getAttribute('data-pol-download'));
        if (p) downloadText(p);
      });
    });
    root.querySelectorAll('[data-pol-versions]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = Store.get(btn.getAttribute('data-pol-versions'));
        if (!p) return;
        var lines = (p.versions || [])
          .map(function (v) {
            return (v.version || '—') + ' · ' + fmtDate(v.at) + ' · ' + (v.note || '');
          })
          .join('\n');
        toast(lines || 'لا إصدارات سابقة', 'info');
        try {
          alert((p.title || '') + '\n\n' + (lines || 'لا إصدارات سابقة'));
        } catch (e) {}
      });
    });
    var addBtn = root.querySelector('[data-pol-add]');
    if (addBtn) {
      addBtn.addEventListener('click', openAddForm);
    }
    root.querySelectorAll('[data-pol-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = Store.get(btn.getAttribute('data-pol-edit'));
        if (!p || !requireManage()) return;
        ui.editId = p.id;
        ui.formOpen = true;
        ui.viewId = '';
        ui.form = {
          title: p.title,
          cat: p.cat,
          summary: p.summary,
          body: p.body,
          version: p.version,
          effectiveAt: (p.effectiveAt || '').slice(0, 10),
          department: p.department || '',
          keywords: p.keywords || '',
          status: p.status === 'published' || p.status === 'pending_review' ? p.status : 'draft',
          fileName: p.fileName || '',
          fileDataUrl: p.fileDataUrl || '',
        };
        render();
      });
    });
    root.querySelectorAll('[data-pol-submit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.setStatus(btn.getAttribute('data-pol-submit'), 'pending_review', 'إرسال للمراجعة');
        toast('أُرسلت للمراجعة', 'success');
        ui.adminTab = 'pending_review';
        render();
      });
    });
    root.querySelectorAll('[data-pol-publish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.setStatus(btn.getAttribute('data-pol-publish'), 'published', 'نشر');
        toast('تم النشر', 'success');
        ui.adminTab = 'published';
        render();
      });
    });
    root.querySelectorAll('[data-pol-changes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.setStatus(btn.getAttribute('data-pol-changes'), 'needs_changes', 'طلب تعديل');
        toast('أُعيدت لطلب تعديل', 'info');
        ui.adminTab = 'draft';
        render();
      });
    });
    root.querySelectorAll('[data-pol-reject]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.setStatus(btn.getAttribute('data-pol-reject'), 'rejected', 'رفض');
        toast('رُفضت السياسة', 'info');
        render();
      });
    });
    root.querySelectorAll('[data-pol-unpublish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.setStatus(btn.getAttribute('data-pol-unpublish'), 'draft', 'إلغاء النشر');
        toast('أُلغي النشر', 'info');
        ui.adminTab = 'draft';
        render();
      });
    });
    root.querySelectorAll('[data-pol-archive]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.setStatus(btn.getAttribute('data-pol-archive'), 'archived', 'أرشفة');
        toast('تمت الأرشفة', 'info');
        render();
      });
    });
    root.querySelectorAll('[data-pol-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('حذف المسودة؟')) return;
        Store.remove(btn.getAttribute('data-pol-del'));
        render();
      });
    });

    var viewOv = root.querySelector('[data-pol-view-overlay]');
    if (viewOv) {
      viewOv.addEventListener('click', function (e) {
        if (e.target === viewOv || e.target.closest('[data-pol-close-view]')) {
          ui.viewId = '';
          render();
        }
      });
    }
    var formOv = root.querySelector('[data-pol-form-overlay]');
    if (formOv) {
      formOv.addEventListener('click', function (e) {
        if (e.target === formOv || e.target.closest('[data-pol-close-form]')) {
          ui.formOpen = false;
          ui.editId = '';
          render();
        }
      });
      formOv.querySelectorAll('[data-pol-f]').forEach(function (el) {
        el.addEventListener('input', function () {
          ui.form[el.getAttribute('data-pol-f')] = el.value;
        });
        el.addEventListener('change', function () {
          ui.form[el.getAttribute('data-pol-f')] = el.value;
        });
      });
      var fileEl = formOv.querySelector('[data-pol-file]');
      if (fileEl) {
        fileEl.addEventListener('change', function () {
          var file = fileEl.files && fileEl.files[0];
          if (!file) return;
          if (file.size > 2.5 * 1024 * 1024) {
            toast('الملف كبير — استخدم أقل من 2.5MB', 'error');
            return;
          }
          var reader = new FileReader();
          reader.onload = function () {
            ui.form.fileName = file.name;
            ui.form.fileDataUrl = String(reader.result || '');
          };
          reader.readAsDataURL(file);
        });
      }
      var saveDraft = formOv.querySelector('[data-pol-save-draft]');
      if (saveDraft) saveDraft.addEventListener('click', function () { saveForm(false); });
      var saveSub = formOv.querySelector('[data-pol-save-submit]');
      if (saveSub) saveSub.addEventListener('click', function () { saveForm(true); });
    }
  }

  function applyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h === 'add' && !ui.formOpen) {
      openAddForm();
      return;
    }
    if (h.indexOf('policy=') === 0) {
      ui.viewId = decodeURIComponent(h.slice(7));
      render();
    }
  }

  render();
  applyHash();
  window.addEventListener('hashchange', applyHash);
  window.addEventListener('hub:auth', render);
  window.addEventListener('hub-policies-changed', render);

  window.HubPolicies = {
    list: Store.list,
    get: Store.get,
    canManage: Store.canManage,
  };
})();
