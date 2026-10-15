/**
 * واجهة موافقات المدير الأعلى — صندوق موافقات مركزي
 */
(() => {
  'use strict';

  const HA = () => window.HubHigherApprovals;
  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      if (window.HubFormat?.formatDateTime) return window.HubFormat.formatDateTime(iso);
      if (window.HubFormat?.dateTime) return window.HubFormat.dateTime(iso);
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      const p = (n) => String(n).padStart(2, '0');
      const h = d.getHours();
      const ap = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(h12)}:${p(d.getMinutes())} ${ap}`;
    } catch {
      return '—';
    }
  };

  const esc = (v = '') =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const ui = {
    tab: 'pending_review',
    q: '',
    sourceFilter: '',
    typeFilter: '',
    priorityFilter: '',
    openId: null,
    modal: null,
  };

  const parseDeepLink = () => {
    try {
      const hash = String(location.hash || '');
      const m = hash.match(/[?&]apr=([^&]+)/);
      if (m) {
        ui.openId = decodeURIComponent(m[1]);
        ui.tab = 'pending_review';
      }
    } catch (_) {}
  };

  const actorOf = (user) => ({
    name: user?.name || user?.email || 'المدير الأعلى',
    email: user?.email || '',
    employeeNo: user?.employeeNo || '',
    naioshId: user?.naioshId || user?.id || '',
    role: user?.role || '',
  });

  const statusBadge = (status) => {
    const ar = HA()?.STATUS_AR?.[status] || status;
    const cls =
      status === 'pending_review'
        ? 'ha-badge is-pending'
        : status === 'under_review'
          ? 'ha-badge is-review'
          : status === 'approved'
            ? 'ha-badge is-ok'
            : status === 'rejected'
              ? 'ha-badge is-bad'
              : 'ha-badge is-warn';
    return `<span class="${cls}">${esc(ar)}</span>`;
  };

  const priorityBadge = (p) => {
    const ar = HA()?.PRIORITY_AR?.[p] || p || 'عادية';
    const cls = p === 'high' ? 'ha-prio is-high' : p === 'low' ? 'ha-prio is-low' : 'ha-prio';
    return `<span class="${cls}">${esc(ar)}</span>`;
  };

  const emptyState = (tab) => {
    const msg =
      tab === 'approved'
        ? 'لا توجد طلبات معتمدة بعد.'
        : tab === 'rejected'
          ? 'لا توجد طلبات مرفوضة.'
          : tab === 'needs_revision'
            ? 'لا توجد طلبات أُعيدت للتعديل.'
            : tab === 'under_review'
              ? 'لا توجد طلبات تحت المراجعة حاليًا.'
              : 'لا توجد طلبات بانتظار موافقتك حاليًا.';
    return `<div class="ha-empty">
      <i class="fas fa-clipboard-check"></i>
      <h3>${esc(msg)}</h3>
      <p>تصل إلى هنا العمليات الحساسة من فريق العمل، منح المنصات، القوى العاملة، الهوية، واستئجار الأنظمة — مع مصدرها وعمليتها بوضوح.</p>
      <p class="ha-empty-hint">إدارة الأدوار تبقى في <a href="#roles-permissions">إدارة فريق العمل والصلاحيات</a> — هذه الصفحة للاعتماد المركزي فقط.</p>
    </div>`;
  };

  const renderKpis = (k) => {
    const cards = [
      { key: 'pending_review', label: 'بانتظار المراجعة', value: k.pending, cls: 'is-pending' },
      { key: 'under_review', label: 'تحت المراجعة', value: k.underReview || 0, cls: 'is-review' },
      { key: 'approved', label: 'تمت الموافقة', value: k.approved, cls: 'is-ok' },
      { key: 'rejected', label: 'مرفوضة', value: k.rejected, cls: 'is-bad' },
      { key: 'needs_revision', label: 'أعيدت للتعديل', value: k.needsRevision, cls: 'is-warn' },
    ];
    return `<div class="ha-kpis">${cards
      .map(
        (c) => `<button type="button" class="ha-kpi ${c.cls} ${ui.tab === c.key ? 'is-active' : ''}" data-action="ha-tab" data-tab="${c.key}">
        <span>${esc(c.label)}</span><strong>${esc(String(c.value))}</strong>
      </button>`
      )
      .join('')}</div>`;
  };

  const TABS = [
    { id: 'pending_review', label: 'بانتظار المراجعة' },
    { id: 'under_review', label: 'تحت المراجعة' },
    { id: 'approved', label: 'تمت الموافقة' },
    { id: 'rejected', label: 'مرفوضة' },
    { id: 'needs_revision', label: 'أعيدت للتعديل' },
    { id: 'all', label: 'جميع الطلبات' },
    { id: 'audit', label: 'سجل الموافقات' },
  ];

  const renderTabs = () =>
    `<div class="ha-tabs" role="tablist">${TABS.map(
      (t) =>
        `<button type="button" class="ha-tab ${ui.tab === t.id ? 'is-active' : ''}" data-action="ha-tab" data-tab="${esc(t.id)}" role="tab">${esc(t.label)}</button>`
    ).join('')}</div>`;

  const filteredRows = () => {
    if (ui.tab === 'audit') return [];
    const opts = {
      q: ui.q,
      sourceModule: ui.sourceFilter || undefined,
      type: ui.typeFilter || undefined,
      priority: ui.priorityFilter || undefined,
    };
    if (ui.tab !== 'all') opts.status = ui.tab;
    return HA().list(opts);
  };

  const sourceOptions = () => {
    const map = HA()?.SOURCE_AR || {};
    return Object.entries(map)
      .map(([k, v]) => `<option value="${esc(k)}" ${ui.sourceFilter === k ? 'selected' : ''}>${esc(v)}</option>`)
      .join('');
  };

  const typeOptions = () => {
    const map = HA()?.TYPE_AR || {};
    return Object.entries(map)
      .map(([k, v]) => `<option value="${esc(k)}" ${ui.typeFilter === k ? 'selected' : ''}>${esc(v)}</option>`)
      .join('');
  };

  const renderTable = (rows, user) => {
    if (!rows.length) return emptyState(ui.tab);
    const canDecideNow = !!HA()?.canDecide?.(actorOf(user));
    return `<div class="ha-table-wrap"><table class="ha-table">
      <thead>
        <tr>
          <th>رقم الطلب</th>
          <th>الطلب</th>
          <th>المصدر</th>
          <th>العملية</th>
          <th>مقدم الطلب</th>
          <th>الجهة / الفرع</th>
          <th>تاريخ الطلب</th>
          <th>الأولوية</th>
          <th>الحالة</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((r) => {
            const orgBranch = [r.org, r.branch].filter(Boolean).join(' · ') || r.workplace || '—';
            const canActRow =
              canDecideNow &&
              (r.status === 'pending_review' || r.status === 'under_review' || r.status === 'needs_revision');
            return `<tr class="${ui.openId === r.id ? 'is-open' : ''}">
            <td><code dir="ltr">${esc(r.id)}</code></td>
            <td><strong class="ha-title">${esc(r.title || r.typeLabel)}</strong>
              <div class="ha-muted">${esc(r.affectedLabel || '')}</div></td>
            <td><span class="ha-source">${esc(r.sourceModuleLabel || r.systemLabel || '—')}</span></td>
            <td>${esc(r.operationLabel || r.typeLabel || '—')}</td>
            <td>${esc(r.requesterName || '—')}
              <div class="ha-muted" dir="ltr">${esc(r.requesterEmployeeNo || r.subjectEmployeeNo || r.requesterNaioshId || '')}</div></td>
            <td>${esc(orgBranch)}</td>
            <td>${esc(fmt(r.createdAt))}</td>
            <td>${priorityBadge(r.priority)}</td>
            <td>${statusBadge(r.status)}</td>
            <td class="ha-row-acts">
              <button type="button" class="btn btn-dark btn-sm" data-action="ha-open" data-id="${esc(r.id)}">عرض</button>
              ${
                canActRow
                  ? `<button type="button" class="btn btn-primary btn-sm" data-action="ha-modal" data-kind="approve" data-id="${esc(r.id)}">موافقة</button>
                     <button type="button" class="btn btn-ghost btn-sm" data-action="ha-modal" data-kind="reject" data-id="${esc(r.id)}">رفض</button>`
                  : ''
              }
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table></div>`;
  };

  const renderAudit = () => {
    const rows = HA().listDecisions();
    if (!rows.length) {
      return `<div class="ha-empty"><p>لا يوجد سجل موافقات بعد.</p></div>`;
    }
    return `<div class="ha-table-wrap"><table class="ha-table">
      <thead>
        <tr>
          <th>رقم الطلب</th>
          <th>المصدر</th>
          <th>العملية</th>
          <th>مقدم الطلب</th>
          <th>من اتخذ القرار</th>
          <th>رقم الموظف</th>
          <th>القرار</th>
          <th>السبب</th>
          <th>قبل</th>
          <th>بعد</th>
          <th>تاريخ القرار</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (d) => `<tr>
            <td><code dir="ltr">${esc(d.requestId)}</code></td>
            <td>${esc(d.sourceModuleLabel || '—')}</td>
            <td>${esc(d.operationLabel || d.typeLabel || '—')}</td>
            <td>${esc(d.requesterName || '—')}</td>
            <td>${esc(d.decidedBy || '—')}</td>
            <td dir="ltr">${esc(d.decidedByEmployeeNo || '—')}</td>
            <td>${esc(d.decisionAr || d.decision)}</td>
            <td class="ha-reason">${esc(d.reason || '—')}</td>
            <td>${esc(HA()?.STATUS_AR?.[d.beforeStatus] || d.beforeStatus || '—')}</td>
            <td>${esc(HA()?.STATUS_AR?.[d.afterStatus] || d.afterStatus || '—')}</td>
            <td>${esc(fmt(d.decidedAt))}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table></div>`;
  };

  const preLines = (text) =>
    esc(text || '—')
      .split('\n')
      .map((l) => l || ' ')
      .join('<br/>');

  const renderDetail = (r, user) => {
    if (!r) return '';
    const canAct =
      (r.status === 'pending_review' || r.status === 'under_review' || r.status === 'needs_revision') &&
      HA()?.canDecide?.(actorOf(user));
    const canResubmit = r.status === 'needs_revision';
    const history = Array.isArray(r.history) ? r.history : [];
    return `<aside class="ha-detail" aria-label="تفاصيل طلب الموافقة">
      <header class="ha-detail-head">
        <div>
          <p class="ha-kicker">تفاصيل طلب الموافقة</p>
          <h2>${esc(r.title || r.typeLabel)} <code dir="ltr">${esc(r.id)}</code></h2>
          ${statusBadge(r.status)} ${priorityBadge(r.priority)}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="ha-close" aria-label="إغلاق">×</button>
      </header>

      <section class="ha-block">
        <h3>بيانات الطلب</h3>
        <div class="ha-detail-grid">
          <div><span>العنوان</span><strong>${esc(r.title || '—')}</strong></div>
          <div><span>نوع الطلب</span><strong>${esc(r.typeLabel || '—')}</strong></div>
          <div><span>العملية</span><strong>${esc(r.operationLabel || '—')}</strong></div>
          <div><span>الأولوية</span><strong>${priorityBadge(r.priority)}</strong></div>
          <div><span>تاريخ الإنشاء</span><strong>${esc(fmt(r.createdAt))}</strong></div>
          <div><span>آخر تحديث</span><strong>${esc(fmt(r.updatedAt))}</strong></div>
        </div>
      </section>

      <section class="ha-block">
        <h3>مصدر الطلب</h3>
        <div class="ha-detail-grid">
          <div><span>المصدر</span><strong>${esc(r.sourceModuleLabel || '—')}</strong></div>
          <div><span>القسم / الوحدة</span><strong>${esc(r.department || '—')}</strong></div>
          <div><span>المؤسسة / الجهة</span><strong>${esc(r.org || r.workplace || '—')}</strong></div>
          <div><span>الفرع</span><strong>${esc(r.branch || '—')}</strong></div>
          <div><span>مرجع المصدر</span><strong dir="ltr">${esc(r.sourceId || '—')}</strong></div>
          <div><span>رابط السجل</span><strong>${
            r.sourceLink ? `<a href="${esc(r.sourceLink)}">فتح المصدر</a>` : '—'
          }</strong></div>
        </div>
      </section>

      <section class="ha-block">
        <h3>بيانات مقدم الطلب</h3>
        <div class="ha-detail-grid">
          <div><span>الاسم</span><strong>${esc(r.requesterName || '—')}</strong></div>
          <div><span>رقم الموظف</span><strong dir="ltr">${esc(r.requesterEmployeeNo || '—')}</strong></div>
          <div><span>رقم نايوش</span><strong dir="ltr">${esc(r.requesterNaioshId || '—')}</strong></div>
          <div><span>البريد</span><strong dir="ltr">${esc(r.requesterEmail || '—')}</strong></div>
          <div><span>الموظف المتأثر</span><strong>${esc(r.subjectName || '—')}</strong></div>
          <div><span>رقم موظف متأثر</span><strong dir="ltr">${esc(r.subjectEmployeeNo || '—')}</strong></div>
        </div>
      </section>

      <section class="ha-block">
        <h3>سبب طلب الموافقة</h3>
        <p>${esc(r.reason || '—')}</p>
        ${r.revisionNote ? `<p class="ha-note"><b>مطلوب تعديله:</b> ${esc(r.revisionNote)}</p>` : ''}
        ${r.rejectReason ? `<p class="ha-note is-bad"><b>سبب الرفض:</b> ${esc(r.rejectReason)}</p>` : ''}
      </section>

      ${
        Array.isArray(r.attachments) && r.attachments.length
          ? `<section class="ha-block" data-ha-attachments>
        <h3>المرفقات</h3>
        ${(() => {
          const list = r.attachments;
          const images = list.filter((a) => a.category === 'image');
          const docs = list.filter((a) => a.category === 'document');
          const videos = list.filter((a) => a.category === 'video');
          const line = (label, items, action) =>
            items.length
              ? `<p><strong>${esc(label)}</strong> ${items.length} —
                  ${items
                    .map(
                      (a) =>
                        `<a href="${esc(
                          a.contentUrl || `/api/hub/register-attachments/${encodeURIComponent(a.id)}/content`
                        )}" target="_blank" rel="noopener" data-ha-attach="${esc(a.category || 'document')}">${esc(
                          a.originalFileName || a.fileName || a.id
                        )}</a>`
                    )
                    .join(' · ')}
                  <span class="ha-attach-action">${esc(action)}</span></p>`
              : '';
          return `${line('الصور', images, 'عرض')}${line('المستندات', docs, 'عرض / تنزيل')}${line('الفيديو', videos, 'مشاهدة')}`;
        })()}
      </section>`
          : ''
      }

      <section class="ha-compare">
        <h3>التغييرات المطلوبة</h3>
        <div class="ha-compare-grid">
          <article>
            <h4>القيمة الحالية</h4>
            <div class="ha-pre">${preLines(r.currentDisplay)}</div>
          </article>
          <article>
            <h4>القيمة المطلوبة</h4>
            <div class="ha-pre">${preLines(r.requestedDisplay)}</div>
          </article>
        </div>
      </section>

      <section class="ha-impact">
        <h3>ماذا سيحدث إذا وافقت؟</h3>
        <p class="ha-impact-ok">${esc(r.impactIfApproved || 'سيتم تنفيذ العملية الأصلية المرتبطة بالطلب.')}</p>
        <h3>ماذا سيحدث إذا رفضت؟</h3>
        <p class="ha-impact-bad">${esc(r.impactIfRejected || 'لن تُنفَّذ العملية وتبقى الحالة كما هي.')}</p>
      </section>

      <section class="ha-block">
        <h3>سجل الإجراءات</h3>
        <ul class="ha-history">
          ${
            history.length
              ? history
                  .map(
                    (h) =>
                      `<li><time>${esc(fmt(h.at))}</time> · <b>${esc(h.by || '—')}</b> · ${esc(h.action)} — ${esc(h.detail || '')}</li>`
                  )
                  .join('')
              : '<li>لا يوجد سجل بعد.</li>'
          }
        </ul>
      </section>

      <div class="ha-actions">
        ${
          canAct
            ? `<button type="button" class="btn btn-primary" data-action="ha-modal" data-kind="approve" data-id="${esc(r.id)}"><i class="fas fa-check"></i> موافقة</button>
               <button type="button" class="btn btn-dark" data-action="ha-modal" data-kind="revise" data-id="${esc(r.id)}"><i class="fas fa-pen"></i> إعادة للتعديل</button>
               <button type="button" class="btn btn-ghost" data-action="ha-modal" data-kind="refer" data-id="${esc(r.id)}"><i class="fas fa-share"></i> إحالة للمختص</button>
               <button type="button" class="btn btn-ghost danger" data-action="ha-modal" data-kind="reject" data-id="${esc(r.id)}"><i class="fas fa-xmark"></i> رفض مع السبب</button>`
            : !HA()?.canDecide?.(actorOf(user))
              ? `<p class="ha-note is-bad">ليست لديك صلاحية اتخاذ قرار على هذا الطلب.</p>`
              : ''
        }
        ${
          canResubmit
            ? `<button type="button" class="btn btn-primary" data-action="ha-resubmit" data-id="${esc(r.id)}"><i class="fas fa-paper-plane"></i> إعادة الإرسال للمراجعة</button>`
            : ''
        }
        ${r.sourceLink ? `<a class="btn btn-ghost" href="${esc(r.sourceLink)}">فتح المصدر</a>` : ''}
      </div>
    </aside>`;
  };

  const renderModal = () => {
    const m = ui.modal;
    if (!m) return '';
    const req = HA().get(m.id);
    if (!req) return '';
    if (m.kind === 'approve') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" data-action="ha-modal-noop">
          <header><h3>تأكيد الموافقة</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <p><b>${esc(req.title || req.typeLabel)}</b> · <code dir="ltr">${esc(req.id)}</code></p>
            <p>المصدر: ${esc(req.sourceModuleLabel || '—')}</p>
            <p class="ha-impact-ok">${esc(req.impactIfApproved || 'سيتم تنفيذ العملية الأصلية فور التأكيد.')}</p>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel" ${m.busy ? 'disabled' : ''}>إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok" ${m.busy ? 'disabled aria-busy="true"' : ''}>${m.busy ? 'جارٍ الحفظ…' : 'تأكيد الموافقة وتنفيذ العملية'}</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'refer') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" data-action="ha-modal-noop">
          <header><h3>إحالة للمختص</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <p><b>${esc(req.title || req.typeLabel)}</b> · <code dir="ltr">${esc(req.id)}</code></p>
            <label>المختص (بريد أو اسم/دور) <span class="req">*</span>
              <input type="text" data-ha-field="value" placeholder="مثال: malika@naiosh.com أو مدير الموارد البشرية" value="${esc(m.value || '')}" ${m.busy ? 'disabled' : ''} />
            </label>
            <label style="display:block;margin-top:10px">ملاحظة الإحالة
              <textarea data-ha-field="note" rows="3" placeholder="سبب الإحالة…" ${m.busy ? 'disabled' : ''}>${esc(m.note || '')}</textarea>
            </label>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel" ${m.busy ? 'disabled' : ''}>إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok" ${m.busy ? 'disabled aria-busy="true"' : ''}>${m.busy ? 'جارٍ الحفظ…' : 'تأكيد الإحالة'}</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'reject') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" data-action="ha-modal-noop">
          <header><h3>رفض الطلب</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <p class="ha-impact-bad">${esc(req.impactIfRejected || 'لن تُنفَّذ العملية.')}</p>
            <label>سبب الرفض <span class="req">*</span>
              <textarea data-ha-field="value" rows="4" placeholder="اكتب سبب الرفض بوضوح…" ${m.busy ? 'disabled' : ''}>${esc(m.value || '')}</textarea>
            </label>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel" ${m.busy ? 'disabled' : ''}>إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok" ${m.busy ? 'disabled aria-busy="true"' : ''}>${m.busy ? 'جارٍ الحفظ…' : 'تأكيد الرفض'}</button>
          </footer>
        </div>
      </div>`;
    }
    if (m.kind === 'revise') {
      return `<div class="ha-modal-backdrop" data-action="ha-modal-cancel">
        <div class="ha-modal" role="dialog" aria-modal="true" data-action="ha-modal-noop">
          <header><h3>طلب تعديل</h3><button type="button" class="ha-modal-x" data-action="ha-modal-cancel">×</button></header>
          <div class="ha-modal-body">
            <label>ما المطلوب تعديله؟ <span class="req">*</span>
              <textarea data-ha-field="value" rows="4" placeholder="اكتب التعديل المطلوب بوضوح…" ${m.busy ? 'disabled' : ''}>${esc(m.value || '')}</textarea>
            </label>
            ${m.error ? `<p class="ha-error">${esc(m.error)}</p>` : ''}
          </div>
          <footer>
            <button type="button" class="btn btn-ghost" data-action="ha-modal-cancel" ${m.busy ? 'disabled' : ''}>إلغاء</button>
            <button type="button" class="btn btn-primary" data-action="ha-modal-ok" ${m.busy ? 'disabled aria-busy="true"' : ''}>${m.busy ? 'جارٍ الحفظ…' : 'إرسال طلب التعديل'}</button>
          </footer>
        </div>
      </div>`;
    }
    return '';
  };

  const render = (ctx = {}) => {
    parseDeepLink();
    HA()?.reload?.();
    // Kick durable hydrate; re-render when server state arrives.
    if (!ui._hydrateKick) {
      ui._hydrateKick = true;
      Promise.resolve(window.HubPlatformGrants?.hydrate?.())
        .then(() => HA()?.hydrateFromServer?.({ force: true, backfill: true }))
        .then(() => {
          window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
        })
        .catch(() => {})
        .finally(() => {
          ui._hydrateKick = false;
        });
    }
    const user = ctx.user || window.HubAuth?.getUser?.() || {};
    const k = HA()?.kpis?.() || { pending: 0, underReview: 0, approved: 0, rejected: 0, needsRevision: 0, all: 0 };
    const rows = filteredRows();
    const open = ui.openId ? HA().get(ui.openId) : null;
    return `<div class="hub-ops-ws hub-ha-ws">
      <header class="ha-header">
        <div>
          <p class="ha-kicker"><i class="fas fa-user-shield"></i> صندوق الموافقات المركزي</p>
          <h1>موافقات المدير الأعلى</h1>
          <p class="ha-sub">مراجعة واعتماد العمليات الحساسة القادمة من أنظمة NAIOSH HUB — مع معرفة المصدر والعملية قبل القرار.</p>
        </div>
        <div class="ha-header-actions">
          <button type="button" class="btn btn-dark btn-sm" data-action="ha-refresh"><i class="fas fa-rotate"></i> تحديث</button>
          <a class="btn btn-ghost btn-sm" href="#roles-permissions"><i class="fas fa-shield-halved"></i> فريق العمل والصلاحيات</a>
        </div>
      </header>
      ${renderKpis(k)}
      ${renderTabs()}
      ${
        ui.tab !== 'audit'
          ? `<div class="ha-toolbar">
              <input type="search" placeholder="بحث برقم الطلب، مقدم الطلب، رقم نايوش، رقم الموظف، المصدر، العملية" value="${esc(ui.q)}" data-ha-q />
              <select data-ha-source>
                <option value="">كل المصادر</option>
                ${sourceOptions()}
              </select>
              <select data-ha-type>
                <option value="">كل العمليات</option>
                ${typeOptions()}
              </select>
              <select data-ha-priority>
                <option value="">كل الأولويات</option>
                <option value="high" ${ui.priorityFilter === 'high' ? 'selected' : ''}>مرتفعة</option>
                <option value="normal" ${ui.priorityFilter === 'normal' ? 'selected' : ''}>عادية</option>
                <option value="low" ${ui.priorityFilter === 'low' ? 'selected' : ''}>منخفضة</option>
              </select>
              <button type="button" class="btn btn-dark btn-sm" data-action="ha-search"><i class="fas fa-magnifying-glass"></i> تصفية</button>
            </div>`
          : ''
      }
      <div class="ha-layout ${open ? 'has-detail' : ''}">
        <div class="ha-main">${ui.tab === 'audit' ? renderAudit() : renderTable(rows, user)}</div>
        ${open ? renderDetail(open, user) : ''}
      </div>
      ${renderModal()}
    </div>`;
  };

  const readModalField = () => {
    const el = document.querySelector('.ha-modal [data-ha-field="value"]');
    return el ? el.value : ui.modal?.value || '';
  };

  const handle = (action, btn, ctx = {}) => {
    const { toast, user } = ctx;
    const actor = actorOf(user);

    if (action === 'ha-tab') {
      ui.tab = btn.dataset.tab || 'pending_review';
      ui.openId = null;
      return true;
    }
    if (action === 'ha-refresh') {
      toast?.('جارٍ التحديث من السيرفر…');
      Promise.resolve(window.HubPlatformGrants?.hydrate?.())
        .then(() => HA()?.hydrateFromServer?.({ force: true, backfill: true }))
        .then(() => {
          HA()?.reload?.();
          window.dispatchEvent(new CustomEvent('hub-ha-rerender'));
          toast?.('تم التحديث من السجل المركزي');
        })
        .catch(() => {
          HA()?.reload?.();
          toast?.('تعذر التحديث الكامل — عُرضت النسخة المحلية');
        });
      return true;
    }
    if (action === 'ha-search') {
      const inp = document.querySelector('[data-ha-q]');
      ui.q = inp?.value || '';
      ui.sourceFilter = document.querySelector('[data-ha-source]')?.value || '';
      ui.typeFilter = document.querySelector('[data-ha-type]')?.value || '';
      ui.priorityFilter = document.querySelector('[data-ha-priority]')?.value || '';
      return true;
    }
    if (action === 'ha-open') {
      ui.openId = btn.dataset.id;
      HA()?.startReview?.(ui.openId, actor);
      return true;
    }
    if (action === 'ha-close') {
      ui.openId = null;
      return true;
    }
    if (action === 'ha-modal') {
      ui.modal = { kind: btn.dataset.kind, id: btn.dataset.id, value: '', error: '' };
      return true;
    }
    if (action === 'ha-modal-cancel') {
      ui.modal = null;
      return true;
    }
    // Absorb clicks on the dialog panel so they do not hit the backdrop cancel.
    // Return false so dashboard does NOT re-render (avoids wiping in-progress form fields
    // and avoids affecting other dashboard panels). Scoped to HA modal only.
    if (action === 'ha-modal-noop') {
      return false;
    }
    if (action === 'ha-modal-ok') {
      return (async () => {
        const m = ui.modal;
        if (!m) return true;
        if (m.busy) return true; // ignore double / rapid confirm clicks
        if (!HA()?.canDecide?.(actor) && ['approve', 'reject', 'revise', 'refer'].includes(m.kind)) {
          ui.modal = { ...m, error: 'ليست لديك صلاحية اعتماد/رفض طلبات المدير الأعلى' };
          return true;
        }
        const value = readModalField();
        const noteEl = document.querySelector('.ha-modal [data-ha-field="note"]');
        const note = noteEl ? noteEl.value : m.note || '';
        ui.modal = { ...m, value, note, busy: true, error: '' };
        // Disable confirm button immediately (before await) to prevent double execute
        try {
          document.querySelectorAll('.ha-modal [data-action="ha-modal-ok"]').forEach((b) => {
            b.disabled = true;
            b.setAttribute('aria-busy', 'true');
          });
        } catch (_) {}
        let res;
        try {
          if (m.kind === 'approve') res = await HA().approve(m.id, actor, value);
          else if (m.kind === 'reject') res = await HA().reject(m.id, value, actor);
          else if (m.kind === 'revise') res = await HA().requestRevision(m.id, value, actor);
          else if (m.kind === 'refer') res = await HA().refer(m.id, value, actor, note);
          else res = { ok: false, error: 'نوع قرار غير معروف' };
        } catch (e) {
          res = { ok: false, error: e?.message || 'تعذر إكمال العملية' };
        }
        // Never toast success unless the durable call explicitly succeeded
        if (!res || res.ok === false) {
          ui.modal = {
            ...m,
            value,
            note,
            busy: false,
            error: (res && res.error) || 'تعذر حفظ القرار — لم يُنفَّذ أي تغيير',
          };
          return true;
        }
        ui.modal = null;
        ui.openId = m.id;
        toast?.(
          m.kind === 'approve'
            ? 'تمت الموافقة وتنفيذ العملية'
            : m.kind === 'reject'
              ? 'تم الرفض'
              : m.kind === 'refer'
                ? 'تمت الإحالة للمختص'
                : 'أُعيد للتعديل'
        );
        await HA()?.hydrateFromServer?.({ force: true });
        return true;
      })();
    }
    if (action === 'ha-resubmit') {
      const res = HA().resubmit(btn.dataset.id, {}, actor);
      if (!res.ok) toast?.(res.error || 'تعذر إعادة الإرسال');
      else toast?.('أُعيد إرسال الطلب للمراجعة');
      return true;
    }
    return false;
  };

  window.HubHigherApprovalsUI = { render, handle, getUi: () => ui };
  window.HubRentAdminWS = {
    render: (ctx) => window.HubHigherApprovalsUI.render(ctx),
    handle: (action, btn, ctx) => window.HubHigherApprovalsUI.handle(action, btn, ctx),
  };
})();
