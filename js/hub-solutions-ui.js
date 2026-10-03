/**
 * NAIOSH Solutions Catalog UI — اختيار حل · طلب عرض سعر · Transaction كاملة
 */
(() => {
  'use strict';

  const S = () => window.HubSolutions;
  const CR = () => window.HubCustomerRequests;
  const PENDING_KEY = 'naiosh_solutions_pending_v1';
  const SUBMIT_LOCK = { busy: false };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(iso);
    }
  };

  const STATUS_AR = {
    Draft: 'مسودة',
    New: 'بانتظار المراجعة',
    'Pending Review': 'بانتظار المراجعة',
    Viewed: 'قيد المراجعة',
    Assigned: 'قيد المراجعة',
    'Under Review': 'قيد المراجعة',
    'Need More Information': 'يحتاج معلومات إضافية',
    'Needs Changes': 'يحتاج معلومات إضافية',
    'Waiting For Customer': 'يحتاج معلومات إضافية',
    'Quote Prepared': 'تم إعداد عرض السعر',
    'Proposal Sent': 'تم إرسال عرض السعر',
    'Quote Accepted': 'تم قبول العرض',
    'Quote Rejected': 'تم رفض العرض',
    Approved: 'تم قبول العرض',
    'In Progress': 'قيد التنفيذ',
    Completed: 'مكتمل',
    Rejected: 'ملغي',
    Cancelled: 'ملغي',
  };

  const currentUser = () => {
    const u = window.HubAuth?.getUser?.() || null;
    if (u) return u;
    try {
      return JSON.parse(localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser') || 'null');
    } catch {
      return null;
    }
  };

  const isLoggedIn = () => {
    if (typeof window.HubAuth?.isLoggedIn === 'function') return !!window.HubAuth.isLoggedIn();
    const token = localStorage.getItem('hubAuthToken') || sessionStorage.getItem('hubAuthToken');
    return !!(token && currentUser());
  };

  const actorName = () => {
    const u = currentUser();
    return u?.name || u?.displayName || u?.email || 'زائر';
  };

  const customerIdOf = (u = currentUser()) => {
    if (!u) return '';
    return (
      u.customerId ||
      u.naioshId ||
      u.clientId ||
      u.clientNaioshId ||
      (u.email === 'client@naiosh.com' ? 'NAI-CLIENT-001' : '') ||
      u.id ||
      u.email ||
      ''
    );
  };

  const isStaff = () =>
    !!(
      window.HubAuth?.isStaff?.() ||
      ['supreme_leader', 'admin', 'manager', 'sales', 'chief_engineer', 'super_admin'].includes(
        String(currentUser()?.role || '').toLowerCase()
      )
    );

  const ui = {
    view: 'catalog', // catalog | my | detail | request | selected | wizard | success | admin | audit
    filters: { q: '', category: '', sector: '', serviceType: '', priceKind: '', duration: '' },
    solutionId: null,
    requestId: null,
    selected: null, // { solutionId, mode }
    wizard: null,
    success: null, // { requestId, message }
    detailTab: 'overview',
    toast: '',
    submitError: '',
  };

  const root = () => document.getElementById('so-app');

  const toast = (msg) => {
    ui.toast = msg;
    setTimeout(() => {
      if (ui.toast === msg) ui.toast = '';
      render();
    }, 3200);
    render();
  };

  const savePending = (ctx) => {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...ctx, at: Date.now() }));
    } catch (_) {}
  };

  const loadPending = () => {
    try {
      return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    } catch {
      return null;
    }
  };

  const clearPending = () => {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch (_) {}
  };

  const resumeUrl = (solutionId, action) =>
    `naiosh-solutions.html?resume=1&solutionId=${encodeURIComponent(solutionId)}&action=${encodeURIComponent(action)}`;

  /** Guest gate — keep Solution ID context across login */
  const requireCustomer = (solutionId, action) => {
    if (isLoggedIn()) return true;
    savePending({ solutionId, action });
    const next = resumeUrl(solutionId, action);
    if (typeof window.HubAuth?.showGuestGate === 'function') {
      window.HubAuth.showGuestGate({ message: 'يرجى تسجيل الدخول للمتابعة.', next });
      return false;
    }
    if (typeof window.HubAuth?.requireLogin === 'function') {
      return window.HubAuth.requireLogin({ message: 'يرجى تسجيل الدخول للمتابعة.', next });
    }
    try {
      sessionStorage.setItem('hubAuthFlash', 'يرجى تسجيل الدخول للمتابعة.');
    } catch (_) {}
    window.location.href = `login.html?next=${encodeURIComponent(next)}`;
    return false;
  };

  const priceLabel = (s) => {
    if (!s) return 'يحدد بعد دراسة الاحتياج';
    if (s.priceType === 'starting' && s.startingFrom != null) {
      return `يبدأ من ${Number(s.startingFrom).toLocaleString('en-US')} ر.س`;
    }
    return s.priceLabel || 'يحدد بعد دراسة الاحتياج';
  };

  const priceHtml = (s) => {
    if (s?.priceType === 'starting' && s.startingFrom != null) {
      return `<div class="so-price"><span>يبدأ من</span><strong>${Number(s.startingFrom).toLocaleString('en-US')} ر.س</strong></div>`;
    }
    return `<div class="so-price so-price-muted"><span>${esc(priceLabel(s))}</span></div>`;
  };

  /** Always expose اختيار حل + طلب عرض سعر with real Solution ID */
  const ctaButtons = (s, compact = false) => {
    const cls = compact ? 'btn btn-sm' : 'btn';
    const id = esc(s.id);
    return `
      <button type="button" class="${cls} btn-ghost" data-so="details" data-id="${id}"><i class="fas fa-eye"></i> عرض التفاصيل</button>
      <button type="button" class="${cls} btn-primary" data-so="choose" data-id="${id}"><i class="fas fa-check"></i> اختيار الحل</button>
      <button type="button" class="${cls} btn-dark" data-so="quote" data-id="${id}"><i class="fas fa-file-invoice-dollar"></i> طلب عرض سعر</button>`;
  };

  const filteredSolutions = () => {
    const f = ui.filters;
    return S()
      .listSolutions(isStaff())
      .filter((s) => {
        if (f.category && s.category !== f.category) return false;
        if (f.sector && s.sector !== f.sector) return false;
        if (f.serviceType && s.serviceType !== f.serviceType) return false;
        if (f.priceKind === 'paid' && !(s.priceType === 'starting' || s.startingFrom)) return false;
        if (f.priceKind === 'consult' && s.priceType !== 'consultation' && s.ctaType !== 'Request Consultation') return false;
        if (f.duration && !(s.duration || '').includes(f.duration)) return false;
        if (f.q) {
          const hay = `${s.name} ${s.description} ${s.category} ${s.serviceType} ${s.id}`.toLowerCase();
          if (!hay.includes(f.q.toLowerCase())) return false;
        }
        return true;
      });
  };

  const openSelectionSummary = (solutionId) => {
    const sol = S().getSolution(solutionId);
    if (!sol) {
      toast('تعذر تحديد الحل. حاول مرة أخرى.');
      return;
    }
    ui.selected = {
      solutionId: sol.id,
      name: sol.name,
      shortName: sol.shortName,
      category: sol.category,
      sector: sol.sector,
      serviceType: sol.serviceType,
      description: sol.description,
      price: priceLabel(sol),
      duration: sol.duration || '',
      startingFrom: sol.startingFrom ?? null,
    };
    ui.solutionId = sol.id;
    ui.view = 'selected';
    ui.wizard = null;
    render();
  };

  const openWizard = (solutionId, mode = 'choose') => {
    const sol = S().getSolution(solutionId);
    if (!sol) {
      toast('تعذر تحديد الحل. حاول مرة أخرى.');
      return;
    }
    const u = currentUser();
    const max = mode === 'cost' ? 7 : mode === 'quote' ? 1 : 6;
    ui.wizard = {
      mode,
      step: 1,
      max,
      solutionId: sol.id,
      data: {
        customer: {
          name: u?.name || u?.displayName || '',
          company: u?.company || u?.organization || '',
          phone: u?.phone || '',
          email: u?.email || '',
          branch: u?.branch || '',
          customerId: customerIdOf(u),
        },
        need: mode === 'consult' ? 'طلب استشارة حول الحل' : mode === 'quote' ? '' : mode === 'choose' ? `أريد تنفيذ حل: ${sol.name}` : '',
        scopeQty: '',
        budget: '',
        dueDate: '',
        notes: '',
        priority: 'عادي',
        scopeType: 'شركة كاملة',
        scopeDetail: '',
        attachments: [],
        costMeta: mode === 'cost' ? { expenseTypes: [], amount: '', problem: '', goal: 'تحليل فقط', docs: [] } : null,
      },
    };
    ui.view = 'wizard';
    ui.submitError = '';
    render();
  };

  const startAction = (solutionId, action) => {
    if (!solutionId) {
      toast('معرّف الحل غير موجود');
      return;
    }
    if (!requireCustomer(solutionId, action)) return;
    clearPending();
    if (action === 'choose') {
      openSelectionSummary(solutionId);
      return;
    }
    if (action === 'quote' || action === 'consult') {
      openWizard(solutionId, action);
      return;
    }
    openWizard(solutionId, action);
  };

  const resumePending = () => {
    if (!isLoggedIn()) return false;
    const params = new URLSearchParams(location.search);
    const fromUrl =
      params.get('resume') === '1'
        ? { solutionId: params.get('solutionId'), action: params.get('action') || 'choose' }
        : null;
    const pending = fromUrl?.solutionId ? fromUrl : loadPending();
    if (!pending?.solutionId) return false;
    clearPending();
    try {
      const url = new URL(location.href);
      url.searchParams.delete('resume');
      url.searchParams.delete('solutionId');
      url.searchParams.delete('action');
      history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
    } catch (_) {}
    startAction(pending.solutionId, pending.action || 'choose');
    return true;
  };

  const renderCatalog = () => {
    const list = filteredSolutions();
    const cats = [...new Set(S().listSolutions(true).map((s) => s.category))];
    const sectors = [...new Set(S().listSolutions(true).map((s) => s.sector))];
    const types = [...new Set(S().listSolutions(true).map((s) => s.serviceType))];
    return `
      <section class="so-intro cardish">
        <p>اختر الحل المناسب لاحتياجك، ثم أرسل طلباً وسيقوم فريق نايوش بمراجعته ومتابعته معك.</p>
        <div class="so-intro-actions">
          <a class="btn btn-primary" href="#so-catalog"><i class="fas fa-list"></i> تصفح الحلول</a>
          <button type="button" class="btn btn-dark" data-so="consult-generic"><i class="fas fa-comments"></i> طلب استشارة</button>
          <button type="button" class="btn btn-ghost" data-so="view-my"><i class="fas fa-folder-open"></i> طلباتي</button>
        </div>
      </section>

      <section class="so-toolbar" id="so-catalog">
        <div class="so-search">
          <label>بحث</label>
          <input data-so-filter="q" value="${esc(ui.filters.q)}" placeholder="ابحث عن حل أو قطاع أو فئة..." />
        </div>
        <div class="so-filters">
          <select data-so-filter="category"><option value="">كل الفئات</option>${cats.map((c) => `<option value="${esc(c)}" ${ui.filters.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <select data-so-filter="sector"><option value="">كل القطاعات</option>${sectors.map((c) => `<option value="${esc(c)}" ${ui.filters.sector === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <select data-so-filter="serviceType"><option value="">نوع الخدمة</option>${types.map((c) => `<option value="${esc(c)}" ${ui.filters.serviceType === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <select data-so-filter="priceKind">
            <option value="">السعر / النوع</option>
            <option value="paid" ${ui.filters.priceKind === 'paid' ? 'selected' : ''}>مدفوع / يبدأ من</option>
            <option value="consult" ${ui.filters.priceKind === 'consult' ? 'selected' : ''}>استشارة</option>
          </select>
          <select data-so-filter="duration">
            <option value="">مدة التنفيذ</option>
            <option value="أسبوع" ${ui.filters.duration === 'أسبوع' ? 'selected' : ''}>خلال أسابيع</option>
            <option value="شهر" ${ui.filters.duration === 'شهر' ? 'selected' : ''}>خلال أشهر</option>
          </select>
          <span class="so-count">${list.length} حل</span>
          ${isStaff() ? `<button type="button" class="btn btn-sm btn-dark" data-so="view-admin"><i class="fas fa-plus"></i> إدارة الحلول</button>
            <button type="button" class="btn btn-sm btn-ghost" data-so="view-audit">سجل العمليات</button>` : ''}
        </div>
      </section>

      <section class="so-grid" aria-label="كتالوج الحلول">
        ${
          list.length
            ? list
                .map(
                  (s) => `<article class="so-card" data-solution-id="${esc(s.id)}">
                    <div class="so-card-top" data-so="details" data-id="${esc(s.id)}" tabindex="0" role="button">
                      <span class="so-icon"><i class="fas ${esc(s.icon || 'fa-lightbulb')}"></i></span>
                      <div>
                        <small class="so-meta">${esc(s.id)} · ${esc(s.owner || '—')}</small>
                        <h3>${esc(s.shortName || s.name)}</h3>
                      </div>
                    </div>
                    <p class="so-desc">${esc(s.description)}</p>
                    <div class="so-tags">
                      <span>${esc(s.category)}</span>
                      <span>${esc(s.serviceType)}</span>
                      <span>${esc(s.duration || '—')}</span>
                    </div>
                    ${priceHtml(s)}
                    <div class="so-card-actions">${ctaButtons(s, true)}</div>
                  </article>`
                )
                .join('')
            : '<div class="so-empty">لا نتائج — عدّل البحث أو الفلاتر.</div>'
        }
      </section>`;
  };

  const renderSelected = () => {
    const sel = ui.selected;
    const sol = S().getSolution(sel?.solutionId);
    if (!sel || !sol) return `<div class="so-empty">لم يتم اختيار حل</div>`;
    return `
      <div class="so-panel-head">
        <h2>الحل المختار</h2>
        <button type="button" class="btn btn-ghost" data-so="view-catalog">رجوع للكتالوج</button>
      </div>
      <article class="cardish so-selected-summary" data-solution-id="${esc(sol.id)}">
        <small class="so-meta">${esc(sol.id)}</small>
        <h3>${esc(sol.name)}</h3>
        <p>${esc(sol.description)}</p>
        <ul class="so-feed">
          <li><b>السعر:</b> ${esc(priceLabel(sol))}</li>
          <li><b>مدة التنفيذ:</b> ${esc(sol.duration || '—')}</li>
          <li><b>التصنيف:</b> ${esc(sol.category || '—')}</li>
          <li><b>القطاع:</b> ${esc(sol.sector || '—')}</li>
          <li><b>نوع الخدمة:</b> ${esc(sol.serviceType || '—')}</li>
          <li><b>رقم العميل:</b> ${esc(customerIdOf() || '—')}</li>
        </ul>
        <div class="so-row-actions so-selected-actions">
          <button type="button" class="btn btn-primary" data-so="continue-request" data-id="${esc(sol.id)}"><i class="fas fa-arrow-left"></i> متابعة طلب الحل</button>
          <button type="button" class="btn btn-dark" data-so="quote" data-id="${esc(sol.id)}"><i class="fas fa-file-invoice-dollar"></i> طلب عرض سعر</button>
          <button type="button" class="btn btn-ghost" data-so="cancel-selected">إلغاء</button>
        </div>
      </article>`;
  };

  const renderMyRequests = () => {
    const u = currentUser();
    const email = (u?.email || '').toLowerCase();
    const cid = customerIdOf(u);
    const rows = S()
      .listRequests()
      .filter(
        (r) =>
          !email ||
          (r.customer?.email || r.email || '').toLowerCase() === email ||
          r.customerId === cid ||
          r.requestedBy === actorName() ||
          isStaff()
      );
    return `
      <div class="so-panel-head">
        <h2>طلباتي</h2>
        <button type="button" class="btn btn-ghost" data-so="view-catalog">رجوع للكتالوج</button>
      </div>
      <div class="so-table-wrap">
        <table class="so-table">
          <thead><tr><th>رقم الطلب</th><th>الحل</th><th>نوع الطلب</th><th>تاريخ الطلب</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (r) => `<tr>
                        <td><code>${esc(r.requestId || r.id)}</code></td>
                        <td>${esc(r.solutionName || r.relatedSolution || r.title)}</td>
                        <td>${esc(CR()?.labelType?.(r.requestType) || r.requestTypeLabel || r.requestType)}</td>
                        <td>${fmtTime(r.createdAt)}</td>
                        <td><span class="so-badge">${esc(STATUS_AR[r.status] || CR()?.STATUS_AR?.[r.status] || r.status)}</span></td>
                        <td>${fmtTime(r.updatedAt)}</td>
                        <td class="so-row-actions">
                          <button type="button" class="btn btn-sm btn-ghost" data-so="open-req" data-id="${esc(r.id)}">عرض</button>
                          ${!['Completed', 'Cancelled', 'Rejected'].includes(r.status) ? `<button type="button" class="btn btn-sm btn-ghost" data-so="add-att" data-id="${esc(r.id)}">إضافة مرفق</button>` : ''}
                          ${['New', 'Draft', 'Pending Review', 'Under Review'].includes(r.status) ? `<button type="button" class="btn btn-sm btn-dark" data-so="cancel-req" data-id="${esc(r.id)}">إلغاء</button>` : ''}
                        </td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="7" class="so-empty">لا توجد طلبات بعد — اختر حلاً من الكتالوج.</td></tr>'
            }
          </tbody>
        </table>
      </div>`;
  };

  const renderSolutionDetail = () => {
    const s = S().getSolution(ui.solutionId);
    if (!s) return `<div class="so-empty">الحل غير موجود</div>`;
    return `
      <div class="so-panel-head">
        <div>
          <small class="so-meta">${esc(s.id)} · ${esc(s.owner)} · ${esc(s.status)}</small>
          <h2>${esc(s.name)}</h2>
        </div>
        <button type="button" class="btn btn-ghost" data-so="view-catalog">رجوع</button>
      </div>
      <div class="so-detail-grid">
        <article class="cardish">
          <h3>الوصف</h3>
          <p>${esc(s.fullDescription || s.description)}</p>
          <h3>لمن هذا الحل؟</h3><p>${esc(s.audience || '—')}</p>
          <h3>المشكلة التي يحلها</h3><p>${esc(s.problem || '—')}</p>
          <h3>المدة المتوقعة</h3><p>${esc(s.duration)}</p>
        </article>
        <aside class="cardish so-detail-side">
          ${priceHtml(s)}
          <div class="so-tags"><span>${esc(s.category)}</span><span>${esc(s.serviceType)}</span><span>${esc(s.sector)}</span></div>
          <div class="so-card-actions so-card-actions-col">${ctaButtons(s)}</div>
        </aside>
      </div>`;
  };

  const renderRequestDetail = () => {
    const r = S().getRequest(ui.requestId);
    if (!r) return `<div class="so-empty">الطلب غير موجود</div>`;
    const quotes = S().listQuotations(r.id);
    const tab = ui.detailTab;
    const tabs = [
      ['overview', 'نظرة عامة'],
      ['comms', 'التواصل'],
      ['quote', 'العرض المالي'],
      ['files', 'المرفقات'],
      ['timeline', 'الخط الزمني'],
    ];
    let body = '';
    if (tab === 'overview') {
      body = `
        <div class="so-kv">
          <div><b>رقم الطلب</b><span><code>${esc(r.requestId || r.id)}</code></span></div>
          <div><b>الحل المطلوب</b><span>${esc(r.solutionName || r.relatedSolution || r.title)}</span></div>
          <div><b>معرّف الحل</b><span><code>${esc(r.solutionId || '—')}</code></span></div>
          <div><b>رقم العميل</b><span>${esc(r.customerId || '—')}</span></div>
          <div><b>العميل</b><span>${esc(r.customer?.name || r.customerName)} · ${esc(r.customer?.company || r.company)}</span></div>
          <div><b>التواصل</b><span>${esc(r.customer?.phone || r.phone)} · ${esc(r.customer?.email || r.email)}</span></div>
          <div><b>نوع الطلب</b><span>${esc(CR()?.labelType?.(r.requestType) || r.requestType)}</span></div>
          <div><b>المصدر</b><span>${esc(r.sourceModule || 'حلول نايوش')}</span></div>
          <div><b>الحالة</b><span>${esc(STATUS_AR[r.status] || r.status)}</span></div>
          <div><b>الاحتياج</b><span>${esc(r.need || r.description)}</span></div>
          <div><b>النطاق / الكمية</b><span>${esc(r.scopeDetail || r.scopeType || '—')}</span></div>
          <div><b>تاريخ الطلب</b><span>${fmtTime(r.createdAt)}</span></div>
        </div>`;
    } else if (tab === 'comms') {
      body = `<ul class="so-feed">${(r.messages || []).map((m) => `<li><b>${esc(m.by)}</b>: ${esc(m.text)} <small>${fmtTime(m.at)}</small></li>`).join('') || '<li>لا رسائل بعد</li>'}</ul>
        <div class="so-inline"><input id="so-msg" placeholder="اكتب رسالة..." /><button type="button" class="btn btn-primary btn-sm" data-so="send-msg" data-id="${esc(r.id)}">إرسال</button></div>`;
    } else if (tab === 'quote') {
      body = quotes.length
        ? quotes
            .map(
              (q) => `<article class="cardish" style="margin-bottom:10px" data-quote-id="${esc(q.id)}">
                <h4>عرض السعر · <code>${esc(q.id)}</code></h4>
                <ul class="so-feed">
                  <li><b>رقم الطلب:</b> <code>${esc(r.requestId || r.id)}</code></li>
                  <li><b>الحل المطلوب:</b> ${esc(q.solutionName || r.solutionName)}</li>
                  <li><b>حالة الطلب:</b> ${esc(STATUS_AR[r.status] || r.status)}</li>
                  <li><b>السعر المقترح:</b> ${Number(q.price || 0).toLocaleString('en-US')} ${esc(q.currency || 'ر.س')}</li>
                  <li><b>مدة التنفيذ:</b> ${esc(q.duration || '—')}</li>
                  <li><b>تفاصيل العرض:</b> ${esc(q.details || '—')}</li>
                  <li><b>صلاحية العرض:</b> ${esc(q.validUntil || '—')}</li>
                  <li><b>ملاحظات:</b> ${esc(q.notes || '—')}</li>
                  <li><b>شروط العرض:</b> ${esc(q.terms || '—')}</li>
                  <li><b>تاريخ العرض:</b> ${fmtTime(q.createdAt)}</li>
                </ul>
                ${
                  q.status === 'Sent' && !isStaff()
                    ? `<div class="so-row-actions">
                        <button type="button" class="btn btn-sm btn-primary" data-so="quote-accept" data-id="${esc(q.id)}">قبول العرض</button>
                        <button type="button" class="btn btn-sm btn-dark" data-so="quote-reject" data-id="${esc(q.id)}">رفض العرض</button>
                        <button type="button" class="btn btn-sm btn-ghost" data-so="quote-revise" data-id="${esc(q.id)}">طلب تعديل العرض</button>
                      </div>`
                    : `<p class="muted">حالة العرض: ${esc(q.status === 'Accepted' ? 'مقبول' : q.status === 'Rejected' ? 'مرفوض' : q.status === 'Revision Requested' ? 'طلب تعديل' : q.status)}</p>`
                }
              </article>`
            )
            .join('')
        : '<div class="so-empty">لا يوجد عرض سعر بعد.</div>';
    } else if (tab === 'files') {
      body = `<ul class="so-feed">${(r.attachments || []).map((a) => `<li>${esc(a.name)} · ${esc(a.by)} <small>${fmtTime(a.at)}</small></li>`).join('') || '<li>لا مرفقات</li>'}</ul>
        <button type="button" class="btn btn-dark btn-sm" data-so="add-att" data-id="${esc(r.id)}">إضافة مرفق</button>`;
    } else {
      body = `<ol class="so-feed">${(r.timeline || []).map((t) => `<li><b>${esc(t.text)}</b> · ${esc(t.by)} <small>${fmtTime(t.at)}</small></li>`).join('') || '<li>لا أحداث</li>'}</ol>`;
    }
    return `
      <div class="so-panel-head">
        <div>
          <small class="so-meta">${esc(r.requestId || r.id)} · ${esc(STATUS_AR[r.status] || r.status)}</small>
          <h2>${esc(r.solutionName || r.title)}</h2>
        </div>
        <button type="button" class="btn btn-ghost" data-so="view-my">طلباتي</button>
      </div>
      <div class="so-tabs">${tabs.map(([id, label]) => `<button type="button" class="so-tab ${tab === id ? 'on' : ''}" data-so="req-tab" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="cardish">${body}</div>`;
  };

  const renderQuoteForm = (w, sol) => {
    const c = w.data.customer;
    return `
      <div class="so-quote-form">
        <div class="so-kv so-quote-locked">
          <div><b>الحل المطلوب</b><span>${esc(sol?.name || '—')}</span></div>
          <div><b>معرّف الحل</b><span><code>${esc(sol?.id || w.solutionId)}</code></span></div>
          <div><b>اسم العميل</b><span>${esc(c.name || '—')}</span></div>
          <div><b>رقم العميل</b><span>${esc(c.customerId || '—')}</span></div>
          <div><b>البريد الإلكتروني</b><span>${esc(c.email || '—')}</span></div>
          <div><b>رقم الهاتف</b><span>${esc(c.phone || '—')}</span></div>
        </div>
        <input type="hidden" id="so-c-name" value="${esc(c.name)}" />
        <input type="hidden" id="so-c-company" value="${esc(c.company)}" />
        <input type="hidden" id="so-c-phone" value="${esc(c.phone)}" />
        <input type="hidden" id="so-c-email" value="${esc(c.email)}" />
        <input type="hidden" id="so-c-branch" value="${esc(c.branch)}" />
        <label class="so-block">اشرح احتياجك *
          <textarea id="so-need" rows="4" required placeholder="صف احتياجك بوضوح...">${esc(w.data.need)}</textarea>
        </label>
        <label class="so-block">الكمية / نطاق العمل
          <input id="so-scope-detail" value="${esc(w.data.scopeDetail || w.data.scopeQty)}" placeholder="مثال: فرع واحد · 3 أنظمة · حملة شهرية" />
        </label>
        <div class="so-form-grid">
          <label>الميزانية المتوقعة (اختياري)<input id="so-budget" value="${esc(w.data.budget)}" placeholder="مثال: 15000 ر.س" /></label>
          <label>موعد التنفيذ المطلوب (اختياري)<input id="so-due" type="date" value="${esc(w.data.dueDate)}" /></label>
        </div>
        <label class="so-block">ملاحظات إضافية
          <textarea id="so-notes" rows="3" placeholder="أي تفاصيل إضافية...">${esc(w.data.notes)}</textarea>
        </label>
        <label class="so-block">مرفق (اسم الملف)
          <input id="so-att" placeholder="مثال: brief.pdf" />
        </label>
        <ul>${(w.data.attachments || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        <button type="button" class="btn btn-sm btn-dark" data-so="wiz-add-att">إضافة مرفق للقائمة</button>
        ${ui.submitError ? `<p class="so-error" role="alert">${esc(ui.submitError)}</p>` : ''}
      </div>`;
  };

  const renderWizard = () => {
    const w = ui.wizard;
    if (!w) return '';
    const sol = S().getSolution(w.solutionId);
    const step = w.step;
    const isCost = w.mode === 'cost';
    const isQuote = w.mode === 'quote';
    const labels = isCost
      ? ['الشركة', 'نوع المصروفات', 'المبلغ', 'المشكلة', 'الهدف', 'المستندات', 'إرسال']
      : isQuote
        ? ['طلب عرض السعر']
        : ['الحل', 'العميل', 'الاحتياج', 'النطاق', 'المرفقات', 'مراجعة'];
    let body = '';
    if (isQuote) {
      body = renderQuoteForm(w, sol);
    } else if (!isCost) {
      if (step === 1) {
        body = `<h3>${esc(sol?.name)}</h3><p>${esc(sol?.description)}</p><p><b>الفئة:</b> ${esc(sol?.category)} · <b>النوع:</b> ${esc(sol?.serviceType)}</p>${priceHtml(sol || {})}`;
      } else if (step === 2) {
        const c = w.data.customer;
        body = `<div class="so-form-grid">
          <label>الاسم<input id="so-c-name" value="${esc(c.name)}" /></label>
          <label>الشركة<input id="so-c-company" value="${esc(c.company)}" /></label>
          <label>الهاتف<input id="so-c-phone" value="${esc(c.phone)}" /></label>
          <label>البريد<input id="so-c-email" type="email" value="${esc(c.email)}" /></label>
          <label>الفرع<input id="so-c-branch" value="${esc(c.branch)}" /></label>
          <label>رقم العميل<input id="so-c-cid" value="${esc(c.customerId)}" readonly /></label>
        </div>`;
      } else if (step === 3) {
        body = `<label class="so-block">ما الذي تريد تحقيقه من هذا الحل؟
          <textarea id="so-need" rows="4">${esc(w.data.need)}</textarea></label>
          <label class="so-block">الأولوية
            <select id="so-priority">${['عادي', 'مرتفع', 'عاجل'].map((p) => `<option ${w.data.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </label>`;
      } else if (step === 4) {
        body = `<label class="so-block">النطاق
          <select id="so-scope">${['شركة كاملة', 'فرع', 'إدارة', 'قسم', 'منصة', 'مشروع'].map((p) => `<option ${w.data.scopeType === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
        </label>
        <label class="so-block">تفاصيل النطاق<input id="so-scope-detail" value="${esc(w.data.scopeDetail)}" placeholder="اسم الفرع / المشروع..." /></label>`;
      } else if (step === 5) {
        body = `<label class="so-block">اسم المرفق / المستند
          <input id="so-att" placeholder="مثال: budget.pdf" /></label>
          <ul>${(w.data.attachments || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
          <button type="button" class="btn btn-sm btn-dark" data-so="wiz-add-att">إضافة للقائمة</button>`;
      } else {
        const c = w.data.customer;
        body = `<ul class="so-feed">
          <li><b>الحل:</b> ${esc(sol?.name)} (<code>${esc(sol?.id)}</code>)</li>
          <li><b>العميل:</b> ${esc(c.name)} · ${esc(c.customerId)} · ${esc(c.email)}</li>
          <li><b>الاحتياج:</b> ${esc(w.data.need)}</li>
          <li><b>الأولوية:</b> ${esc(w.data.priority)}</li>
          <li><b>النطاق:</b> ${esc(w.data.scopeType)} ${esc(w.data.scopeDetail)}</li>
        </ul>`;
      }
    } else {
      const cm = w.data.costMeta || {};
      if (step === 1) {
        const c = w.data.customer;
        body = `<div class="so-form-grid">
          <label>اسم الشركة<input id="so-c-company" value="${esc(c.company)}" /></label>
          <label>الفرع<input id="so-c-branch" value="${esc(c.branch)}" /></label>
          <label>الاسم<input id="so-c-name" value="${esc(c.name)}" /></label>
          <label>البريد<input id="so-c-email" value="${esc(c.email)}" /></label>
          <label>الهاتف<input id="so-c-phone" value="${esc(c.phone)}" /></label>
        </div>`;
      } else if (step === 2) {
        const types = ['تشغيل', 'رواتب', 'تقنية', 'تسويق', 'توريد', 'اتصالات', 'خدمات', 'أخرى'];
        body = `<div class="so-checks">${types
          .map((t) => `<label><input type="checkbox" data-so-exp="${esc(t)}" ${(cm.expenseTypes || []).includes(t) ? 'checked' : ''}/> ${t}</label>`)
          .join('')}</div>`;
      } else if (step === 3) {
        body = `<label class="so-block">المصروف الشهري/السنوي التقريبي
          <input id="so-cost-amount" value="${esc(cm.amount || '')}" placeholder="مثال: 120000 شهرياً" /></label>`;
      } else if (step === 4) {
        body = `<label class="so-block">المشكلة الحالية<textarea id="so-cost-problem" rows="4">${esc(cm.problem || '')}</textarea></label>`;
      } else if (step === 5) {
        body = `<label class="so-block">الهدف المطلوب
          <select id="so-cost-goal">${['خفض 10%', 'خفض 20%', 'تحليل فقط', 'تحديد فرص توفير'].map((g) => `<option ${cm.goal === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
        </label>`;
      } else if (step === 6) {
        const docs = ['كشف مصروفات', 'عقود موردين', 'ميزانيات', 'أخرى'];
        body = `<div class="so-checks">${docs
          .map((d) => `<label><input type="checkbox" data-so-doc="${esc(d)}" ${(cm.docs || []).includes(d) ? 'checked' : ''}/> ${d}</label>`)
          .join('')}</div>`;
      } else {
        body = `<ul class="so-feed"><li><b>الهدف:</b> ${esc(cm.goal)}</li><li><b>المشكلة:</b> ${esc(cm.problem)}</li></ul>`;
      }
    }

    const submitLabel = isQuote
      ? SUBMIT_LOCK.busy
        ? 'جارٍ إرسال الطلب...'
        : 'إرسال طلب عرض السعر'
      : SUBMIT_LOCK.busy
        ? 'جارٍ إرسال الطلب...'
        : 'إرسال الطلب';

    return `
      <div class="so-wizard cardish">
        <div class="so-panel-head">
          <h2>${isCost ? 'طلب خفض التكاليف' : isQuote ? 'طلب عرض سعر' : w.mode === 'consult' ? 'طلب استشارة' : 'طلب حل'}</h2>
          <button type="button" class="btn btn-ghost" data-so="wiz-cancel">إلغاء</button>
        </div>
        <div class="so-steps">${labels.map((l, i) => `<span class="${i + 1 === step ? 'on' : ''}">${i + 1}. ${l}</span>`).join('')}</div>
        <div class="so-wizard-body">${body}</div>
        <div class="so-row-actions">
          ${!isQuote && step > 1 ? '<button type="button" class="btn btn-dark" data-so="wiz-prev">السابق</button>' : ''}
          ${
            !isQuote && step < w.max
              ? '<button type="button" class="btn btn-primary" data-so="wiz-next">التالي</button>'
              : `<button type="button" class="btn btn-primary" data-so="wiz-submit" ${SUBMIT_LOCK.busy ? 'disabled' : ''}><i class="fas fa-paper-plane"></i> ${submitLabel}</button>`
          }
        </div>
      </div>`;
  };

  const renderSuccess = () => {
    const s = ui.success;
    if (!s) return '';
    return `
      <div class="cardish so-success" role="status">
        <h2><i class="fas fa-check-circle"></i> ${esc(s.message || 'تم إرسال الطلب بنجاح.')}</h2>
        <p>رقم الطلب:</p>
        <p class="so-req-id"><code>${esc(s.requestId)}</code></p>
        <div class="so-row-actions">
          <button type="button" class="btn btn-primary" data-so="open-req" data-id="${esc(s.requestId)}">عرض طلبي</button>
          <button type="button" class="btn btn-ghost" data-so="view-my">طلباتي</button>
          <button type="button" class="btn btn-dark" data-so="view-catalog">الكتالوج</button>
        </div>
      </div>`;
  };

  const renderAdmin = () => {
    const rows = S().listSolutions(true);
    return `
      <div class="so-panel-head">
        <h2>إدارة الحلول</h2>
        <div class="so-row-actions">
          <button type="button" class="btn btn-sm btn-primary" data-so="admin-add"><i class="fas fa-plus"></i> إضافة حل</button>
          <button type="button" class="btn btn-ghost" data-so="view-catalog">الكتالوج</button>
        </div>
      </div>
      <div class="so-table-wrap"><table class="so-table">
        <thead><tr><th>ID</th><th>الاسم</th><th>الفئة</th><th>المالك</th><th>CTA</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (s) => `<tr>
              <td><code>${esc(s.id)}</code></td><td>${esc(s.name)}</td><td>${esc(s.category)}</td>
              <td>${esc(s.owner)}</td><td>${esc(s.ctaType)}</td><td>${esc(s.status)}</td>
              <td class="so-row-actions">
                <button type="button" class="btn btn-sm btn-ghost" data-so="details" data-id="${esc(s.id)}">عرض</button>
                <button type="button" class="btn btn-sm btn-dark" data-so="admin-edit" data-id="${esc(s.id)}">تعديل</button>
                <button type="button" class="btn btn-sm btn-ghost" data-so="admin-clone" data-id="${esc(s.id)}">نسخ</button>
                <button type="button" class="btn btn-sm btn-primary" data-so="admin-status" data-id="${esc(s.id)}" data-status="active">تفعيل</button>
                <button type="button" class="btn btn-sm btn-dark" data-so="admin-status" data-id="${esc(s.id)}" data-status="paused">إيقاف</button>
                <button type="button" class="btn btn-sm btn-ghost" data-so="admin-status" data-id="${esc(s.id)}" data-status="archived">أرشفة</button>
              </td>
            </tr>`
          )
          .join('')}</tbody>
      </table></div>`;
  };

  const renderAudit = () => `
      <div class="so-panel-head"><h2>سجل العمليات</h2><button type="button" class="btn btn-ghost" data-so="view-catalog">رجوع</button></div>
      <div class="so-table-wrap"><table class="so-table">
        <thead><tr><th>TX</th><th>الطلب</th><th>العميل</th><th>الحل</th><th>الإجراء</th><th>بواسطة</th><th>الوقت</th><th>الحالة</th></tr></thead>
        <tbody>${(S().listAudit() || [])
          .map(
            (a) => `<tr>
              <td><code>${esc(a.id)}</code></td><td><code>${esc(a.requestId || '—')}</code></td>
              <td>${esc(a.customer || '—')}</td><td>${esc(a.solution || '—')}</td>
              <td>${esc(a.action)}</td><td>${esc(a.performedBy)}</td><td>${fmtTime(a.at)}</td>
              <td>${esc(a.oldStatus || '—')} → ${esc(a.newStatus || '—')}</td>
            </tr>`
          )
          .join('') || '<tr><td colspan="8">لا عمليات</td></tr>'}</tbody>
      </table></div>`;

  const readWizardFields = () => {
    const w = ui.wizard;
    if (!w) return;
    const d = w.data;
    const g = (id) => document.getElementById(id)?.value?.trim() || '';
    if (document.getElementById('so-c-name')) {
      d.customer = {
        name: g('so-c-name'),
        company: g('so-c-company'),
        phone: g('so-c-phone'),
        email: g('so-c-email'),
        branch: g('so-c-branch'),
        customerId: g('so-c-cid') || d.customer.customerId || customerIdOf(),
      };
    }
    if (document.getElementById('so-need')) d.need = g('so-need');
    if (document.getElementById('so-priority')) d.priority = g('so-priority');
    if (document.getElementById('so-scope')) d.scopeType = g('so-scope');
    if (document.getElementById('so-scope-detail')) d.scopeDetail = g('so-scope-detail');
    if (document.getElementById('so-budget')) d.budget = g('so-budget');
    if (document.getElementById('so-due')) d.dueDate = g('so-due');
    if (document.getElementById('so-notes')) d.notes = g('so-notes');
    if (w.mode === 'cost') {
      d.costMeta = d.costMeta || {};
      d.costMeta.expenseTypes = [...document.querySelectorAll('[data-so-exp]:checked')].map((el) => el.getAttribute('data-so-exp'));
      if (document.getElementById('so-cost-amount')) d.costMeta.amount = g('so-cost-amount');
      if (document.getElementById('so-cost-problem')) d.costMeta.problem = g('so-cost-problem');
      if (document.getElementById('so-cost-goal')) d.costMeta.goal = g('so-cost-goal');
      d.costMeta.docs = [...document.querySelectorAll('[data-so-doc]:checked')].map((el) => el.getAttribute('data-so-doc'));
      d.need = d.need || `خفض تكاليف · هدف: ${d.costMeta.goal} · ${d.costMeta.problem || ''}`;
    }
  };

  const submitWizard = () => {
    if (SUBMIT_LOCK.busy) return;
    readWizardFields();
    const w = ui.wizard;
    if (!w) return;
    if (w._submitted) return;
    const sol = S().getSolution(w.solutionId);
    const c = w.data.customer;
    if (!c.name || !c.email) {
      ui.submitError = 'الاسم والبريد مطلوبان';
      toast('الاسم والبريد مطلوبان');
      render();
      return;
    }
    if ((w.mode === 'quote' || (w.mode !== 'cost' && w.step >= 3)) && !w.data.need) {
      ui.submitError = 'وصف الاحتياج مطلوب';
      toast('وصف الاحتياج مطلوب');
      render();
      return;
    }

    SUBMIT_LOCK.busy = true;
    w._submitted = true;
    ui.submitError = '';
    render();

    try {
      const needParts = [w.data.need];
      if (w.data.budget) needParts.push(`الميزانية المتوقعة: ${w.data.budget}`);
      if (w.data.dueDate) needParts.push(`موعد التنفيذ المطلوب: ${w.data.dueDate}`);
      if (w.data.notes) needParts.push(`ملاحظات: ${w.data.notes}`);

      const requestType =
        w.mode === 'cost'
          ? 'Cost Reduction Assessment'
          : w.mode === 'quote'
            ? 'Quote Request'
            : w.mode === 'consult'
              ? 'Consultation Request'
              : 'Solution Request';

      const req = S().createRequest(
        {
          solutionId: w.solutionId,
          solutionName: sol?.name || '',
          requestType,
          customerId: c.customerId || customerIdOf(),
          customer: c,
          customerName: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          branch: c.branch,
          need: needParts.filter(Boolean).join('\n'),
          description: needParts.filter(Boolean).join('\n'),
          priority: w.data.priority,
          scopeType: w.data.scopeType,
          scopeDetail: w.data.scopeDetail || w.data.scopeQty || '',
          budget: w.data.budget || '',
          dueDate: w.data.dueDate || '',
          notes: w.data.notes || '',
          attachments: (w.data.attachments || []).map((name) => ({ name, at: new Date().toISOString(), by: actorName() })),
          costMeta: w.data.costMeta,
          status: 'Pending Review',
          sourceModule: 'حلول نايوش',
          sourcePage: sol?.name || 'كتالوج الحلول',
          sourceUrl: 'naiosh-solutions.html',
          sourceAction: w.mode === 'quote' ? 'طلب عرض سعر' : w.mode === 'consult' ? 'طلب استشارة' : 'اختيار حل',
          channel: 'Web',
        },
        actorName()
      );

      if (!req?.id) throw new Error('createRequest returned empty');

      ui.wizard = null;
      ui.selected = null;
      ui.requestId = req.id;
      ui.success = {
        requestId: req.requestId || req.id,
        message: w.mode === 'quote' ? 'تم إرسال طلب عرض السعر بنجاح.' : 'تم إرسال طلب الحل بنجاح.',
      };
      ui.view = 'success';
      SUBMIT_LOCK.busy = false;
      render();
    } catch (err) {
      console.error('[HubSolutionsUI] submit failed', err);
      SUBMIT_LOCK.busy = false;
      w._submitted = false;
      ui.submitError = 'تعذر إرسال الطلب. حاول مرة أخرى.';
      toast('تعذر إرسال الطلب. حاول مرة أخرى.');
      render();
    }
  };

  const render = () => {
    const el = root();
    if (!el || !S()) return;
    let main = '';
    if (ui.view === 'catalog') main = renderCatalog();
    else if (ui.view === 'my') main = renderMyRequests();
    else if (ui.view === 'detail') main = renderSolutionDetail();
    else if (ui.view === 'request') main = renderRequestDetail();
    else if (ui.view === 'selected') main = renderSelected();
    else if (ui.view === 'wizard') main = renderWizard();
    else if (ui.view === 'success') main = renderSuccess();
    else if (ui.view === 'admin') main = renderAdmin();
    else if (ui.view === 'audit') main = renderAudit();
    else main = renderCatalog();

    el.innerHTML = `
      ${ui.toast ? `<div class="so-toast" role="status">${esc(ui.toast)}</div>` : ''}
      <nav class="so-topnav">
        <button type="button" class="btn btn-sm ${ui.view === 'catalog' ? 'btn-primary' : 'btn-ghost'}" data-so="view-catalog">الكتالوج</button>
        <button type="button" class="btn btn-sm ${ui.view === 'my' || ui.view === 'request' || ui.view === 'success' ? 'btn-primary' : 'btn-ghost'}" data-so="view-my">طلباتي</button>
        ${isStaff() ? `<button type="button" class="btn btn-sm ${ui.view === 'admin' ? 'btn-primary' : 'btn-ghost'}" data-so="view-admin">إدارة</button>
          <button type="button" class="btn btn-sm ${ui.view === 'audit' ? 'btn-primary' : 'btn-ghost'}" data-so="view-audit">سجل العمليات</button>` : ''}
      </nav>
      ${main}`;
  };

  const onClick = (e) => {
    const btn = e.target.closest('[data-so]');
    if (!btn) return;
    e.preventDefault();
    const action = btn.getAttribute('data-so');
    const id = btn.getAttribute('data-id');

    if (action === 'view-catalog') {
      ui.view = 'catalog';
      ui.selected = null;
      ui.wizard = null;
      render();
      return;
    }
    if (action === 'view-my') {
      ui.view = 'my';
      render();
      return;
    }
    if (action === 'view-admin') {
      ui.view = 'admin';
      render();
      return;
    }
    if (action === 'view-audit') {
      ui.view = 'audit';
      render();
      return;
    }
    if (action === 'details') {
      ui.solutionId = id;
      ui.view = 'detail';
      render();
      return;
    }
    if (action === 'choose' || action === 'quote' || action === 'consult') {
      startAction(id, action);
      return;
    }
    if (action === 'continue-request') {
      openWizard(id, 'choose');
      return;
    }
    if (action === 'cancel-selected') {
      ui.selected = null;
      ui.view = 'catalog';
      render();
      return;
    }
    if (action === 'consult-generic') {
      const cost = S().listSolutions().find((s) => s.ctaType === 'Request Consultation') || S().listSolutions()[0];
      if (cost) startAction(cost.id, 'consult');
      return;
    }
    if (action === 'cost-start') {
      const sol = S().getSolution('SOL-2026-00022') || S().listSolutions().find((s) => s.requestType === 'Cost Reduction Assessment');
      if (sol) startAction(sol.id, 'cost');
      return;
    }
    if (action === 'open-req') {
      ui.requestId = id;
      ui.view = 'request';
      ui.detailTab = 'overview';
      ui.success = null;
      render();
      return;
    }
    if (action === 'req-tab') {
      ui.detailTab = btn.getAttribute('data-tab') || 'overview';
      render();
      return;
    }
    if (action === 'wiz-cancel') {
      ui.wizard = null;
      ui.view = ui.selected ? 'selected' : 'catalog';
      render();
      return;
    }
    if (action === 'wiz-prev') {
      readWizardFields();
      ui.wizard.step = Math.max(1, ui.wizard.step - 1);
      render();
      return;
    }
    if (action === 'wiz-next') {
      readWizardFields();
      const w = ui.wizard;
      if (w.mode !== 'cost' && w.step === 2) {
        const c = w.data.customer;
        if (!c.name || !c.email) {
          toast('الاسم والبريد مطلوبان');
          return;
        }
      }
      if (w.mode !== 'cost' && w.step === 3 && !w.data.need) {
        toast('وصف الاحتياج مطلوب');
        return;
      }
      w.step = Math.min(w.max, w.step + 1);
      render();
      return;
    }
    if (action === 'wiz-add-att') {
      const name = document.getElementById('so-att')?.value?.trim();
      if (!name) return;
      ui.wizard.data.attachments = ui.wizard.data.attachments || [];
      ui.wizard.data.attachments.push(name);
      document.getElementById('so-att').value = '';
      render();
      return;
    }
    if (action === 'wiz-submit') {
      submitWizard();
      return;
    }
    if (action === 'cancel-req') {
      if (!window.confirm('هل تريد إلغاء الطلب؟')) return;
      S().updateRequestStatus(id, 'Cancelled', actorName(), 'إلغاء بواسطة العميل');
      toast('تم إلغاء الطلب');
      render();
      return;
    }
    if (action === 'add-att') {
      const name = window.prompt('اسم الملف / المستند؟');
      if (!name) return;
      S().addAttachment(id, name, actorName());
      toast('تمت إضافة المرفق');
      if (ui.view === 'request') ui.detailTab = 'files';
      render();
      return;
    }
    if (action === 'send-msg') {
      const text = document.getElementById('so-msg')?.value?.trim();
      if (!text) return;
      S().addMessage(id, text, actorName());
      render();
      return;
    }
    if (action === 'assign') {
      const name = window.prompt('اسم المسؤول؟', 'مستشار الحلول');
      if (!name) return;
      S().assignRequest(id, { assignedTo: name, consultant: name }, actorName());
      toast('تم التعيين');
      render();
      return;
    }
    if (action === 'status') {
      S().updateRequestStatus(id, btn.getAttribute('data-status'), actorName());
      toast('تحدّثت الحالة');
      render();
      return;
    }
    if (action === 'make-quote') {
      const price = Number(window.prompt('سعر العرض؟', '5000')) || 5000;
      S().createQuotation(id, { price }, actorName());
      ui.detailTab = 'quote';
      toast('أُرسل عرض السعر');
      render();
      return;
    }
    if (action === 'quote-accept') {
      S().decideQuotation(id, 'accept', actorName());
      toast('تم قبول العرض');
      render();
      return;
    }
    if (action === 'quote-reject') {
      S().decideQuotation(id, 'reject', actorName());
      toast('تم رفض العرض');
      render();
      return;
    }
    if (action === 'quote-revise') {
      const note = window.prompt('ما التعديل المطلوب على العرض؟') || 'طلب تعديل العرض';
      S().decideQuotation(id, 'revise', actorName(), note);
      toast('تم إرسال طلب تعديل العرض');
      render();
      return;
    }
    if (action === 'admin-add' || action === 'admin-edit') {
      const existing = action === 'admin-edit' ? S().getSolution(id) : null;
      const name = window.prompt('اسم الحل', existing?.name || '');
      if (!name) return;
      const category = window.prompt('الفئة', existing?.category || 'عام') || 'عام';
      const description = window.prompt('وصف مختصر', existing?.description || '') || '';
      S().upsertSolution(
        {
          id: existing?.id,
          name,
          shortName: name.slice(0, 40),
          category,
          description,
          fullDescription: description,
          serviceType: existing?.serviceType || 'خدمة',
          owner: existing?.owner || actorName(),
          ctaType: existing?.ctaType || 'Choose Solution',
          priceType: existing?.priceType || 'quote',
          duration: existing?.duration || '2–3 أسابيع',
        },
        actorName()
      );
      toast(existing ? 'تم التعديل' : 'تمت الإضافة');
      render();
      return;
    }
    if (action === 'admin-clone') {
      const s = S().getSolution(id);
      if (!s) return;
      S().upsertSolution({ ...s, id: undefined, name: `${s.name} (نسخة)`, shortName: `${s.shortName} نسخة` }, actorName());
      toast('تم النسخ');
      render();
      return;
    }
    if (action === 'admin-status') {
      S().setSolutionStatus(id, btn.getAttribute('data-status'), actorName());
      toast('تحدّثت حالة الحل');
      render();
      return;
    }
  };

  const onChange = (e) => {
    const el = e.target.closest('[data-so-filter]');
    if (!el) return;
    ui.filters[el.getAttribute('data-so-filter')] = el.value;
    render();
  };

  const mount = () => {
    if (!root() || !S()) return;
    if (ui._mounted) {
      S().reload();
      if (resumePending()) return;
      render();
      return;
    }
    ui._mounted = true;
    S().reload();
    root().addEventListener('click', onClick);
    root().addEventListener('change', onChange);
    root().addEventListener('input', (e) => {
      if (e.target.matches('[data-so-filter="q"]')) {
        ui.filters.q = e.target.value;
        clearTimeout(ui._q);
        ui._q = setTimeout(render, 180);
      }
    });
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'my') ui.view = 'my';
    if (params.get('cost') === '1') {
      const sol = S().getSolution('SOL-2026-00022');
      if (sol) {
        startAction(sol.id, 'cost');
        return;
      }
    }
    if (resumePending()) return;
    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.HubSolutionsUI = { render, ui, openWizard, openSelectionSummary, startAction, resumePending, mount };
})();
