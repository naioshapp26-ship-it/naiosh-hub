/**
 * Admin — Incoming articles inbox (dashboard #content-articles)
 */
(() => {
  'use strict';

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso).slice(0, 16);
    }
  };

  const state = { tab: 'inbox', id: '', q: '', status: '' };

  const A = () => window.HubArticles;

  function shell() {
    const k = A()?.kpis?.() || {};
    return `<div class="art-admin" id="art-admin">
      <div class="posha-head" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <h2 style="margin:0"><i class="fas fa-newspaper"></i> إدارة المحتوى — المقالات</h2>
          <p style="margin:6px 0 0;color:#6b7280;font-weight:600">المقالات الواردة · مراجعة · اعتماد · نشر — مربوطة بآلية التشغيل (Workflow)</p>
        </div>
        <a class="btn btn-ghost btn-sm" href="blog.html" target="_blank">فتح صفحة المقالات</a>
      </div>
      <div class="posha-kpis" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px">
        <article style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px"><span>واردة</span><strong>${k.incoming || 0}</strong></article>
        <article style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px"><span>بانتظار المراجعة</span><strong>${k.pending || 0}</strong></article>
        <article style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px"><span>يحتاج تعديلات</span><strong>${k.needs || 0}</strong></article>
        <article style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px"><span>منشور</span><strong>${k.published || 0}</strong></article>
      </div>
      <nav class="posha-subnav" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <button type="button" class="btn ${state.tab === 'inbox' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-atab="inbox">المقالات الواردة</button>
        <button type="button" class="btn ${state.tab === 'flows' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-atab="flows">سير العمل</button>
        <button type="button" class="btn ${state.tab === 'runs' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-atab="runs">التشغيلات (Runs)</button>
        <button type="button" class="btn ${state.tab === 'settings' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-atab="settings">الإعدادات</button>
      </nav>
      <div id="art-admin-body"></div>
    </div>`;
  }

  function renderDetail(id) {
    const a = A().get(id);
    if (!a) return `<p>غير موجود</p><button class="btn btn-ghost" data-aback>رجوع</button>`;
    const run = a.runId ? A().getRun(a.runId) : null;
    const audit = A().listAudit(a.id).slice(0, 20);
    return `<div class="card" style="padding:16px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <button type="button" class="btn btn-ghost btn-sm" data-aback>← رجوع</button>
          <h3 style="margin:8px 0">${esc(a.title)}</h3>
          <p><code>${esc(a.id)}</code> · <strong>${esc(a.statusAr)}</strong> · المراجع: ${esc(a.reviewer || '—')}</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn btn-dark btn-sm" data-aact="assign" data-id="${esc(a.id)}">تعيين مراجع</button>
          <button type="button" class="btn btn-ghost btn-sm" data-aact="changes" data-id="${esc(a.id)}">طلب تعديل</button>
          <button type="button" class="btn btn-primary btn-sm" data-aact="approve" data-id="${esc(a.id)}">اعتماد</button>
          <button type="button" class="btn btn-secondary btn-sm" data-aact="publish" data-id="${esc(a.id)}">نشر الآن</button>
          <button type="button" class="btn btn-dark btn-sm" data-aact="reject" data-id="${esc(a.id)}">رفض</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-top:14px">
        <div>
          <h4>المقال</h4>
          <p><b>الكاتب:</b> ${esc(a.authorName)} · ${esc(a.authorEmail)} · ${esc(a.company)}</p>
          <p><b>التصنيف:</b> ${esc(a.category)}</p>
          <p><b>الملخص:</b> ${esc(a.summary)}</p>
          ${a.body ? `<div style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:10px;margin-top:8px">${esc(a.body)}</div>` : ''}
          ${a.articleFile ? `<p style="margin-top:8px"><i class="fas fa-paperclip"></i> ${esc(a.articleFile.name)}</p>` : ''}
          ${a.reviewNotes ? `<p style="margin-top:10px;color:#b91c1c"><b>آخر ملاحظة:</b> ${esc(a.reviewNotes)}</p>` : ''}
        </div>
        <div>
          <h4>مصدر الطلب / سير العمل</h4>
          <p>المصدر: ${esc(a.sourceModule)} · ${esc(a.sourcePage)}</p>
          <p>Workflow: ${esc(a.workflowName)}</p>
          <p>Run ID: <code>${esc(a.runId || '—')}</code></p>
          <p>المرحلة: ${esc(run?.currentStep || '—')} · ${esc(run?.status || '')}</p>
          <h4 style="margin-top:14px">سجل العمليات</h4>
          <ul class="feed">${audit.map((t) => `<li><b>${esc(t.action)}</b> — ${esc(t.performedBy)} <small>${fmt(t.at)}</small></li>`).join('') || '<li>—</li>'}</ul>
        </div>
      </div>
    </div>`;
  }

  function renderInbox() {
    if (state.id) return renderDetail(state.id);
    let rows = A().list({});
    if (state.status) rows = rows.filter((a) => a.status === state.status);
    if (state.q) {
      const q = state.q.toLowerCase();
      rows = rows.filter(
        (a) =>
          String(a.id).toLowerCase().includes(q) ||
          String(a.title || '').toLowerCase().includes(q) ||
          String(a.authorName || '').toLowerCase().includes(q)
      );
    }
    return `<div class="card" style="padding:14px">
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <input id="art-aq" type="search" placeholder="بحث: ID · عنوان · كاتب" value="${esc(state.q)}" style="flex:1;min-width:180px;padding:10px;border-radius:10px;border:1px solid #e5e7eb" />
        <select id="art-astatus" style="padding:10px;border-radius:10px;border:1px solid #e5e7eb">
          <option value="">كل الحالات</option>
          ${Object.entries(A().STATUS)
            .map(([k, v]) => `<option value="${esc(k)}" ${state.status === k ? 'selected' : ''}>${esc(v)}</option>`)
            .join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data" style="width:100%">
        <thead><tr>
          <th>Article ID</th><th>العنوان</th><th>الكاتب</th><th>التصنيف</th><th>المصدر</th><th>تاريخ الإرسال</th><th>المراجع</th><th>الحالة</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${
            rows
              .map(
                (a) => `<tr>
              <td><code>${esc(a.id)}</code></td>
              <td>${esc(a.title || '—')}</td>
              <td>${esc(a.authorName || '—')}<br><small>${esc(a.company || a.authorEmail || '')}</small></td>
              <td>${esc(a.category || '—')}</td>
              <td>${esc(a.sourceModule)}</td>
              <td>${fmt(a.submittedAt || a.createdAt)}</td>
              <td>${esc(a.reviewer || '—')}</td>
              <td>${esc(a.statusAr)}</td>
              <td>
                <button type="button" class="btn btn-primary btn-sm" data-aopen="${esc(a.id)}">عرض</button>
                <button type="button" class="btn btn-ghost btn-sm" data-aact="assign" data-id="${esc(a.id)}">تعيين</button>
                <button type="button" class="btn btn-dark btn-sm" data-aact="approve" data-id="${esc(a.id)}">اعتماد</button>
              </td>
            </tr>`
              )
              .join('') || '<tr><td colspan="9">لا مقالات واردة بعد. عندما يرسل عميل مقالاً من blog.html يظهر هنا تلقائياً.</td></tr>'
          }
        </tbody>
      </table></div>
    </div>`;
  }

  function renderFlows() {
    const s = A().settings();
    return `<div class="card" style="padding:16px">
      <h3>WF-ARTICLE-01 — ${esc(s.workflowName)}</h3>
      <p>Module: Content · Trigger: New Article Submitted · Status: Active</p>
      <div style="margin:16px 0;padding:14px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:700;line-height:2">
        1. استقبال المقال ↓<br>
        2. التحقق من البيانات ↓<br>
        3. إنشاء Article ID ↓<br>
        4. إشعار فريق المحتوى ↓<br>
        5. تعيين مراجع ↓<br>
        6. انتظار القرار ↓<br>
        7. اعتماد / طلب تعديل ↓<br>
        8. النشر ↓<br>
        9. إرسال إشعار
      </div>
      <p class="muted">العميل لا يرى محرك Workflow — يرى فقط: «المرحلة الحالية: قيد المراجعة».</p>
    </div>`;
  }

  function renderRuns() {
    const runs = A().listRuns();
    return `<div class="card" style="padding:14px"><div class="table-wrap"><table class="data" style="width:100%">
      <thead><tr><th>Run ID</th><th>Workflow</th><th>Article</th><th>Trigger</th><th>Current Step</th><th>Status</th><th>Started</th></tr></thead>
      <tbody>${
        runs
          .map(
            (r) => `<tr>
          <td><code>${esc(r.runId)}</code></td>
          <td>${esc(r.workflowName)}</td>
          <td><button type="button" class="btn btn-ghost btn-sm" data-aopen="${esc(r.articleId)}">${esc(r.articleId)}</button></td>
          <td>${esc(r.trigger)}</td>
          <td>${esc(r.currentStep)}</td>
          <td>${esc(r.status)}</td>
          <td>${fmt(r.startedAt)}</td>
        </tr>`
          )
          .join('') || '<tr><td colspan="7">لا تشغيلات بعد</td></tr>'
      }</tbody>
    </table></div></div>`;
  }

  function renderSettings() {
    const s = A().settings();
    return `<div class="card" style="padding:16px">
      <h3>إعدادات المقالات</h3>
      <div class="toolbar" style="flex-wrap:wrap;gap:10px">
        <div class="field"><label>المراجع الافتراضي</label><input id="art-def-rev" value="${esc(s.defaultReviewer)}" /></div>
        <div class="field"><label>حد ملف المقال (MB)</label><input id="art-max-mb" type="number" value="${esc(s.maxArticleMb)}" /></div>
        <button type="button" class="btn btn-primary" data-aact="save-settings">حفظ</button>
      </div>
      <p style="margin-top:12px;color:#6b7280">التصنيفات والصيغ تُدار من وحدة HubArticles. العملاء يرفعون من blog.html فقط.</p>
    </div>`;
  }

  function paintBody() {
    const body = document.getElementById('art-admin-body');
    if (!body) return;
    if (state.tab === 'flows') body.innerHTML = renderFlows();
    else if (state.tab === 'runs') body.innerHTML = renderRuns();
    else if (state.tab === 'settings') body.innerHTML = renderSettings();
    else body.innerHTML = renderInbox();
    wire();
  }

  function wire() {
    document.querySelectorAll('[data-atab]').forEach((b) => {
      b.onclick = () => {
        state.tab = b.getAttribute('data-atab');
        state.id = '';
        paintBody();
      };
    });
    document.getElementById('art-aq')?.addEventListener('input', (e) => {
      state.q = e.target.value;
      paintBody();
    });
    document.getElementById('art-astatus')?.addEventListener('change', (e) => {
      state.status = e.target.value;
      paintBody();
    });
    document.querySelectorAll('[data-aopen]').forEach((b) => {
      b.onclick = () => {
        state.tab = 'inbox';
        state.id = b.getAttribute('data-aopen');
        paintBody();
      };
    });
    document.querySelector('[data-aback]')?.addEventListener('click', () => {
      state.id = '';
      paintBody();
    });
    document.querySelectorAll('[data-aact]').forEach((b) => {
      b.onclick = () => {
        const act = b.getAttribute('data-aact');
        const id = b.getAttribute('data-id');
        if (act === 'assign') {
          const name = prompt('اسم المراجع', A().settings().defaultReviewer || 'Content Desk');
          if (name) A().assignReviewer(id, name);
        } else if (act === 'changes') {
          const note = prompt('سبب طلب التعديل');
          if (note) A().requestChanges(id, note);
        } else if (act === 'approve') A().approve(id);
        else if (act === 'publish') A().publishNow(id);
        else if (act === 'reject') {
          const note = prompt('سبب الرفض');
          if (note) A().reject(id, note);
        } else if (act === 'save-settings') {
          A().saveSettings({
            defaultReviewer: document.getElementById('art-def-rev')?.value || 'Content Desk',
            maxArticleMb: Number(document.getElementById('art-max-mb')?.value) || 15,
          });
          alert('تم الحفظ');
        }
        paintBody();
      };
    });
  }

  function mount(root) {
    if (!root) return;
    if (!A()) {
      root.innerHTML = '<p class="empty">وحدة المقالات غير محمّلة.</p>';
      return;
    }
    root.innerHTML = shell();
    paintBody();
  }

  window.HubArticlesAdmin = { mount, state };
})();
