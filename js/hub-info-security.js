/**
 * NAIOSH HUB 360 — لوحة أمن المعلومات (vanilla IIFE)
 * يعتمد على HubStore.infoSecurity والعمليات الأمنية المركزية
 */
(() => {
  'use strict';

  const PAGE_SIZE = 8;
  const INC_STATUSES = ['جديد', 'قيد التحقيق', 'قيد المعالجة', 'تم الاحتواء', 'مغلق', 'مسودة'];
  const INC_SEVERITIES = ['حرج', 'مرتفع', 'متوسط', 'منخفض'];
  const INC_TYPES = [
    'محاولة اختراق',
    'تصيد إلكتروني',
    'Malware',
    'Ransomware',
    'تسريب بيانات',
    'وصول غير مصرح',
    'فقدان بيانات',
    'إساءة استخدام صلاحيات',
    'انقطاع خدمة أمني',
    'أخرى',
  ];
  const INC_SOURCES = [
    'إدخال يدوي',
    'موظف / بلاغ داخلي',
    'SIEM',
    'SOC',
    'EDR',
    'Firewall',
    'Email Security',
    'Integration / API',
    'أخرى',
  ];
  const CTRL_STATUSES = [
    { v: 'implemented', l: 'مُطبّق' },
    { v: 'partial', l: 'جزئي' },
    { v: 'needs_review', l: 'يحتاج مراجعة' },
    { v: 'not_implemented', l: 'غير مُطبّق' },
  ];
  const CTRL_FRAMEWORKS = ['ISO 27001', 'NIST', 'Internal Control', 'SOC 2'];
  const RISK_STATUSES = ['مفتوح', 'قيد المعالجة', 'مغلق', 'مقبول'];

  const ui = {
    tab: 'overview',
    modal: null,
    drawer: null,
    exportOpen: false,
    confirm: null,
    loading: false,
    error: '',
    page: 1,
    sort: 'date_desc',
    filters: {
      incidentQ: '',
      incidentStatus: '',
      incidentSeverity: '',
      incidentDept: '',
      incidentType: '',
      incidentOwner: '',
      incidentSource: '',
      incidentFrom: '',
      incidentTo: '',
      controlQ: '',
      controlStatus: '',
      riskQ: '',
      riskLevel: '',
      auditQ: '',
    },
    report: null,
    kpiFocus: '',
    drawerSection: 'summary',
    incidentForm: null,
    controlForm: null,
    riskForm: null,
    closeForm: null,
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(iso);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(iso);
    }
  };

  const bar = (pct) => {
    const n = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="bar" aria-hidden="true"><i style="width:${n}%"></i></div>`;
  };

  const store = () => window.HubStore;
  const secData = () => {
    store()?.recomputeInfoSecurityKpis?.();
    return store()?.get?.()?.infoSecurity || { controls: [], incidents: [], risks: [], auditLog: [], notifications: [] };
  };

  const actorName = (user) => user?.name || user?.email || user?.displayName || 'مشغّل هوب';

  const permLevel = (user) => {
    const role = String(user?.role || '').toLowerCase();
    if (['supreme_leader', 'admin', 'security_admin'].includes(role)) return 'security_admin';
    if (['chief_engineer', 'security_officer'].includes(role)) return 'security_officer';
    if (['department_manager', 'manager'].includes(role)) return 'department_manager';
    if (['auditor', 'audit'].includes(role)) return 'auditor';
    if (['employee', 'user'].includes(role)) return 'employee';
    return 'security_admin';
  };

  const can = (user, cap) => {
    const p = permLevel(user);
    const matrix = {
      security_admin: true,
      security_officer: !['archive_incident', 'archive_control', 'archive_risk'].includes(cap),
      department_manager: ['view', 'export', 'mark_notice', 'print', 'create_incident', 'create_report'].includes(cap),
      employee: ['view', 'mark_notice', 'create_incident'].includes(cap),
      auditor: ['view', 'export', 'mark_notice', 'print', 'create_report', 'audit_view'].includes(cap),
    };
    if (cap === 'view' || cap === 'mark_notice') return true;
    if (p === 'security_admin') return true;
    if (typeof matrix[p] === 'boolean') return matrix[p];
    return !!matrix[p];
  };

  const badgeClass = (kind, value) => {
    const v = String(value || '');
    const maps = {
      severity: { حرج: 'badge-red', مرتفع: 'badge-red', متوسط: 'badge-gray', منخفض: 'badge-outline' },
      status: {
        جديد: 'badge-red',
        'قيد التحقيق': 'badge-red',
        'قيد المعالجة': 'badge-gray',
        'تم الاحتواء': 'badge-gray',
        مغلق: 'badge-black',
        مسودة: 'badge-outline',
        implemented: 'badge-black',
        partial: 'badge-gray',
        needs_review: 'badge-red',
        not_implemented: 'badge-outline',
        مفتوح: 'badge-red',
        'قيد المعالجة': 'badge-gray',
      },
      level: { حرج: 'badge-red', مرتفع: 'badge-red', متوسط: 'badge-gray', منخفض: 'badge-outline' },
      sla: { breached: 'badge-red', ok: 'badge-black', warn: 'badge-gray' },
      source: { SIEM: 'badge-black', EDR: 'badge-black', 'Email Security': 'badge-gray', 'إدخال يدوي': 'badge-outline' },
    };
    const m = maps[kind] || {};
    return m[v] || 'badge-outline';
  };

  const badge = (text, kind = 'status') =>
    `<span class="badge ${badgeClass(kind, text)}">${esc(text)}</span>`;

  const sourceBadge = (src) => {
    const s = src || '—';
    return `<span class="badge ${badgeClass('source', s)}">${esc(s)}</span>`;
  };

  const slaState = (inc) => {
    if (!inc || inc.status === 'مغلق' || inc.status === 'closed') return { key: 'ok', label: 'مغلق' };
    const due = inc.slaDueAt ? new Date(inc.slaDueAt).getTime() : 0;
    if (!due) return { key: 'warn', label: 'بدون SLA' };
    const now = Date.now();
    if (now > due) return { key: 'breached', label: 'تجاوز SLA' };
    const hrs = (due - now) / 3600000;
    if (hrs < 2) return { key: 'warn', label: `متبقٍ ${Math.ceil(hrs)}س` };
    return { key: 'ok', label: `SLA ${inc.slaHours || '—'}س` };
  };

  const slaBadge = (inc) => {
    const st = slaState(inc);
    return `<span class="badge ${badgeClass('sla', st.key)}">${esc(st.label)}</span>`;
  };

  const ctrlStatusLabel = (st) => CTRL_STATUSES.find((x) => x.v === st)?.l || st;

  const openIncidents = (sec) =>
    (sec.incidents || []).filter((i) => !i.archived && !i.draft && i.status !== 'مغلق' && i.status !== 'closed');

  const actionNeeded = (sec) => {
    const items = [];
    openIncidents(sec).forEach((i) => {
      const sla = slaState(i);
      if (sla.key === 'breached') items.push({ type: 'incident', id: i.id, text: `تجاوز SLA: ${i.id}`, severity: 'حرج' });
      else if (i.severity === 'حرج') items.push({ type: 'incident', id: i.id, text: `حادث حرج: ${i.title}`, severity: 'حرج' });
    });
    (sec.controls || [])
      .filter((c) => !c.archived && (c.status === 'needs_review' || c.status === 'partial'))
      .forEach((c) => items.push({ type: 'control', id: c.id, text: `ضابط يحتاج متابعة: ${c.name}`, severity: 'متوسط' }));
    (sec.risks || [])
      .filter((r) => !r.archived && r.level === 'حرج' && r.status !== 'مغلق')
      .forEach((r) => items.push({ type: 'risk', id: r.id, text: `خطر حرج: ${r.name}`, severity: 'حرج' }));
    (sec.notifications || [])
      .filter((n) => !n.read)
      .slice(0, 3)
      .forEach((n) => items.push({ type: 'notice', id: n.id, text: n.title, severity: 'متوسط' }));
    return items.slice(0, 12);
  };

  const sortIncidents = (list) => {
    const arr = [...list];
    const sevRank = { حرج: 4, مرتفع: 3, متوسط: 2, منخفض: 1 };
    switch (ui.sort) {
      case 'severity_desc':
        arr.sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0));
        break;
      case 'status_asc':
        arr.sort((a, b) => String(a.status).localeCompare(String(b.status), 'ar'));
        break;
      case 'date_asc':
        arr.sort((a, b) => new Date(a.discoveredAt || a.createdAt) - new Date(b.discoveredAt || b.createdAt));
        break;
      default:
        arr.sort((a, b) => new Date(b.discoveredAt || b.createdAt) - new Date(a.discoveredAt || a.createdAt));
    }
    return arr;
  };

  const filterIncidents = (sec) => {
    const f = ui.filters;
    return (sec.incidents || []).filter((i) => {
      if (i.archived) return false;
      if (f.incidentStatus && i.status !== f.incidentStatus) return false;
      if (f.incidentSeverity && i.severity !== f.incidentSeverity) return false;
      if (f.incidentDept && i.department !== f.incidentDept) return false;
      if (f.incidentType && i.type !== f.incidentType) return false;
      if (f.incidentOwner && i.owner !== f.incidentOwner) return false;
      if (f.incidentSource && i.source !== f.incidentSource) return false;
      if (f.incidentFrom && new Date(i.discoveredAt) < new Date(f.incidentFrom)) return false;
      if (f.incidentTo && new Date(i.discoveredAt) > new Date(f.incidentTo + 'T23:59:59')) return false;
      if (ui.kpiFocus === 'closed') {
        const d = new Date(i.closedAt || 0);
        const now = new Date();
        if (i.status !== 'مغلق' || d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }
      if (f.incidentQ) {
        const hay = `${i.id} ${i.title} ${i.type} ${i.owner} ${(i.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(f.incidentQ.toLowerCase())) return false;
      }
      return true;
    });
  };

  const filterControls = (sec) => {
    const f = ui.filters;
    return (sec.controls || []).filter((c) => {
      if (c.archived) return false;
      if (f.controlStatus && c.status !== f.controlStatus) return false;
      if (f.controlQ) {
        const hay = `${c.id} ${c.name} ${c.framework} ${c.owner}`.toLowerCase();
        if (!hay.includes(f.controlQ.toLowerCase())) return false;
      }
      return true;
    });
  };

  const filterRisks = (sec) => {
    const f = ui.filters;
    return (sec.risks || []).filter((r) => {
      if (r.archived) return false;
      if (f.riskLevel && r.level !== f.riskLevel) return false;
      if (f.riskQ) {
        const hay = `${r.id} ${r.name} ${r.category} ${r.owner}`.toLowerCase();
        if (!hay.includes(f.riskQ.toLowerCase())) return false;
      }
      return true;
    });
  };

  const paginate = (arr) => {
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    const start = (ui.page - 1) * PAGE_SIZE;
    return { rows: arr.slice(start, start + PAGE_SIZE), total, pages };
  };

  const kpiDelta = (cur, prev) => {
    const c = Number(cur) || 0;
    const p = Number(prev) || 0;
    const d = c - p;
    if (!d) return '<small>بدون تغيّر</small>';
    const sign = d > 0 ? '+' : '';
    const cls = d > 0 ? 'badge-black' : 'badge-red';
    return `<small><span class="badge ${cls}">${sign}${d}</span> عن الفترة السابقة</small>`;
  };

  const renderKpis = (sec, user) => {
    const kpis = [
      { key: 'score', label: 'درجة الأمان', value: `${sec.score ?? '—'}%`, hint: 'Security Score', prev: sec.prevScore },
      { key: 'mfa', label: 'نسبة تطبيق MFA', value: `${sec.mfaCoverage ?? '—'}%`, hint: 'Multi-factor', prev: sec.prevMfaCoverage },
      { key: 'open', label: 'الحوادث المفتوحة', value: sec.openIncidents ?? 0, hint: 'Open incidents', prev: null },
      { key: 'controls', label: 'الضوابط الأمنية النشطة', value: sec.activeControls ?? 0, hint: 'Active controls', prev: null },
      { key: 'critical', label: 'المخاطر الحرجة', value: sec.criticalRisks ?? 0, hint: 'Critical risks', prev: null },
      { key: 'closed', label: 'المغلقة هذا الشهر', value: sec.closedThisMonth ?? 0, hint: 'Closed this month', prev: sec.prevClosedThisMonth },
    ];
    return `<div class="kpi-grid" data-sec-kpis>
      ${kpis
        .map(
          (k) => `<article class="kpi ${ui.kpiFocus === k.key ? 'is-focus' : ''}" data-action="sec-kpi-focus" data-kpi="${esc(k.key)}" role="button" tabindex="0">
        <span>${esc(k.label)}</span>
        <strong>${esc(String(k.value))}</strong>
        ${k.prev != null ? kpiDelta(Number(String(k.value).replace('%', '')), k.prev) : `<small>${esc(k.hint)}</small>`}
      </article>`
        )
        .join('')}
    </div>`;
  };

  const renderNotifications = (sec, user) => {
    const notes = (sec.notifications || []).slice(0, 8);
    if (!notes.length) return '';
    return `<div class="card" style="margin-bottom:12px" data-sec-notices>
      <h3><span class="title-left"><i class="fas fa-bell icon"></i> تنبيهات أمن المعلومات</span></h3>
      <div class="toolbar">
        ${notes
          .map(
            (n) => `<div class="field" style="flex:1;min-width:200px;padding:8px;border:1px solid rgba(0,0,0,.08);border-radius:8px;${n.read ? 'opacity:.65' : ''}">
          <strong>${esc(n.title)}</strong>
          <div style="font-size:.85rem;margin-top:4px">${esc(n.body)}</div>
          <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <small>${esc(fmtTime(n.at))}</small>
            ${n.linkId ? `<button type="button" class="btn btn-sm btn-ghost" data-action="sec-open-link" data-link-type="${esc(n.type)}" data-id="${esc(n.linkId)}">فتح</button>` : ''}
            ${!n.read ? `<button type="button" class="btn btn-sm btn-dark" data-action="sec-notice-read" data-id="${esc(n.id)}">تعليم كمقروء</button>` : ''}
          </div>
        </div>`
          )
          .join('')}
      </div>
    </div>`;
  };

  const renderCharts = (sec) => {
    const incBySev = INC_SEVERITIES.map((s) => ({
      s,
      n: (sec.incidents || []).filter((i) => !i.archived && i.severity === s).length,
    }));
    const maxInc = Math.max(1, ...incBySev.map((x) => x.n));
    const ctrlAvg = (sec.controls || []).filter((c) => !c.archived);
    const frameworks = [...new Set(ctrlAvg.map((c) => c.framework))];
    return `<div class="grid-2" style="margin-top:12px">
      <article class="card">
        <h3><span class="title-left"><i class="fas fa-chart-column icon"></i> الحوادث حسب الخطورة</span></h3>
        ${incBySev
          .map(
            (x) => `<div style="display:flex;align-items:center;gap:8px;margin:8px 0">
          <span style="width:72px">${esc(x.s)}</span>
          ${bar((x.n / maxInc) * 100)}
          <strong>${x.n}</strong>
        </div>`
          )
          .join('')}
      </article>
      <article class="card">
        <h3><span class="title-left"><i class="fas fa-shield icon"></i> الامتثال حسب الإطار</span></h3>
        ${frameworks
          .map((fw) => {
            const rows = ctrlAvg.filter((c) => c.framework === fw);
            const avg = rows.length ? Math.round(rows.reduce((a, c) => a + Number(c.compliance || 0), 0) / rows.length) : 0;
            return `<div style="display:flex;align-items:center;gap:8px;margin:8px 0">
              <span style="width:100px">${esc(fw)}</span>
              ${bar(avg)}
              <strong>${avg}%</strong>
            </div>`;
          })
          .join('') || '<p class="empty">لا توجد بيانات.</p>'}
      </article>
    </div>`;
  };

  const renderOverview = (sec, user) => {
    const needed = actionNeeded(sec);
    const recent = sortIncidents((sec.incidents || []).filter((i) => !i.archived)).slice(0, 5);
    const controls = (sec.controls || []).filter((c) => !c.archived).slice(0, 6);
    const topRisks = [...(sec.risks || [])]
      .filter((r) => !r.archived)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    return `
      ${ui.kpiFocus ? `<p class="empty" style="margin:8px 0">تركيز KPI: <strong>${esc(ui.kpiFocus)}</strong> — <button type="button" class="btn btn-sm btn-ghost" data-action="sec-kpi-clear">إزالة التركيز</button></p>` : ''}
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-bolt icon"></i> إجراء مطلوب الآن</span></h3>
          ${
            needed.length
              ? `<ul style="margin:0;padding-right:18px">${needed
                  .map(
                    (a) => `<li style="margin:6px 0">${badge(a.severity, 'severity')} ${esc(a.text)}
                <button type="button" class="btn btn-sm btn-primary" data-action="sec-action-item" data-type="${esc(a.type)}" data-id="${esc(a.id)}">معالجة</button></li>`
                  )
                  .join('')}</ul>`
              : '<p class="empty">لا توجد عناصر عاجلة — الوضع مستقر.</p>'
          }
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-clipboard-check icon"></i> ملخص الامتثال</span></h3>
          <p>متوسط امتثال الضوابط: <strong>${sec.compliancePct ?? '—'}%</strong></p>
          ${bar(sec.compliancePct || 0)}
          <p style="margin-top:12px">حوادث أُغلقت هذا الشهر: <strong>${sec.closedThisMonth ?? 0}</strong></p>
          ${kpiDelta(sec.closedThisMonth, sec.prevClosedThisMonth)}
        </article>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-triangle-exclamation icon"></i> أحدث الحوادث</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>المعرّف</th><th>العنوان</th><th>الخطورة</th><th>SLA</th></tr></thead>
            <tbody>
              ${recent
                .map(
                  (i) => `<tr data-action="sec-incident-row" data-id="${esc(i.id)}" style="cursor:pointer">
                  <td>${esc(i.id)}</td>
                  <td>${esc(i.title)}</td>
                  <td>${badge(i.severity, 'severity')}</td>
                  <td>${slaBadge(i)}</td>
                </tr>`
                )
                .join('') || '<tr><td colspan="4" class="empty">لا حوادث.</td></tr>'}
            </tbody>
          </table></div>
          <button type="button" class="btn btn-sm btn-ghost" data-action="sec-tab" data-tab="incidents">عرض كل الحوادث</button>
        </article>
        <article class="card">
          <h3><span class="title-left"><i class="fas fa-shield-halved icon"></i> الضوابط الرئيسية</span></h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>الضابط</th><th>الامتثال</th><th>الحالة</th></tr></thead>
            <tbody>
              ${controls
                .map(
                  (c) => `<tr>
                  <td><strong>${esc(c.name)}</strong></td>
                  <td>${c.compliance}% ${bar(c.compliance)}</td>
                  <td>${badge(ctrlStatusLabel(c.status))}</td>
                </tr>`
                )
                .join('') || '<tr><td colspan="3" class="empty">لا ضوابط.</td></tr>'}
            </tbody>
          </table></div>
        </article>
      </div>
      <article class="card" style="margin-top:12px">
        <h3><span class="title-left"><i class="fas fa-fire icon"></i> أعلى المخاطر</span></h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>الخطر</th><th>الدرجة</th><th>المستوى</th><th>المالك</th></tr></thead>
          <tbody>
            ${topRisks
              .map(
                (r) => `<tr data-action="sec-risk-row" data-id="${esc(r.id)}" style="cursor:pointer">
                <td>${esc(r.name)}</td>
                <td>${r.score}</td>
                <td>${badge(r.level, 'level')}</td>
                <td>${esc(r.owner)}</td>
              </tr>`
              )
              .join('') || '<tr><td colspan="4" class="empty">لا مخاطر.</td></tr>'}
          </tbody>
        </table></div>
      </article>
      ${renderCharts(sec)}
    `;
  };

  const renderIncidentToolbar = (sec, user) => {
    const depts = sec.departments || [];
    const owners = [...new Set((sec.people || []).concat((sec.incidents || []).map((i) => i.owner)).filter(Boolean))];
    return `<div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <label class="field">بحث
        <input type="search" data-sec-change="incidentQ" value="${esc(ui.filters.incidentQ)}" placeholder="رقم / عنوان / وسم…" />
      </label>
      <label class="field">الحالة
        <select data-sec-change="incidentStatus">
          <option value="">الكل</option>
          ${INC_STATUSES.map((s) => `<option value="${esc(s)}" ${ui.filters.incidentStatus === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </label>
      <label class="field">الخطورة
        <select data-sec-change="incidentSeverity">
          <option value="">الكل</option>
          ${INC_SEVERITIES.map((s) => `<option value="${esc(s)}" ${ui.filters.incidentSeverity === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </label>
      <label class="field">نوع الحادث
        <select data-sec-change="incidentType">
          <option value="">الكل</option>
          ${INC_TYPES.map((s) => `<option value="${esc(s)}" ${ui.filters.incidentType === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </label>
      <label class="field">المسؤول
        <select data-sec-change="incidentOwner">
          <option value="">الكل</option>
          ${owners.map((d) => `<option value="${esc(d)}" ${ui.filters.incidentOwner === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
        </select>
      </label>
      <label class="field">المصدر
        <select data-sec-change="incidentSource">
          <option value="">الكل</option>
          ${INC_SOURCES.map((s) => `<option value="${esc(s)}" ${ui.filters.incidentSource === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </label>
      <label class="field">الإدارة
        <select data-sec-change="incidentDept">
          <option value="">الكل</option>
          ${depts.map((d) => `<option value="${esc(d)}" ${ui.filters.incidentDept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
        </select>
      </label>
      <label class="field">من
        <input type="date" data-sec-change="incidentFrom" value="${esc(ui.filters.incidentFrom)}" />
      </label>
      <label class="field">إلى
        <input type="date" data-sec-change="incidentTo" value="${esc(ui.filters.incidentTo)}" />
      </label>
      <label class="field">ترتيب
        <select data-sec-change="sort">
          <option value="date_desc" ${ui.sort === 'date_desc' ? 'selected' : ''}>الأحدث</option>
          <option value="date_asc" ${ui.sort === 'date_asc' ? 'selected' : ''}>الأقدم</option>
          <option value="severity_desc" ${ui.sort === 'severity_desc' ? 'selected' : ''}>الخطورة</option>
          <option value="status_asc" ${ui.sort === 'status_asc' ? 'selected' : ''}>الحالة</option>
        </select>
      </label>
      ${can(user, 'create_incident') ? `<button type="button" class="btn btn-primary" data-action="sec-modal" data-modal="incident_new">+ تسجيل حادث أمني</button>` : ''}
    </div>`;
  };

  const renderIncidents = (sec, user) => {
    const filtered = sortIncidents(filterIncidents(sec));
    const { rows, total, pages } = paginate(filtered);
    return `
      ${renderIncidentToolbar(sec, user)}
      <div class="table-wrap"><table class="data">
        <thead><tr><th>المعرّف</th><th>العنوان</th><th>النوع</th><th>الخطورة</th><th>الحالة</th><th>المصدر</th><th>SLA</th><th>المالك</th><th></th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((i) => {
                    const acts = [];
                    acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="sec-drawer" data-id="${esc(i.id)}">تفاصيل</button>`);
                    if (can(user, 'update_incident') && i.status !== 'مغلق') {
                      acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="sec-modal" data-modal="close_incident" data-id="${esc(i.id)}">إغلاق</button>`);
                    }
                    if (can(user, 'archive_incident') && i.status === 'مغلق') {
                      acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="sec-confirm" data-kind="archive_incident" data-id="${esc(i.id)}">أرشفة</button>`);
                    }
                    return `<tr>
                    <td>${esc(i.id)}</td>
                    <td><strong>${esc(i.title)}</strong>${i.sensitiveData ? ' 🔒' : ''}</td>
                    <td>${esc(i.type)}</td>
                    <td>${badge(i.severity, 'severity')}</td>
                    <td>${badge(i.status)}</td>
                    <td>${sourceBadge(i.source)}</td>
                    <td>${slaBadge(i)}</td>
                    <td>${esc(i.owner || '—')}</td>
                    <td style="white-space:nowrap">${acts.join(' ')}</td>
                  </tr>`;
                  })
                  .join('')
              : `<tr><td colspan="9" class="empty">لا توجد حوادث أمنية مسجلة حالياً<br/>
                  ${can(user, 'create_incident') ? `<button type="button" class="btn btn-primary" style="margin-top:10px" data-action="sec-modal" data-modal="incident_new">تسجيل أول حادث أمني</button>` : ''}
                </td></tr>`
          }
        </tbody>
      </table></div>
      <div class="toolbar" style="justify-content:space-between;margin-top:8px">
        <span>الإجمالي: ${total}</span>
        <span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="sec-page" data-dir="prev" ${ui.page <= 1 ? 'disabled' : ''}>السابق</button>
          <span style="margin:0 8px">صفحة ${ui.page} / ${pages}</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="sec-page" data-dir="next" ${ui.page >= pages ? 'disabled' : ''}>التالي</button>
        </span>
      </div>
    `;
  };

  const renderControls = (sec, user) => {
    const rows = filterControls(sec);
    return `
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <label class="field">بحث
          <input type="search" data-sec-change="controlQ" value="${esc(ui.filters.controlQ)}" />
        </label>
        <label class="field">الحالة
          <select data-sec-change="controlStatus">
            <option value="">الكل</option>
            ${CTRL_STATUSES.map((s) => `<option value="${esc(s.v)}" ${ui.filters.controlStatus === s.v ? 'selected' : ''}>${esc(s.l)}</option>`).join('')}
          </select>
        </label>
        ${can(user, 'create_control') ? `<button type="button" class="btn btn-primary" data-action="sec-modal" data-modal="control_new">إضافة ضابط</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>المعرّف</th><th>الضابط</th><th>الإطار</th><th>الامتثال</th><th>الحالة</th><th>المراجعة القادمة</th><th></th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((c) => {
                    const acts = [];
                    if (can(user, 'update_control')) {
                      acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="sec-modal" data-modal="control_edit" data-id="${esc(c.id)}">تعديل</button>`);
                      acts.push(`<button type="button" class="btn btn-sm btn-dark" data-action="sec-toggle-control" data-id="${esc(c.id)}">تبديل الحالة</button>`);
                    }
                    if (can(user, 'archive_control')) {
                      acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="sec-confirm" data-kind="archive_control" data-id="${esc(c.id)}">أرشفة</button>`);
                    }
                    return `<tr>
                    <td>${esc(c.id)}</td>
                    <td><strong>${esc(c.name)}</strong><br/><small>${esc(c.category || '')}</small></td>
                    <td>${esc(c.framework)}</td>
                    <td>${c.compliance}% ${bar(c.compliance)}</td>
                    <td>${badge(ctrlStatusLabel(c.status))}</td>
                    <td>${esc(c.nextReview || '—')}</td>
                    <td>${acts.join(' ') || '—'}</td>
                  </tr>`;
                  })
                  .join('')
              : '<tr><td colspan="7" class="empty">لا ضوابط — أضف ضابطاً للبدء.</td></tr>'
          }
        </tbody>
      </table></div>
    `;
  };

  const riskMatrixCell = (sec, lik, imp) => {
    const count = (sec.risks || []).filter((r) => !r.archived && r.likelihood === lik && r.impact === imp).length;
    const score = lik * imp;
    const level = score >= 20 ? 'حرج' : score >= 12 ? 'مرتفع' : score >= 6 ? 'متوسط' : 'منخفض';
    const bg =
      score >= 20 ? 'rgba(220,38,38,.25)' : score >= 12 ? 'rgba(234,88,12,.2)' : score >= 6 ? 'rgba(107,114,128,.2)' : 'rgba(0,0,0,.04)';
    return `<td style="text-align:center;background:${bg};padding:8px" title="${esc(level)}">
      ${count ? `<strong>${count}</strong>` : '·'}
    </td>`;
  };

  const renderRisks = (sec, user) => {
    const rows = filterRisks(sec).sort((a, b) => (b.score || 0) - (a.score || 0));
    let matrix = '<table class="data" style="margin-bottom:16px"><thead><tr><th></th>';
    for (let imp = 5; imp >= 1; imp--) matrix += `<th>أثر ${imp}</th>`;
    matrix += '</tr></thead><tbody>';
    for (let lik = 5; lik >= 1; lik--) {
      matrix += `<tr><th>احتمال ${lik}</th>`;
      for (let imp = 5; imp >= 1; imp--) matrix += riskMatrixCell(sec, lik, imp);
      matrix += '</tr>';
    }
    matrix += '</tbody></table>';

    return `
      <article class="card" style="margin-bottom:12px">
        <h3><span class="title-left"><i class="fas fa-table-cells icon"></i> مصفوفة المخاطر 5×5</span></h3>
        <div class="table-wrap">${matrix}</div>
        <p class="empty" style="margin-top:8px">الخلايا المظللة تعكس شدة المخاطر (احتمال × أثر).</p>
      </article>
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <label class="field">بحث
          <input type="search" data-sec-change="riskQ" value="${esc(ui.filters.riskQ)}" />
        </label>
        <label class="field">المستوى
          <select data-sec-change="riskLevel">
            <option value="">الكل</option>
            ${['حرج', 'مرتفع', 'متوسط', 'منخفض'].map((l) => `<option value="${esc(l)}" ${ui.filters.riskLevel === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </label>
        ${can(user, 'create_risk') ? `<button type="button" class="btn btn-primary" data-action="sec-modal" data-modal="risk_new">إضافة خطر</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>المعرّف</th><th>الخطر</th><th>L×I</th><th>المستوى</th><th>الحالة</th><th>المالك</th><th>الاستهداف</th><th></th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map((r) => {
                    const acts = [];
                    if (can(user, 'update_risk')) {
                      acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="sec-modal" data-modal="risk_edit" data-id="${esc(r.id)}">تعديل</button>`);
                    }
                    if (can(user, 'archive_risk')) {
                      acts.push(`<button type="button" class="btn btn-sm btn-ghost" data-action="sec-confirm" data-kind="archive_risk" data-id="${esc(r.id)}">أرشفة</button>`);
                    }
                    return `<tr>
                    <td>${esc(r.id)}</td>
                    <td>${esc(r.name)}</td>
                    <td>${r.likelihood}×${r.impact}=${r.score}</td>
                    <td>${badge(r.level, 'level')}</td>
                    <td>${badge(r.status)}</td>
                    <td>${esc(r.owner || '—')}</td>
                    <td>${esc(r.targetDate || '—')}</td>
                    <td>${acts.join(' ') || '—'}</td>
                  </tr>`;
                  })
                  .join('')
              : '<tr><td colspan="8" class="empty">لا مخاطر مسجّلة.</td></tr>'
          }
        </tbody>
      </table></div>
    `;
  };

  const buildReportBody = (sec, type) => {
    const lines = [];
    lines.push(`<h2>تقرير أمن المعلومات — ${esc(type)}</h2>`);
    lines.push(`<p>تاريخ الإنشاء: ${esc(fmtTime(new Date().toISOString()))}</p>`);
    lines.push(`<p>درجة الأمن: <strong>${sec.score}%</strong> · امتثال: <strong>${sec.compliancePct}%</strong> · MFA: <strong>${sec.mfaCoverage}%</strong> · حوادث مفتوحة: <strong>${sec.openIncidents}</strong> · مخاطر حرجة: <strong>${sec.criticalRisks}</strong></p>`);
    if (type === 'executive' || type === 'full' || type === 'security-status') {
      lines.push('<h3>ملخص تنفيذي</h3><ul>');
      actionNeeded(sec).forEach((a) => lines.push(`<li>${esc(a.text)}</li>`));
      if (!actionNeeded(sec).length) lines.push('<li>لا توجد عناصر عاجلة حالياً</li>');
      lines.push('</ul>');
    }
    if (type === 'mfa') {
      const mfa = (sec.controls || []).find((c) => /MFA/i.test(c.name));
      lines.push(`<h3>تقرير MFA</h3><p>التغطية الحالية: <strong>${sec.mfaCoverage}%</strong></p>`);
      lines.push(`<p>الضابط المرتبط: ${esc(mfa?.name || '—')} · الحالة: ${esc(ctrlStatusLabel(mfa?.status))}</p>`);
    }
    if (type === 'compliance') {
      lines.push('<h3>الامتثال حسب الإطار</h3><ul>');
      ['ISO 27001', 'NIST', 'Internal Control'].forEach((fw) => {
        const rows = (sec.controls || []).filter((c) => !c.archived && c.framework === fw);
        const avg = rows.length ? Math.round(rows.reduce((a, c) => a + Number(c.compliance || 0), 0) / rows.length) : 0;
        lines.push(`<li>${esc(fw)}: ${avg}% (${rows.length} ضابط)</li>`);
      });
      lines.push('</ul>');
    }
    if (type === 'by-dept' || type === 'incidents' || type === 'full') {
      if (type === 'by-dept') {
        lines.push('<h3>الحوادث حسب الإدارة</h3><ul>');
        const deps = {};
        (sec.incidents || [])
          .filter((i) => !i.archived)
          .forEach((i) => {
            const d = i.department || 'غير محدد';
            deps[d] = (deps[d] || 0) + 1;
          });
        Object.entries(deps).forEach(([d, n]) => lines.push(`<li>${esc(d)}: ${n}</li>`));
        lines.push('</ul>');
      }
      if (type !== 'by-dept') {
        lines.push('<h3>سجل الحوادث (مختصر)</h3><table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr><th>ID</th><th>العنوان</th><th>الخطورة</th><th>الحالة</th><th>الإدارة</th></tr>');
        (sec.incidents || [])
          .filter((i) => !i.archived)
          .slice(0, 50)
          .forEach((i) => {
            lines.push(`<tr><td>${esc(i.id)}</td><td>${esc(i.title)}</td><td>${esc(i.severity)}</td><td>${esc(i.status)}</td><td>${esc(i.department || '—')}</td></tr>`);
          });
        lines.push('</table>');
      }
    }
    if (type === 'controls' || type === 'full' || type === 'security-status') {
      lines.push('<h3>حالة الضوابط</h3><table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr><th>الضابط</th><th>الامتثال</th><th>الحالة</th></tr>');
      (sec.controls || [])
        .filter((c) => !c.archived)
        .forEach((c) => {
          lines.push(`<tr><td>${esc(c.name)}</td><td>${c.compliance}%</td><td>${esc(ctrlStatusLabel(c.status))}</td></tr>`);
        });
      lines.push('</table>');
    }
    if (type === 'risks' || type === 'full' || type === 'security-status') {
      lines.push('<h3>سجل المخاطر</h3><table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr><th>الخطر</th><th>الدرجة</th><th>المستوى</th></tr>');
      (sec.risks || [])
        .filter((r) => !r.archived)
        .forEach((r) => {
          lines.push(`<tr><td>${esc(r.name)}</td><td>${r.score}</td><td>${esc(r.level)}</td></tr>`);
        });
      lines.push('</table>');
    }
    return lines.join('\n');
  };

  const renderReports = (sec, user) => {
    const cards = [
      { type: 'security-status', title: 'تقرير الحالة الأمنية', desc: 'درجة الأمن والمؤشرات الرئيسية' },
      { type: 'incidents', title: 'تقرير الحوادث الأمنية', desc: 'قائمة الحوادث والحالات' },
      { type: 'risks', title: 'تقرير المخاطر', desc: 'سجل المخاطر والدرجات' },
      { type: 'controls', title: 'تقرير الضوابط الأمنية', desc: 'الامتثال وحالة الضوابط' },
      { type: 'compliance', title: 'تقرير الامتثال', desc: 'نسب الامتثال حسب الإطار' },
      { type: 'mfa', title: 'تقرير MFA', desc: 'تغطية المصادقة متعددة العوامل' },
      { type: 'by-dept', title: 'الحوادث حسب الإدارة', desc: 'توزيع الحوادث على الإدارات' },
      { type: 'full', title: 'التقرير الشهري للإدارة', desc: 'تقرير شامل للقيادة' },
      { type: 'executive', title: 'Executive Security Summary', desc: 'ملخص تنفيذي للحالة الأمنية' },
    ];
    const body = ui.report ? buildReportBody(sec, ui.report.type) : '';
    return `
      <div class="grid-2" style="margin-bottom:12px">
        ${cards
          .map(
            (c) => `<button type="button" class="card" style="text-align:right;cursor:pointer;border:${ui.report?.type === c.type ? '2px solid var(--red)' : '1px solid var(--border)'}" data-action="sec-report" data-type="${esc(c.type)}">
              <b>${esc(c.title)}</b>
              <div class="empty" style="padding:8px 0 0;text-align:right">${esc(c.desc)}</div>
            </button>`
          )
          .join('')}
      </div>
      <div class="toolbar" style="gap:8px;margin-bottom:12px">
        ${can(user, 'create_report') ? `<button type="button" class="btn btn-primary" data-action="sec-report" data-type="${esc(ui.report?.type || 'executive')}">معاينة التقرير</button>` : ''}
        ${ui.report ? `<button type="button" class="btn btn-dark" data-action="sec-report-print">PDF / طباعة</button>` : ''}
        ${ui.report && can(user, 'export') ? `<button type="button" class="btn btn-ghost" data-action="sec-export" data-format="csv">Excel</button>` : ''}
      </div>
      ${
        ui.report
          ? `<article class="card report-body" data-sec-report-preview>${body}</article>`
          : '<p class="empty">اختر بطاقة تقرير ثم معاينة — التقارير تُبنى من البيانات الفعلية في الوحدة.</p>'
      }
    `;
  };

  const renderAudit = (sec, user) => {
    const q = (ui.filters.auditQ || '').toLowerCase();
    const rows = (sec.auditLog || []).filter((a) => {
      if (!q) return true;
      const hay = `${a.action} ${a.user} ${a.entityType} ${a.entityId} ${a.entityLabel} ${a.oldValue} ${a.newValue}`.toLowerCase();
      return hay.includes(q);
    });
    return `
      <div class="toolbar" style="margin-bottom:12px">
        <label class="field">بحث في السجل
          <input type="search" data-sec-change="auditQ" value="${esc(ui.filters.auditQ)}" />
        </label>
        ${can(user, 'audit_push') ? `<button type="button" class="btn btn-sm btn-ghost" data-action="sec-audit-note">تدوين ملاحظة تشغيلية</button>` : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>قبل</th><th>بعد</th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .slice(0, 100)
                  .map(
                    (a) => `<tr>
                  <td>${esc(fmtTime(a.at))}</td>
                  <td>${esc(a.user)}</td>
                  <td>${esc(a.action)}</td>
                  <td>${esc(a.entityType)} · ${esc(a.entityLabel || a.entityId)}</td>
                  <td><small>${esc(a.oldValue)}</small></td>
                  <td><small>${esc(a.newValue)}</small></td>
                </tr>`
                  )
                  .join('')
              : '<tr><td colspan="6" class="empty">السجل فارغ.</td></tr>'
          }
        </tbody>
      </table></div>
    `;
  };

  const renderTabs = () => {
    const tabs = [
      { id: 'overview', label: 'نظرة عامة', icon: 'fa-gauge-high' },
      { id: 'incidents', label: 'الحوادث الأمنية', icon: 'fa-bolt' },
      { id: 'controls', label: 'الضوابط الأمنية', icon: 'fa-shield-halved' },
      { id: 'risks', label: 'المخاطر', icon: 'fa-fire' },
      { id: 'reports', label: 'التقارير', icon: 'fa-file-lines' },
      { id: 'audit', label: 'سجل الأنشطة', icon: 'fa-list-check' },
    ];
    return `<div class="tabs" role="tablist">
      ${tabs
        .map(
          (t) => `<button type="button" class="tab ${ui.tab === t.id ? 'active' : ''}" data-action="sec-tab" data-tab="${esc(t.id)}" role="tab">
        <i class="fas ${esc(t.icon)} icon"></i> ${esc(t.label)}
      </button>`
        )
        .join('')}
    </div>`;
  };

  const renderHeader = (sec, user) => {
    const exportMenu = ui.exportOpen
      ? `<div class="field" style="position:relative">
          <div style="position:absolute;left:0;top:100%;z-index:5;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,.12)">
            <button type="button" class="btn btn-sm btn-ghost" style="width:100%;margin:4px 0" data-action="sec-export" data-format="csv">Excel (CSV)</button>
            <button type="button" class="btn btn-sm btn-ghost" style="width:100%;margin:4px 0" data-action="sec-export" data-format="print">PDF (طباعة)</button>
          </div>
        </div>`
      : '';
    return `<div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
      <div style="flex:1">
        <h2 style="margin:0"><span class="title-left"><i class="fas fa-shield-halved icon"></i> أمن المعلومات</span></h2>
        <small>ضوابط · MFA · SIEM · حوادث · RBAC · امتثال</small>
      </div>
      ${can(user, 'create_incident') ? `<button type="button" class="btn btn-primary" data-action="sec-modal" data-modal="incident_new"><i class="fas fa-plus icon"></i> تسجيل حادث أمني</button>` : ''}
      ${can(user, 'create_control') ? `<button type="button" class="btn btn-dark" data-action="sec-modal" data-modal="control_new">إضافة ضابط</button>` : ''}
      ${can(user, 'create_report') ? `<button type="button" class="btn btn-dark" data-action="sec-tab" data-tab="reports">إنشاء تقرير</button>` : ''}
      ${can(user, 'export') ? `<button type="button" class="btn btn-ghost" data-action="sec-export-toggle">تصدير ▾</button>${exportMenu}` : ''}
      <span class="badge badge-outline">${esc({
        security_admin: 'مدير أمن — صلاحية كاملة',
        security_officer: 'ضابط أمن',
        department_manager: 'مدير إدارة',
        employee: 'موظف',
        auditor: 'مدقق — قراءة وتقارير',
      }[permLevel(user)] || permLevel(user))}</span>
    </div>`;
  };

  const incidentById = (sec, id) => (sec.incidents || []).find((x) => x.id === id);
  const controlById = (sec, id) => (sec.controls || []).find((x) => x.id === id);
  const riskById = (sec, id) => (sec.risks || []).find((x) => x.id === id);

  const renderDrawerSections = (inc) => {
    const sections = [
      { id: 'summary', label: '١. معلومات أساسية' },
      { id: 'desc', label: '٢. الوصف والإجراء الأولي' },
      { id: 'sla', label: '٣. SLA والتصعيد' },
      { id: 'timeline', label: '٤. الجدول الزمني' },
      { id: 'actions', label: '٥. الإجراءات المتخذة' },
      { id: 'notes', label: '٦. الملاحظات' },
      { id: 'closure', label: '٧. الإغلاق والسبب الجذري' },
      { id: 'attachments', label: '٨. المرفقات' },
      { id: 'links', label: '٩. مخاطر وضوابط مرتبطة' },
      { id: 'meta', label: '١٠. حساسية ووسوم' },
    ];
    const nav = sections
      .map(
        (s) => `<button type="button" class="btn btn-sm ${ui.drawerSection === s.id ? 'btn-primary' : 'btn-ghost'}" data-action="sec-drawer-section" data-section="${esc(s.id)}">${esc(s.label)}</button>`
      )
      .join(' ');

    let body = '';
    if (ui.drawerSection === 'summary') {
      body = `<dl style="display:grid;grid-template-columns:120px 1fr;gap:8px">
        <dt>المعرّف</dt><dd>${esc(inc.id)}</dd>
        <dt>العنوان</dt><dd>${esc(inc.title)}</dd>
        <dt>النوع</dt><dd>${esc(inc.type)}</dd>
        <dt>الخطورة</dt><dd>${badge(inc.severity, 'severity')}</dd>
        <dt>الحالة</dt><dd>${badge(inc.status)}</dd>
        <dt>القسم</dt><dd>${esc(inc.department || '—')}</dd>
        <dt>المالك</dt><dd>${esc(inc.owner || '—')}</dd>
        <dt>المصدر</dt><dd>${sourceBadge(inc.source)}</dd>
        <dt>اكتشاف</dt><dd>${esc(fmtTime(inc.discoveredAt))}</dd>
        <dt>التسجيل</dt><dd>${esc(fmtTime(inc.createdAt))}</dd>
      </dl>
      <div class="toolbar" style="margin-top:12px;flex-wrap:wrap;gap:8px">
        <label class="field">تغيير الحالة
          <select id="sec-d-status">${INC_STATUSES.filter((s) => s !== 'مسودة').map((s) => `<option value="${esc(s)}" ${inc.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        </label>
        <label class="field">تغيير الخطورة
          <select id="sec-d-sev">${INC_SEVERITIES.map((s) => `<option value="${esc(s)}" ${inc.severity === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        </label>
        <label class="field">تغيير المسؤول
          <select id="sec-d-owner"><option value="">—</option>${(secData().people || []).map((p) => `<option value="${esc(p)}" ${inc.owner === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        </label>
        <button type="button" class="btn btn-dark btn-sm" data-action="sec-incident-patch" data-id="${esc(inc.id)}">حفظ التغييرات</button>
      </div>`;
    } else if (ui.drawerSection === 'desc') {
      body = `<p><strong>الوصف:</strong></p><p>${esc(inc.description || '—')}</p>
        <p><strong>الإجراء الأولي:</strong></p><p>${esc(inc.initialActions || '—')}</p>`;
    } else if (ui.drawerSection === 'sla') {
      body = `<p>SLA: ${inc.slaHours || '—'} ساعة · ${slaBadge(inc)}</p>
        <p>موعد الاستحقاق: ${esc(fmtTime(inc.slaDueAt))}</p>`;
    } else if (ui.drawerSection === 'timeline') {
      body =
        (inc.timeline || [])
          .map((t) => `<div style="margin:8px 0;padding:8px;border-right:3px solid #333"><small>${esc(fmtTime(t.at))} — ${esc(t.by)}</small><div>${esc(t.text)}</div></div>`)
          .join('') || '<p class="empty">لا أحداث.</p>';
    } else if (ui.drawerSection === 'actions') {
      body = `<ul>${(inc.actionsTaken || []).map((a) => `<li>${esc(fmtTime(a.at))}: ${esc(a.text)} (${esc(a.by)})</li>`).join('')}</ul>
        <label class="field">إجراء جديد<input id="sec-drawer-action-text" placeholder="وصف الإجراء" /></label>
        <button type="button" class="btn btn-sm btn-primary" data-action="sec-drawer-add-action" data-id="${esc(inc.id)}">تسجيل إجراء</button>`;
    } else if (ui.drawerSection === 'notes') {
      body = `<ul>${(inc.notes || []).map((n) => `<li>${esc(fmtTime(n.at))}: ${esc(n.text)} (${esc(n.by)})</li>`).join('')}</ul>
        <label class="field">تعليق<input id="sec-drawer-note-text" placeholder="ملاحظة" /></label>
        <button type="button" class="btn btn-sm btn-primary" data-action="sec-drawer-add-note" data-id="${esc(inc.id)}">إضافة تعليق</button>`;
    } else if (ui.drawerSection === 'closure') {
      body = `<p><strong>السبب الجذري:</strong> ${esc(inc.rootCause || '—')}</p>
        <p><strong>الحل:</strong> ${esc(inc.resolution || '—')}</p>
        <p><strong>إجراءات تصحيحية:</strong></p><ul>${(inc.correctiveActions || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul>
        <p><strong>إجراءات وقائية:</strong></p><ul>${(inc.preventiveActions || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul>
        ${inc.status !== 'مغلق' ? `<button type="button" class="btn btn-dark" data-action="sec-modal" data-modal="close_incident" data-id="${esc(inc.id)}">معالج الإغلاق</button>` : `<button type="button" class="btn btn-ghost" data-action="sec-reopen" data-id="${esc(inc.id)}">إعادة فتح</button>`}`;
    } else if (ui.drawerSection === 'attachments') {
      body = `<ul>${(inc.attachments || []).map((a) => `<li>${esc(a.name)} — ${esc(fmtTime(a.at))}</li>`).join('') || '<li>لا مرفقات</li>'}</ul>
        <label class="field">اسم ملف (مرجع)<input id="sec-drawer-attach-name" placeholder="report.pdf" /></label>
        <button type="button" class="btn btn-sm btn-primary" data-action="sec-drawer-attach" data-id="${esc(inc.id)}">إرفاق</button>`;
    } else if (ui.drawerSection === 'links') {
      body = `<p><strong>مخاطر:</strong> ${(inc.relatedRisks || []).map((id) => esc(id)).join(' · ') || '—'}</p>
        <p><strong>ضوابط:</strong> ${(inc.relatedControls || []).map((id) => esc(id)).join(' · ') || '—'}</p>`;
    } else {
      body = `<p>بيانات حساسة: ${inc.sensitiveData ? 'نعم 🔒' : 'لا'}</p>
        <p>الوسوم: ${(inc.tags || []).map((t) => badge(t)).join(' ') || '—'}</p>
        <p>مسودة: ${inc.draft ? 'نعم' : 'لا'}</p>`;
    }

    return `<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">${nav}</div>${body}`;
  };

  const renderDrawer = (sec, user) => {
    if (!ui.drawer) return '';
    const inc = incidentById(sec, ui.drawer);
    if (!inc) return '';
    return `<aside class="card" data-sec-drawer style="position:fixed;left:0;top:0;bottom:0;width:min(480px,92vw);z-index:40;overflow:auto;box-shadow:4px 0 24px rgba(0,0,0,.15);margin:0;border-radius:0">
      <div class="toolbar" style="position:sticky;top:0;background:inherit;z-index:1">
        <strong>${esc(inc.title)}</strong>
        <button type="button" class="btn btn-sm btn-ghost" data-action="sec-drawer-close">✕</button>
      </div>
      ${renderDrawerSections(inc)}
    </aside>`;
  };

  const formField = (label, id, value = '', type = 'text', opts = '') => {
    if (type === 'textarea') {
      return `<label class="field">${esc(label)}<textarea id="${esc(id)}" rows="3">${esc(value)}</textarea></label>`;
    }
    if (type === 'select') {
      return `<label class="field">${esc(label)}<select id="${esc(id)}">${opts}</select></label>`;
    }
    return `<label class="field">${esc(label)}<input id="${esc(id)}" type="${esc(type)}" value="${esc(value)}" /></label>`;
  };

  const renderModal = (sec, user) => {
    if (!ui.modal) return '';
    const people = sec.people || [];
    const depts = sec.departments || [];
    let title = '';
    let body = '';
    let footer = '';

    if (ui.modal === 'incident_new') {
      title = 'تسجيل حادث أمني';
      body = `
        ${formField('العنوان *', 'sec-inc-title', ui.incidentForm?.title || '')}
        ${formField('النوع *', 'sec-inc-type', '', 'select', INC_TYPES.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join(''))}
        ${formField('تاريخ الاكتشاف *', 'sec-inc-date', new Date().toISOString().slice(0, 10), 'date')}
        ${formField('وقت الاكتشاف *', 'sec-inc-time', '09:00', 'time')}
        ${formField('الخطورة *', 'sec-inc-severity', '', 'select', INC_SEVERITIES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join(''))}
        ${formField('النظام / الإدارة المتأثرة *', 'sec-inc-dept', '', 'select', `<option value=""></option>${depts.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}`)}
        ${formField('المسؤول', 'sec-inc-owner', '', 'select', `<option value=""></option>${people.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}`)}
        ${formField('مصدر الحادث', 'sec-inc-source', '', 'select', INC_SOURCES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join(''))}
        ${formField('وصف تفصيلي *', 'sec-inc-desc', '', 'textarea')}
        ${formField('الإجراءات الأولية المتخذة', 'sec-inc-init', '', 'textarea')}
        ${formField('وسوم / Tags', 'sec-inc-tags', '')}
        ${formField('مرفق (اسم ملف)', 'sec-inc-file', '')}
        <label class="field"><input type="checkbox" id="sec-inc-sensitive" /> هل يحتوي الحادث على بيانات حساسة؟</label>
      `;
      footer = `<button type="button" class="btn btn-ghost" data-action="sec-modal-close">إلغاء</button>
        <button type="button" class="btn btn-dark" data-action="sec-incident-save" data-draft="1">حفظ مسودة</button>
        <button type="button" class="btn btn-primary" data-action="sec-incident-save">تسجيل</button>`;
    } else if (ui.modal === 'close_incident') {
      const id = ui.incidentForm?.id || '';
      title = `إغلاق حادث ${esc(id)}`;
      body = `
        <p class="empty">قبل الإغلاق: السبب الجذري، الحل، والإجراء التصحيحي إلزامية.</p>
        ${formField('السبب الجذري *', 'sec-close-root', '')}
        ${formField('الحل / resolution *', 'sec-close-resolution', '', 'textarea')}
        ${formField('إجراء تصحيحي *', 'sec-close-corrective', '', 'textarea')}
        ${formField('إجراء وقائي', 'sec-close-preventive', '', 'textarea')}
      `;
      footer = `<button type="button" class="btn btn-ghost" data-action="sec-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="sec-incident-close" data-id="${esc(id)}">إغلاق الحادث</button>`;
    } else if (ui.modal === 'control_new' || ui.modal === 'control_edit') {
      const c = ui.modal === 'control_edit' ? controlById(sec, ui.controlForm?.id) : null;
      title = c ? 'تعديل ضابط' : 'إضافة ضابط أمني';
      body = `
        ${formField('اسم الضابط *', 'sec-ctrl-name', c?.name || '')}
        ${formField('التصنيف', 'sec-ctrl-cat', c?.category || 'متوسطة')}
        ${formField('الإطار', 'sec-ctrl-fw', '', 'select', CTRL_FRAMEWORKS.map((f) => `<option ${c?.framework === f ? 'selected' : ''} value="${esc(f)}">${esc(f)}</option>`).join(''))}
        ${formField('نسبة الامتثال %', 'sec-ctrl-compliance', c?.compliance ?? 0, 'number')}
        ${formField('الحالة', 'sec-ctrl-status', '', 'select', CTRL_STATUSES.map((s) => `<option ${c?.status === s.v ? 'selected' : ''} value="${esc(s.v)}">${esc(s.l)}</option>`).join(''))}
        ${formField('المالك', 'sec-ctrl-owner', c?.owner || '', 'select', `<option value=""></option>${people.map((p) => `<option ${c?.owner === p ? 'selected' : ''} value="${esc(p)}">${esc(p)}</option>`).join('')}`)}
        ${formField('مراجعة قادمة', 'sec-ctrl-next', c?.nextReview || '', 'date')}
        ${formField('الوصف', 'sec-ctrl-desc', c?.description || '', 'textarea')}
      `;
      footer = `<button type="button" class="btn btn-ghost" data-action="sec-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="sec-control-save" data-id="${esc(c?.id || '')}">${c ? 'حفظ' : 'إنشاء'}</button>`;
    } else if (ui.modal === 'risk_new' || ui.modal === 'risk_edit') {
      const r = ui.modal === 'risk_edit' ? riskById(sec, ui.riskForm?.id) : null;
      title = r ? 'تعديل خطر' : 'إضافة خطر';
      body = `
        ${formField('اسم الخطر *', 'sec-risk-name', r?.name || '')}
        ${formField('الفئة', 'sec-risk-cat', r?.category || '')}
        ${formField('احتمال (1-5) *', 'sec-risk-lik', r?.likelihood ?? 3, 'number')}
        ${formField('الأثر (1-5) *', 'sec-risk-imp', r?.impact ?? 3, 'number')}
        ${formField('القسم', 'sec-risk-dept', r?.department || '', 'select', `<option value=""></option>${depts.map((d) => `<option ${r?.department === d ? 'selected' : ''} value="${esc(d)}">${esc(d)}</option>`).join('')}`)}
        ${formField('المالك', 'sec-risk-owner', r?.owner || '', 'select', `<option value=""></option>${people.map((p) => `<option ${r?.owner === p ? 'selected' : ''} value="${esc(p)}">${esc(p)}</option>`).join('')}`)}
        ${formField('خطة المعالجة', 'sec-risk-plan', r?.treatmentPlan || '', 'textarea')}
        ${formField('تاريخ مستهدف', 'sec-risk-target', r?.targetDate || '', 'date')}
        ${formField('الحالة', 'sec-risk-status', '', 'select', RISK_STATUSES.map((s) => `<option ${r?.status === s ? 'selected' : ''} value="${esc(s)}">${esc(s)}</option>`).join(''))}
        ${formField('الوصف', 'sec-risk-desc', r?.description || '', 'textarea')}
      `;
      footer = `<button type="button" class="btn btn-ghost" data-action="sec-modal-close">إلغاء</button>
        <button type="button" class="btn btn-primary" data-action="sec-risk-save" data-id="${esc(r?.id || '')}">${r ? 'حفظ' : 'إنشاء'}</button>`;
    }

    if (!title) return '';
    return `<div data-sec-modal-backdrop style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px">
      <div class="card" style="width:min(520px,96vw);max-height:90vh;overflow:auto" role="dialog">
        <h3>${title}</h3>
        ${ui.error ? `<p class="badge badge-red">${esc(ui.error)}</p>` : ''}
        ${body}
        <div class="toolbar" style="margin-top:12px;justify-content:flex-end">${footer}</div>
      </div>
    </div>`;
  };

  const renderConfirm = () => {
    if (!ui.confirm) return '';
    const c = ui.confirm;
    return `<div data-sec-confirm style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:60;display:flex;align-items:center;justify-content:center">
      <article class="card" style="max-width:400px">
        <h3>تأكيد</h3>
        <p>${esc(c.message || 'هل أنت متأكد؟')}</p>
        <div class="toolbar">
          <button type="button" class="btn btn-ghost" data-action="sec-confirm-cancel">إلغاء</button>
          <button type="button" class="btn btn-primary" data-action="sec-confirm-ok" data-kind="${esc(c.kind)}" data-id="${esc(c.id)}">تأكيد</button>
        </div>
      </article>
    </div>`;
  };

  const renderTabBody = (sec, user) => {
    switch (ui.tab) {
      case 'incidents':
        return renderIncidents(sec, user);
      case 'controls':
        return renderControls(sec, user);
      case 'risks':
        return renderRisks(sec, user);
      case 'reports':
        return renderReports(sec, user);
      case 'audit':
        return renderAudit(sec, user);
      default:
        return renderOverview(sec, user);
    }
  };

  const render = (ctx = {}) => {
    const user = ctx.user || {};
    const sec = secData();
    ui.loading = false;
    /* KPI focus is applied once in handle(sec-kpi-focus); tabs stay free for navigation */

    return `<div class="hub-info-security" dir="rtl" data-hub-info-security>
      ${renderHeader(sec, user)}
      ${renderNotifications(sec, user)}
      ${renderKpis(sec, user)}
      ${renderTabs()}
      <div class="card" style="margin-top:12px">${renderTabBody(sec, user)}</div>
      ${renderDrawer(sec, user)}
      ${renderModal(sec, user)}
      ${renderConfirm()}
    </div>`;
  };

  const qVal = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  };

  const exportCsv = (sec) => {
    const lines = [];
    lines.push(['نوع', 'معرّف', 'عنوان', 'حالة', 'خطورة/درجة', 'مالك'].join(','));
    (sec.incidents || [])
      .filter((i) => !i.archived)
      .forEach((i) => {
        lines.push(['حادث', i.id, `"${(i.title || '').replace(/"/g, '""')}"`, i.status, i.severity, i.owner].join(','));
      });
    (sec.controls || [])
      .filter((c) => !c.archived)
      .forEach((c) => {
        lines.push(['ضابط', c.id, `"${(c.name || '').replace(/"/g, '""')}"`, c.status, c.compliance, c.owner].join(','));
      });
    (sec.risks || [])
      .filter((r) => !r.archived)
      .forEach((r) => {
        lines.push(['خطر', r.id, `"${(r.name || '').replace(/"/g, '""')}"`, r.status, r.score, r.owner].join(','));
      });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `naiosh-info-security-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPrint = (sec) => {
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>أمن المعلومات</title>
      <style>body{font-family:Tahoma,Arial;padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:6px}</style></head><body>
      ${buildReportBody(sec, 'full')}
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const handle = (action, btn, ctx = {}) => {
    if (!action || !String(action).startsWith('sec-')) return false;
    const user = ctx.user || {};
    const toast = ctx.toast || (() => {});
    const act = actorName(user);
    const HS = store();
    if (!HS) {
      ui.error = 'HubStore غير متاح';
      return true;
    }

    ui.error = '';

    if (action === 'sec-tab') {
      ui.tab = btn.dataset.tab || 'overview';
      ui.page = 1;
      ui.kpiFocus = '';
      return true;
    }

    if (action === 'sec-kpi-focus') {
      const key = btn.dataset.kpi || '';
      ui.kpiFocus = key;
      if (key === 'open' || key === 'closed') {
        ui.tab = 'incidents';
        ui.filters.incidentStatus = key === 'closed' ? 'مغلق' : '';
      } else if (key === 'controls' || key === 'mfa') {
        ui.tab = 'controls';
        ui.filters.controlQ = key === 'mfa' ? 'MFA' : '';
      } else if (key === 'critical') {
        ui.tab = 'risks';
        ui.filters.riskLevel = 'حرج';
      } else {
        ui.tab = 'overview';
      }
      ui.page = 1;
      return true;
    }

    if (action === 'sec-kpi-clear') {
      ui.kpiFocus = '';
      return true;
    }

    if (action === 'sec-export-toggle') {
      ui.exportOpen = !ui.exportOpen;
      return true;
    }

    if (action === 'sec-export') {
      if (!can(user, 'export')) return toast('لا صلاحية للتصدير'), true;
      const sec = secData();
      if (btn.dataset.format === 'print') exportPrint(sec);
      else exportCsv(sec);
      ui.exportOpen = false;
      toast('تم التصدير');
      return true;
    }

    if (action === 'sec-page') {
      const dir = btn.dataset.dir;
      if (dir === 'prev') ui.page -= 1;
      else ui.page += 1;
      return true;
    }

    if (action === 'sec-modal') {
      ui.modal = btn.dataset.modal;
      ui.error = '';
      if (ui.modal === 'close_incident') ui.incidentForm = { id: btn.dataset.id };
      if (ui.modal === 'control_edit') ui.controlForm = { id: btn.dataset.id };
      if (ui.modal === 'risk_edit') ui.riskForm = { id: btn.dataset.id };
      return true;
    }

    if (action === 'sec-modal-close') {
      ui.modal = null;
      ui.error = '';
      return true;
    }

    if (action === 'sec-drawer') {
      ui.drawer = btn.dataset.id;
      ui.drawerSection = 'summary';
      return true;
    }

    if (action === 'sec-drawer-close') {
      ui.drawer = null;
      return true;
    }

    if (action === 'sec-drawer-section') {
      ui.drawerSection = btn.dataset.section || 'summary';
      return true;
    }

    if (action === 'sec-incident-row' || action === 'sec-risk-row') {
      if (action === 'sec-incident-row') {
        ui.drawer = btn.dataset.id;
        ui.tab = 'incidents';
        ui.drawerSection = 'summary';
      } else {
        ui.tab = 'risks';
        ui.filters.riskQ = btn.dataset.id;
      }
      return true;
    }

    if (action === 'sec-action-item') {
      const t = btn.dataset.type;
      const id = btn.dataset.id;
      if (t === 'incident' || t === 'notice') {
        ui.tab = 'incidents';
        ui.drawer = id;
      } else if (t === 'control') {
        ui.tab = 'controls';
        ui.filters.controlQ = id;
      } else if (t === 'risk') {
        ui.tab = 'risks';
        ui.filters.riskQ = id;
      } else if (t === 'notice') {
        HS.markSecurityNoticeRead?.(id);
      }
      return true;
    }

    if (action === 'sec-open-link') {
      const id = btn.dataset.id;
      const lt = btn.dataset.linkType || '';
      if (/risk|critical_risk/.test(lt)) {
        ui.tab = 'risks';
        ui.filters.riskQ = id;
      } else {
        ui.tab = 'incidents';
        ui.drawer = id;
      }
      return true;
    }

    if (action === 'sec-notice-read') {
      HS.markSecurityNoticeRead?.(btn.dataset.id);
      toast('تم تعليم التنبيه كمقروء');
      return true;
    }

    if (action === 'sec-incident-save') {
      if (!can(user, 'create_incident')) return toast('لا صلاحية'), true;
      const titleStr = String(qVal('sec-inc-title') || '').trim();
      const type = String(qVal('sec-inc-type') || '').trim();
      const severity = String(qVal('sec-inc-severity') || '').trim();
      const department = String(qVal('sec-inc-dept') || '').trim();
      const description = String(qVal('sec-inc-desc') || '').trim();
      const date = String(qVal('sec-inc-date') || '').trim();
      const time = String(qVal('sec-inc-time') || '').trim();
      const draft = btn.dataset.draft === '1';
      if (!draft && (!titleStr || !type || !severity || !department || !description || !date || !time)) {
        toast('أكمل الحقول المطلوبة: العنوان، النوع، التاريخ، الوقت، الإدارة، الخطورة، والوصف');
        return true;
      }
      let discoveredAt = new Date().toISOString();
      try {
        if (date && time) discoveredAt = new Date(`${date}T${time}:00`).toISOString();
      } catch (_) {}
      const file = String(qVal('sec-inc-file') || '').trim();
      const item = HS.addSecurityIncident(
        {
          title: titleStr || 'مسودة حادث',
          type,
          severity,
          department,
          owner: qVal('sec-inc-owner'),
          source: qVal('sec-inc-source') || 'إدخال يدوي',
          description,
          initialActions: qVal('sec-inc-init'),
          tags: qVal('sec-inc-tags'),
          sensitiveData: !!qVal('sec-inc-sensitive'),
          discoveredAt,
          draft,
          attachments: file ? [{ name: file, at: new Date().toISOString() }] : [],
        },
        act
      );
      ui.modal = null;
      ui.tab = 'incidents';
      if (item?.id) ui.drawer = item.id;
      toast(draft ? 'حُفظت المسودة' : `سُجّل الحادث ${item?.id || ''}`);
      return true;
    }

    if (action === 'sec-incident-patch') {
      if (!can(user, 'update_incident')) return toast('لا صلاحية'), true;
      HS.updateSecurityIncident(
        btn.dataset.id,
        {
          status: qVal('sec-d-status'),
          severity: qVal('sec-d-sev'),
          owner: qVal('sec-d-owner'),
        },
        act
      );
      toast('تحدّث الحادث');
      return true;
    }

    if (action === 'sec-incident-close') {
      if (!can(user, 'update_incident')) return toast('لا صلاحية'), true;
      const id = btn.dataset.id;
      const rootCause = String(qVal('sec-close-root') || '').trim();
      const resolution = String(qVal('sec-close-resolution') || '').trim();
      const correctiveAction = String(qVal('sec-close-corrective') || '').trim();
      const preventiveAction = String(qVal('sec-close-preventive') || '').trim();
      const res = HS.closeSecurityIncident(
        id,
        { rootCause, resolution, correctiveAction, preventiveAction: preventiveAction || undefined },
        act
      );
      if (res?.error) {
        ui.error = res.error;
        return true;
      }
      ui.modal = null;
      ui.drawer = null;
      toast('أُغلق الحادث');
      return true;
    }

    if (action === 'sec-reopen') {
      if (!can(user, 'update_incident')) return toast('لا صلاحية'), true;
      HS.reopenSecurityIncident?.(btn.dataset.id, act);
      toast('أُعيد فتح الحادث');
      return true;
    }

    if (action === 'sec-drawer-add-note') {
      const text = String(qVal('sec-drawer-note-text') || '').trim();
      if (!text) return toast('اكتب التعليق'), true;
      HS.addSecurityIncidentNote(btn.dataset.id, text, act);
      toast('أُضيف التعليق');
      return true;
    }

    if (action === 'sec-drawer-add-action') {
      const text = String(qVal('sec-drawer-action-text') || '').trim();
      if (!text) return toast('اكتب الإجراء'), true;
      HS.addSecurityIncidentAction(btn.dataset.id, text, act);
      toast('سُجّل الإجراء');
      return true;
    }

    if (action === 'sec-drawer-attach') {
      const name = String(qVal('sec-drawer-attach-name') || '').trim();
      if (!name) return toast('اسم الملف مطلوب'), true;
      HS.addSecurityAttachment('incident', btn.dataset.id, name, act);
      toast('أُضيف المرفق');
      return true;
    }

    if (action === 'sec-control-save') {
      const name = String(qVal('sec-ctrl-name') || '').trim();
      if (!name) {
        ui.error = 'اسم الضابط مطلوب';
        return true;
      }
      const payload = {
        name,
        category: qVal('sec-ctrl-cat'),
        framework: qVal('sec-ctrl-fw'),
        compliance: qVal('sec-ctrl-compliance'),
        status: qVal('sec-ctrl-status'),
        owner: qVal('sec-ctrl-owner'),
        nextReview: qVal('sec-ctrl-next'),
        description: qVal('sec-ctrl-desc'),
      };
      const id = btn.dataset.id;
      if (id) {
        if (!can(user, 'update_control')) return toast('لا صلاحية'), true;
        HS.updateSecurityControl(id, payload, act);
        toast('حُدّث الضابط');
      } else {
        if (!can(user, 'create_control')) return toast('لا صلاحية'), true;
        HS.addSecurityControl(payload, act);
        toast('أُنشئ الضابط');
      }
      ui.modal = null;
      return true;
    }

    if (action === 'sec-toggle-control') {
      if (!can(user, 'update_control')) return toast('لا صلاحية'), true;
      HS.toggleSecurityControl?.(btn.dataset.id);
      toast('تبدّلت حالة الضابط');
      return true;
    }

    if (action === 'sec-risk-save') {
      const name = String(qVal('sec-risk-name') || '').trim();
      if (!name) {
        ui.error = 'اسم الخطر مطلوب';
        return true;
      }
      const lik = Math.min(5, Math.max(1, Number(qVal('sec-risk-lik') || 1)));
      const imp = Math.min(5, Math.max(1, Number(qVal('sec-risk-imp') || 1)));
      const payload = {
        name,
        category: qVal('sec-risk-cat'),
        likelihood: lik,
        impact: imp,
        department: qVal('sec-risk-dept'),
        owner: qVal('sec-risk-owner'),
        treatmentPlan: qVal('sec-risk-plan'),
        targetDate: qVal('sec-risk-target'),
        status: qVal('sec-risk-status'),
        description: qVal('sec-risk-desc'),
      };
      const id = btn.dataset.id;
      if (id) {
        if (!can(user, 'update_risk')) return toast('لا صلاحية'), true;
        HS.updateSecurityRisk(id, payload, act);
        toast('حُدّث الخطر');
      } else {
        if (!can(user, 'create_risk')) return toast('لا صلاحية'), true;
        HS.addSecurityRisk(payload, act);
        toast('أُنشئ الخطر');
      }
      ui.modal = null;
      return true;
    }

    if (action === 'sec-confirm') {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      const messages = {
        archive_incident: 'أرشفة هذا الحادث؟ لن يظهر في القوائم التشغيلية.',
        archive_control: 'أرشفة هذا الضابط؟',
        archive_risk: 'أرشفة هذا الخطر؟',
      };
      ui.confirm = { kind, id, message: messages[kind] || 'تأكيد العملية' };
      return true;
    }

    if (action === 'sec-confirm-cancel') {
      ui.confirm = null;
      return true;
    }

    if (action === 'sec-confirm-ok') {
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      if (kind === 'archive_incident') {
        if (!can(user, 'archive_incident')) return toast('لا صلاحية'), true;
        HS.archiveSecurityIncident(id, act);
        toast('أُرشف الحادث');
      } else if (kind === 'archive_control') {
        if (!can(user, 'archive_control')) return toast('لا صلاحية'), true;
        HS.archiveSecurityControl(id, act);
        toast('أُرشف الضابط');
      } else if (kind === 'archive_risk') {
        if (!can(user, 'archive_risk')) return toast('لا صلاحية'), true;
        HS.archiveSecurityRisk(id, act);
        toast('أُرشف الخطر');
      }
      ui.confirm = null;
      ui.drawer = null;
      return true;
    }

    if (action === 'sec-report') {
      if (!can(user, 'create_report')) return toast('لا صلاحية'), true;
      const type = btn.dataset.type || 'executive';
      ui.report = { type, at: new Date().toISOString() };
      HS.pushSecurityAudit?.({
        user: act,
        action: 'إنشاء تقرير',
        entityType: 'report',
        entityId: type,
        entityLabel: type,
        newValue: 'generated',
      });
      HS.save?.();
      ui.tab = 'reports';
      toast('جُهّز التقرير');
      return true;
    }

    if (action === 'sec-report-print') {
      if (!ui.report) return true;
      exportPrint(secData());
      return true;
    }

    if (action === 'sec-audit-note') {
      if (!can(user, 'audit_push')) return toast('لا صلاحية'), true;
      const note = window.prompt('ملاحظة للسجل:', '');
      if (!note?.trim()) return true;
      HS.pushSecurityAudit?.({
        user: act,
        action: 'ملاحظة تشغيلية',
        entityType: 'module',
        entityId: 'info-security',
        entityLabel: 'أمن المعلومات',
        newValue: note.trim(),
      });
      HS.save?.();
      toast('دُونت في السجل');
      return true;
    }

    return false;
  };

  const handleChange = (el) => {
    if (!el || !el.getAttribute) return false;
    const key = el.getAttribute('data-sec-change');
    if (!key) return false;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'sort') {
      ui.sort = val;
    } else if (ui.filters[key] !== undefined || key in ui.filters) {
      ui.filters[key] = val;
    } else {
      ui.filters[key] = val;
    }
    ui.page = 1;
    return true;
  };

  window.HubInfoSecurity = { render, handle, handleChange, ui };
})();
