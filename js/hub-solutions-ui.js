/**
 * NAIOSH Solutions Catalog UI — selectable catalog + request transactions
 */
(() => {
  'use strict';

  const S = () => window.HubSolutions;
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
    New: 'جديد',
    'Under Review': 'قيد المراجعة',
    'Need More Information': 'يحتاج معلومات',
    'Proposal Sent': 'عُرض سعر',
    Approved: 'معتمد',
    'In Progress': 'قيد التنفيذ',
    Completed: 'مكتمل',
    Rejected: 'مرفوض',
    Cancelled: 'ملغى',
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

  const actorName = () => {
    const u = currentUser();
    return u?.name || u?.displayName || u?.email || 'زائر';
  };

  const isStaff = () => !!(window.HubAuth?.isStaff?.() || ['supreme_leader', 'admin', 'manager', 'sales'].includes(String(currentUser()?.role || '').toLowerCase()));

  const ui = {
    view: 'catalog', // catalog | my | detail | request | admin | audit | cost
    filters: { q: '', category: '', sector: '', serviceType: '', priceKind: '', duration: '' },
    solutionId: null,
    requestId: null,
    wizard: null,
    detailTab: 'overview',
    toast: '',
  };

  const root = () => document.getElementById('so-app');

  const toast = (msg) => {
    ui.toast = msg;
    setTimeout(() => {
      if (ui.toast === msg) ui.toast = '';
      render();
    }, 2800);
    render();
  };

  const priceHtml = (s) => {
    if (s.priceType === 'starting' && s.startingFrom != null) {
      return `<div class="so-price"><span>Starting From</span><strong>${Number(s.startingFrom).toLocaleString('en-US')} ر.س</strong></div>`;
    }
    return `<div class="so-price so-price-muted"><span>${esc(s.priceLabel || 'السعر يحدد بعد دراسة الاحتياج')}</span></div>`;
  };

  const ctaButtons = (s, compact = false) => {
    const cls = compact ? 'btn btn-sm' : 'btn';
    const choose = `<button type="button" class="${cls} btn-primary" data-so="choose" data-id="${esc(s.id)}"><i class="fas fa-check"></i> اختيار الحل</button>`;
    const details = `<button type="button" class="${cls} btn-ghost" data-so="details" data-id="${esc(s.id)}"><i class="fas fa-eye"></i> عرض التفاصيل</button>`;
    if (s.ctaType === 'Request Quote' || s.priceType === 'quote') {
      return `${details}${choose}<button type="button" class="${cls} btn-dark" data-so="quote" data-id="${esc(s.id)}"><i class="fas fa-file-invoice-dollar"></i> طلب عرض سعر</button>`;
    }
    if (s.ctaType === 'Request Consultation' || s.priceType === 'consultation') {
      return `${details}<button type="button" class="${cls} btn-primary" data-so="consult" data-id="${esc(s.id)}"><i class="fas fa-comments"></i> طلب استشارة</button>${choose}`;
    }
    return `${details}${choose}`;
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

  const openWizard = (solutionId, mode = 'choose') => {
    const sol = S().getSolution(solutionId);
    if (!sol) return;
    const u = currentUser();
    ui.wizard = {
      mode,
      step: 1,
      max: mode === 'cost' ? 7 : 6,
      solutionId,
      data: {
        customer: {
          name: u?.name || u?.displayName || '',
          company: u?.company || u?.organization || '',
          phone: u?.phone || '',
          email: u?.email || '',
          branch: u?.branch || '',
        },
        need: mode === 'consult' ? 'طلب استشارة حول الحل' : mode === 'quote' ? 'طلب عرض سعر' : '',
        priority: 'عادي',
        scopeType: 'شركة كاملة',
        scopeDetail: '',
        attachments: [],
        costMeta: mode === 'cost' ? { expenseTypes: [], amount: '', problem: '', goal: 'تحليل فقط', docs: [] } : null,
      },
    };
    ui.view = 'wizard';
    render();
  };

  const renderCatalog = () => {
    const list = filteredSolutions();
    const cats = [...new Set(S().listSolutions(true).map((s) => s.category))];
    const sectors = [...new Set(S().listSolutions(true).map((s) => s.sector))];
    const types = [...new Set(S().listSolutions(true).map((s) => s.serviceType))];
    return `
      <section class="so-intro cardish">
        <p>اختر الحل المناسب لاحتياجك، ثم أرسل طلبك وسيقوم فريق نايوش بمراجعته ومتابعته معك.</p>
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
            <option value="paid" ${ui.filters.priceKind === 'paid' ? 'selected' : ''}>مدفوع / Starting From</option>
            <option value="consult" ${ui.filters.priceKind === 'consult' ? 'selected' : ''}>استشاري</option>
          </select>
          <select data-so-filter="duration">
            <option value="">مدة التنفيذ</option>
            <option value="2" ${ui.filters.duration === '2' ? 'selected' : ''}>حوالي أسبوعين</option>
            <option value="3" ${ui.filters.duration === '3' ? 'selected' : ''}>حوالي 3 أسابيع</option>
            <option value="4" ${ui.filters.duration === '4' ? 'selected' : ''}>4 أسابيع+</option>
          </select>
        </div>
        <div class="so-toolbar-side">
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
                  (s) => `<article class="so-card" data-so="details" data-id="${esc(s.id)}" tabindex="0" role="button">
                    <div class="so-card-top">
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
                    <div class="so-card-actions" onclick="event.stopPropagation()">${ctaButtons(s, true)}</div>
                  </article>`
                )
                .join('')
            : '<div class="so-empty">لا نتائج — عدّل البحث أو الفلاتر.</div>'
        }
      </section>`;
  };

  const renderMyRequests = () => {
    const u = currentUser();
    const email = (u?.email || '').toLowerCase();
    const rows = S()
      .listRequests()
      .filter((r) => !email || (r.customer?.email || '').toLowerCase() === email || r.requestedBy === actorName() || isStaff());
    return `
      <div class="so-panel-head">
        <h2>طلباتي</h2>
        <button type="button" class="btn btn-ghost" data-so="view-catalog">رجوع للكتالوج</button>
      </div>
      <div class="so-table-wrap">
        <table class="so-table">
          <thead><tr><th>Request ID</th><th>الحل</th><th>تاريخ الطلب</th><th>المسؤول</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (r) => `<tr>
                        <td><code>${esc(r.requestId || r.id)}</code></td>
                        <td>${esc(r.solutionName)}</td>
                        <td>${fmtTime(r.createdAt)}</td>
                        <td>${esc(r.assignedTo || r.salesOwner || '—')}</td>
                        <td><span class="so-badge">${esc(STATUS_AR[r.status] || r.status)}</span></td>
                        <td>${fmtTime(r.updatedAt)}</td>
                        <td class="so-row-actions">
                          <button type="button" class="btn btn-sm btn-ghost" data-so="open-req" data-id="${esc(r.id)}">عرض</button>
                          <button type="button" class="btn btn-sm btn-dark" data-so="open-req" data-id="${esc(r.id)}">متابعة</button>
                          ${!['Completed', 'Cancelled', 'Rejected'].includes(r.status) ? `<button type="button" class="btn btn-sm btn-ghost" data-so="add-att" data-id="${esc(r.id)}">إضافة مرفق</button>` : ''}
                          ${['New', 'Draft', 'Under Review'].includes(r.status) ? `<button type="button" class="btn btn-sm btn-dark" data-so="cancel-req" data-id="${esc(r.id)}">إلغاء</button>` : ''}
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
          <small class="so-meta">${esc(s.id)} · Owner: ${esc(s.owner)} · ${esc(s.status)}</small>
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
          <h3>النطاق</h3><p>${esc(s.scope || '—')}</p>
          <h3>المخرجات</h3><ul>${(s.deliverables || []).map((d) => `<li>${esc(d)}</li>`).join('') || '<li>—</li>'}</ul>
          <h3>المدة المتوقعة</h3><p>${esc(s.duration)}</p>
          <h3>المتطلبات</h3><ul>${(s.requirements || []).map((d) => `<li>${esc(d)}</li>`).join('') || '<li>—</li>'}</ul>
          <h3>الخطوات</h3><ol>${(s.steps || []).map((d) => `<li>${esc(d)}</li>`).join('') || '<li>—</li>'}</ol>
          <h3>FAQ</h3>
          <p><b>هل يوجد سعر ثابت؟</b> ${s.priceType === 'starting' ? `نعم، يبدأ من ${s.startingFrom} ر.س` : 'يُحدد بعد دراسة الاحتياج أو عبر استشارة.'}</p>
          <p><b>ماذا بعد الاختيار؟</b> يُنشأ طلب برقم Request ID ويُتابع من «طلباتي».</p>
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
      ['tasks', 'المهام'],
      ['timeline', 'Timeline'],
      ['audit', 'سجل العمليات'],
    ];
    let body = '';
    if (tab === 'overview') {
      body = `
        <div class="so-kv">
          <div><b>العميل</b><span>${esc(r.customer?.name)} · ${esc(r.customer?.company)}</span></div>
          <div><b>التواصل</b><span>${esc(r.customer?.phone)} · ${esc(r.customer?.email)}</span></div>
          <div><b>الفرع</b><span>${esc(r.customer?.branch || '—')}</span></div>
          <div><b>الاحتياج</b><span>${esc(r.need)}</span></div>
          <div><b>الأولوية</b><span>${esc(r.priority)}</span></div>
          <div><b>النطاق</b><span>${esc(r.scopeType)} ${esc(r.scopeDetail || '')}</span></div>
          <div><b>Requested By</b><span>${esc(r.requestedBy)}</span></div>
          <div><b>Assigned To</b><span>${esc(r.assignedTo || '—')}</span></div>
          <div><b>Sales Owner</b><span>${esc(r.salesOwner || '—')}</span></div>
          <div><b>Consultant</b><span>${esc(r.consultant || '—')}</span></div>
          <div><b>Approver</b><span>${esc(r.approver || '—')}</span></div>
        </div>
        ${
          isStaff()
            ? `<div class="so-row-actions" style="margin-top:12px">
                <button type="button" class="btn btn-sm btn-dark" data-so="assign" data-id="${esc(r.id)}">تعيين مسؤول</button>
                <button type="button" class="btn btn-sm btn-primary" data-so="status" data-id="${esc(r.id)}" data-status="Under Review">قيد المراجعة</button>
                <button type="button" class="btn btn-sm btn-primary" data-so="make-quote" data-id="${esc(r.id)}">إرسال عرض سعر</button>
                <button type="button" class="btn btn-sm btn-dark" data-so="status" data-id="${esc(r.id)}" data-status="In Progress">بدء التنفيذ</button>
                <button type="button" class="btn btn-sm btn-primary" data-so="status" data-id="${esc(r.id)}" data-status="Completed">إكمال</button>
              </div>`
            : ''
        }`;
    } else if (tab === 'comms') {
      body = `<ul class="so-feed">${(r.messages || []).map((m) => `<li><b>${esc(m.by)}</b>: ${esc(m.text)} <small>${fmtTime(m.at)}</small></li>`).join('') || '<li>لا رسائل بعد</li>'}</ul>
        <div class="so-inline"><input id="so-msg" placeholder="اكتب رسالة..." /><button type="button" class="btn btn-primary btn-sm" data-so="send-msg" data-id="${esc(r.id)}">إرسال</button></div>`;
    } else if (tab === 'quote') {
      body = quotes.length
        ? quotes
            .map(
              (q) => `<article class="cardish" style="margin-bottom:10px">
                <b>${esc(q.id)}</b> · ${esc(q.status)}
                <p>Price: ${q.price} · Tax: ${q.tax} · Discount: ${q.discount} · <strong>Total: ${q.total}</strong></p>
                <p>Valid Until: ${esc(q.validUntil)} · By: ${esc(q.createdBy)}</p>
                ${
                  q.status === 'Sent'
                    ? `<div class="so-row-actions">
                        <button type="button" class="btn btn-sm btn-primary" data-so="quote-accept" data-id="${esc(q.id)}">قبول</button>
                        <button type="button" class="btn btn-sm btn-dark" data-so="quote-reject" data-id="${esc(q.id)}">رفض</button>
                      </div>`
                    : ''
                }
              </article>`
            )
            .join('')
        : '<div class="so-empty">لا يوجد عرض سعر بعد.</div>';
    } else if (tab === 'files') {
      body = `<ul class="so-feed">${(r.attachments || []).map((a) => `<li>${esc(a.name)} · ${esc(a.by)} <small>${fmtTime(a.at)}</small></li>`).join('') || '<li>لا مرفقات</li>'}</ul>
        <button type="button" class="btn btn-dark btn-sm" data-so="add-att" data-id="${esc(r.id)}">إضافة مرفق</button>`;
    } else if (tab === 'tasks') {
      body = `<ul class="so-feed">${(r.tasks || []).map((t) => `<li>${esc(t)}</li>`).join('') || '<li>لا مهام مرتبطة بعد — تُضاف عند بدء التنفيذ.</li>'}</ul>`;
    } else if (tab === 'timeline') {
      body = `<ol class="so-timeline">${(r.timeline || []).map((t) => `<li><b>${esc(t.text)}</b><small>${esc(t.by)} · ${fmtTime(t.at)}</small></li>`).join('')}</ol>`;
    } else {
      const logs = S()
        .listAudit()
        .filter((a) => a.requestId === r.id);
      body = `<div class="so-table-wrap"><table class="so-table"><thead><tr><th>TX</th><th>Action</th><th>By</th><th>Status</th><th>At</th></tr></thead>
        <tbody>${logs.map((a) => `<tr><td><code>${esc(a.id)}</code></td><td>${esc(a.action)}</td><td>${esc(a.performedBy)}</td><td>${esc(a.oldStatus)} → ${esc(a.newStatus)}</td><td>${fmtTime(a.at)}</td></tr>`).join('') || '<tr><td colspan="5">لا سجل</td></tr>'}</tbody></table></div>`;
    }

    return `
      <div class="so-panel-head">
        <div>
          <small class="so-meta">${esc(r.requestId || r.id)} · ${esc(r.requestType || 'Solution Request')}</small>
          <h2>${esc(r.solutionName)}</h2>
          <span class="so-badge">${esc(STATUS_AR[r.status] || r.status)}</span>
        </div>
        <button type="button" class="btn btn-ghost" data-so="view-my">طلباتي</button>
      </div>
      <div class="so-tabs">${tabs.map(([id, label]) => `<button type="button" class="so-tab ${tab === id ? 'on' : ''}" data-so="req-tab" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="cardish">${body}</div>`;
  };

  const renderWizard = () => {
    const w = ui.wizard;
    if (!w) return '';
    const sol = S().getSolution(w.solutionId);
    const step = w.step;
    const isCost = w.mode === 'cost';
    const labels = isCost
      ? ['الشركة', 'نوع المصروفات', 'المبلغ', 'المشكلة', 'الهدف', 'المستندات', 'إرسال']
      : ['الحل', 'العميل', 'الاحتياج', 'النطاق', 'المرفقات', 'مراجعة'];
    let body = '';
    if (!isCost) {
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
          <p class="muted">يمكنك إضافة المزيد لاحقاً من تفاصيل الطلب.</p>
          <ul>${(w.data.attachments || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
          <button type="button" class="btn btn-sm btn-dark" data-so="wiz-add-att">إضافة للقائمة</button>`;
      } else {
        const c = w.data.customer;
        body = `<ul class="so-feed">
          <li><b>الحل:</b> ${esc(sol?.name)}</li>
          <li><b>العميل:</b> ${esc(c.name)} · ${esc(c.company)} · ${esc(c.email)}</li>
          <li><b>الاحتياج:</b> ${esc(w.data.need)}</li>
          <li><b>الأولوية:</b> ${esc(w.data.priority)}</li>
          <li><b>النطاق:</b> ${esc(w.data.scopeType)} ${esc(w.data.scopeDetail)}</li>
          <li><b>المرفقات:</b> ${(w.data.attachments || []).join(', ') || '—'}</li>
          <li><b>الوضع:</b> ${esc(w.mode === 'quote' ? 'طلب عرض سعر' : w.mode === 'consult' ? 'طلب استشارة' : 'اختيار حل')}</li>
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
        body = `<div class="so-checks">${['Invoices', 'Expense Reports', 'Budgets', 'Contracts']
          .map((d) => `<label><input type="checkbox" data-so-doc="${esc(d)}" ${(cm.docs || []).includes(d) ? 'checked' : ''}/> ${d}</label>`)
          .join('')}</div>`;
      } else {
        body = `<ul class="so-feed">
          <li><b>النوع:</b> Cost Reduction Assessment</li>
          <li><b>الشركة:</b> ${esc(w.data.customer.company)} · ${esc(w.data.customer.branch)}</li>
          <li><b>المصروفات:</b> ${(cm.expenseTypes || []).join(', ')}</li>
          <li><b>المبلغ:</b> ${esc(cm.amount)}</li>
          <li><b>الهدف:</b> ${esc(cm.goal)}</li>
          <li><b>المستندات:</b> ${(cm.docs || []).join(', ') || '—'}</li>
        </ul>`;
      }
    }

    return `
      <div class="so-wizard cardish">
        <div class="so-panel-head">
          <h2>${isCost ? 'طلب خفض التكاليف' : w.mode === 'quote' ? 'طلب عرض سعر' : w.mode === 'consult' ? 'طلب استشارة' : 'اختيار حل'}</h2>
          <button type="button" class="btn btn-ghost" data-so="wiz-cancel">إلغاء</button>
        </div>
        <div class="so-steps">${labels.map((l, i) => `<span class="${i + 1 === step ? 'on' : ''}">${i + 1}. ${l}</span>`).join('')}</div>
        <div class="so-wiz-body">${body}</div>
        <div class="so-wiz-foot">
          ${step > 1 ? '<button type="button" class="btn btn-dark" data-so="wiz-prev">السابق</button>' : ''}
          ${step < w.max ? '<button type="button" class="btn btn-primary" data-so="wiz-next">التالي</button>' : '<button type="button" class="btn btn-primary" data-so="wiz-submit"><i class="fas fa-paper-plane"></i> إرسال الطلب</button>'}
        </div>
      </div>`;
  };

  const renderAdmin = () => {
    if (!isStaff()) return `<div class="so-empty">للإدارة فقط</div>`;
    const list = S().listSolutions(true);
    return `
      <div class="so-panel-head">
        <h2>إدارة الحلول</h2>
        <div>
          <button type="button" class="btn btn-primary" data-so="admin-add"><i class="fas fa-plus"></i> إضافة حل</button>
          <button type="button" class="btn btn-ghost" data-so="view-catalog">الكتالوج</button>
        </div>
      </div>
      <div class="so-table-wrap"><table class="so-table">
        <thead><tr><th>ID</th><th>الاسم</th><th>الفئة</th><th>Owner</th><th>CTA</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${list
          .map(
            (s) => `<tr>
              <td><code>${esc(s.id)}</code></td><td>${esc(s.shortName || s.name)}</td><td>${esc(s.category)}</td>
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

  const renderAudit = () => {
    const rows = S().listAudit();
    return `
      <div class="so-panel-head"><h2>سجل العمليات</h2><button type="button" class="btn btn-ghost" data-so="view-catalog">رجوع</button></div>
      <div class="so-table-wrap"><table class="so-table">
        <thead><tr><th>Transaction ID</th><th>Request ID</th><th>Customer</th><th>Solution</th><th>Action</th><th>By</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${rows
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
  };

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
      };
    }
    if (document.getElementById('so-need')) d.need = g('so-need');
    if (document.getElementById('so-priority')) d.priority = g('so-priority');
    if (document.getElementById('so-scope')) d.scopeType = g('so-scope');
    if (document.getElementById('so-scope-detail')) d.scopeDetail = g('so-scope-detail');
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
    readWizardFields();
    const w = ui.wizard;
    const c = w.data.customer;
    if (!c.name || !c.email) {
      toast('الاسم والبريد مطلوبان');
      return;
    }
    if (w.mode !== 'cost' && w.step >= 3 && !w.data.need) {
      toast('وصف الاحتياج مطلوب');
      return;
    }
    const req = S().createRequest(
      {
        solutionId: w.solutionId,
        requestType: w.mode === 'cost' ? 'Cost Reduction Assessment' : w.mode === 'quote' ? 'Quote Request' : w.mode === 'consult' ? 'Consultation Request' : 'Solution Request',
        customer: c,
        need: w.data.need,
        priority: w.data.priority,
        scopeType: w.data.scopeType,
        scopeDetail: w.data.scopeDetail,
        attachments: (w.data.attachments || []).map((name) => ({ name, at: new Date().toISOString(), by: actorName() })),
        costMeta: w.data.costMeta,
      },
      actorName()
    );
    ui.wizard = null;
    ui.requestId = req.id;
    ui.view = 'request';
    ui.detailTab = 'overview';
    toast(`تم إنشاء الطلب ${req.requestId || req.id}`);
  };

  const render = () => {
    const el = root();
    if (!el || !S()) return;
    let main = '';
    if (ui.view === 'catalog') main = renderCatalog();
    else if (ui.view === 'my') main = renderMyRequests();
    else if (ui.view === 'detail') main = renderSolutionDetail();
    else if (ui.view === 'request') main = renderRequestDetail();
    else if (ui.view === 'wizard') main = renderWizard();
    else if (ui.view === 'admin') main = renderAdmin();
    else if (ui.view === 'audit') main = renderAudit();
    else main = renderCatalog();

    el.innerHTML = `
      ${ui.toast ? `<div class="so-toast" role="status">${esc(ui.toast)}</div>` : ''}
      <nav class="so-topnav">
        <button type="button" class="btn btn-sm ${ui.view === 'catalog' ? 'btn-primary' : 'btn-ghost'}" data-so="view-catalog">الكتالوج</button>
        <button type="button" class="btn btn-sm ${ui.view === 'my' ? 'btn-primary' : 'btn-ghost'}" data-so="view-my">طلباتي</button>
        ${isStaff() ? `<button type="button" class="btn btn-sm ${ui.view === 'admin' ? 'btn-primary' : 'btn-ghost'}" data-so="view-admin">إدارة</button>
          <button type="button" class="btn btn-sm ${ui.view === 'audit' ? 'btn-primary' : 'btn-ghost'}" data-so="view-audit">سجل العمليات</button>` : ''}
      </nav>
      ${main}`;
  };

  const onClick = (e) => {
    const btn = e.target.closest('[data-so]');
    if (!btn) return;
    const action = btn.getAttribute('data-so');
    const id = btn.getAttribute('data-id');

    if (action === 'view-catalog') {
      ui.view = 'catalog';
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
      openWizard(id, action === 'choose' ? 'choose' : action);
      return;
    }
    if (action === 'consult-generic') {
      const cost = S().listSolutions().find((s) => s.ctaType === 'Request Consultation') || S().listSolutions()[0];
      if (cost) openWizard(cost.id, 'consult');
      return;
    }
    if (action === 'cost-start') {
      const sol = S().getSolution('SOL-2026-00022') || S().listSolutions().find((s) => s.requestType === 'Cost Reduction Assessment');
      if (sol) openWizard(sol.id, 'cost');
      return;
    }
    if (action === 'open-req') {
      ui.requestId = id;
      ui.view = 'request';
      ui.detailTab = 'overview';
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
      ui.view = 'catalog';
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
      const name = window.prompt('اسم المسؤول (Assigned To)?', 'مستشار الحلول');
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
    S().reload();
    root().addEventListener('click', onClick);
    root().addEventListener('change', onChange);
    root().addEventListener('input', (e) => {
      if (e.target.matches('[data-so-filter="q"]')) {
        ui.filters.q = e.target.value;
        // debounce light
        clearTimeout(ui._q);
        ui._q = setTimeout(render, 180);
      }
    });
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'my') ui.view = 'my';
    if (params.get('cost') === '1') {
      const sol = S().getSolution('SOL-2026-00022');
      if (sol) openWizard(sol.id, 'cost');
      else render();
      return;
    }
    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.HubSolutionsUI = { render, ui, openWizard, mount };
})();
