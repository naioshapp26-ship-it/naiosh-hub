/**
 * Hub System Runtime — تشغيل النظام منفردًا أو عبر هوب + رفع بيانات + إشعارات
 */
(() => {
  const params = new URLSearchParams(window.location.search);
  const code = String(document.body.dataset.systemCode || params.get('code') || '').toUpperCase();
  const fromHub = params.get('from') === 'hub' || params.get('hub') === '1';
  const standalone = params.get('mode') === 'standalone' || (!fromHub && params.get('from') !== 'hub');
  const returnUrl = params.get('return') || '../dashboard.html#apps';

  const meta = window.HubLauncher?.SYSTEM_META?.[code] || {
    nameAr: code || 'نظام نايوش',
    icon: 'fa-cube',
    domain: 'naioshhub360.com',
    color: '#dc2626',
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg) => {
    let el = document.getElementById('sys-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sys-toast';
      el.className = 'sys-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  };

  const logLine = (text, type = 'info') => {
    const list = document.getElementById('sys-log');
    if (!list) return;
    const li = document.createElement('li');
    li.innerHTML = `<b>${esc(type)}:</b> ${esc(text)} <small>${new Date().toLocaleTimeString('ar-EG')}</small>`;
    list.prepend(li);
  };

  const buildPayload = () => ({
    code,
    nameAr: meta.nameAr,
    domain: meta.domain,
    mode: fromHub ? 'hub' : 'standalone',
    health: 90 + Math.floor(Math.random() * 9),
    status: 'online',
    metrics: {
      activeUsers: 40 + Math.floor(Math.random() * 80),
      openTickets: Math.floor(Math.random() * 12),
      syncLagSec: Math.floor(Math.random() * 20),
    },
    modules: [
      { id: 'core', nameAr: 'النواة', status: 'active' },
      { id: 'ops', nameAr: 'التشغيل', status: 'active' },
      { id: 'reports', nameAr: 'التقارير', status: 'active' },
    ],
    uploadedAt: new Date().toISOString(),
  });

  const pushLocalNotification = (n) => {
    if (window.HubStore?.pushNotification) {
      return window.HubStore.pushNotification(n);
    }
    return null;
  };

  const syncToHub = async ({ notify = true } = {}) => {
    const payload = buildPayload();
    let local = null;
    if (window.HubStore?.ingestSystemSync) {
      local = window.HubStore.ingestSystemSync(payload);
    }
    if (notify) {
      pushLocalNotification({
        source: code,
        sourceName: meta.nameAr,
        title: `مزامنة ${meta.nameAr}`,
        body: `تم رفع معلومات النظام إلى هوب · صحة ${payload.health}% · الوضع ${payload.mode}`,
        level: 'info',
        category: 'sync',
        link: `../systems/${code.toLowerCase()}.html?from=hub`,
      });
    }

    let remote = null;
    try {
      const res = await fetch('/api/hub/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      remote = await res.json();
    } catch (err) {
      remote = { ok: false, error: err.message };
    }

    logLine(`رُفعت بيانات ${code} إلى هوب (صحة ${payload.health}%)`, 'sync');
    toast(remote?.ok ? 'تم رفع المعلومات على هوب' : 'تم الحفظ محليًا في هوب');
    return { local, remote, payload };
  };

  const sendNotification = async (title, body, level = 'info') => {
    const note = {
      source: code,
      sourceName: meta.nameAr,
      title,
      body,
      level,
      category: 'system',
      link: `../systems/${code.toLowerCase()}.html?from=hub`,
    };
    pushLocalNotification(note);
    try {
      await fetch('/api/hub/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
    } catch (_) {}
    logLine(title, 'notify');
    toast('أُرسل الإشعار إلى هوب');
  };

  const render = () => {
    document.documentElement.style.setProperty('--sys-accent', meta.color || '#dc2626');
    document.title = `${meta.nameAr} | نايوش`;

    const modeLabel = fromHub ? 'تشغيل عبر هوب' : 'تشغيل منفرد';
    const modeClass = fromHub ? 'is-hub' : 'is-solo';

    document.body.innerHTML = `
      <header class="sys-top">
        <div class="sys-brand">
          <i class="fas ${esc(meta.icon)}"></i>
          <div>
            <strong>${esc(meta.nameAr)}</strong>
            <span>${esc(code)} · ${esc(meta.domain)}</span>
          </div>
        </div>
          <div class="sys-mode ${modeClass}"><i class="fas ${fromHub ? 'fa-satellite-dish' : 'fa-window-restore'}"></i> ${modeLabel}</div>
        <div class="sys-actions">
          ${fromHub ? `<a class="sys-btn ghost" href="${esc(returnUrl)}"><i class="fas fa-arrow-right"></i> العودة لهوب</a>` : ''}
          <a class="sys-btn ghost" href="../apps.html"><i class="fas fa-cubes"></i> سجل الأنظمة</a>
          <a class="sys-btn ghost" href="../dashboard.html#notifications"><i class="fas fa-bell"></i> إشعارات هوب</a>
        </div>
      </header>
      <main class="sys-wrap">
        <section class="sys-hero">
          <h1>${esc(meta.nameAr)}</h1>
          <p>
            ${fromHub
              ? 'تم فتح النظام مباشرة من هوب. يمكنك العمل هنا ثم رفع كل المعلومات والإشعارات إلى مركز هوب الموحّد.'
              : 'النظام يعمل بشكل منفرد. يمكنك لاحقًا الربط بهوب لرفع البيانات والإشعارات دون إيقاف التشغيل المستقل.'}
          </p>
        </section>
        <div class="sys-kpis">
          <div class="sys-kpi"><strong id="kpi-health">—</strong><span>صحة النظام</span></div>
          <div class="sys-kpi"><strong id="kpi-users">—</strong><span>مستخدمون نشطون</span></div>
          <div class="sys-kpi"><strong id="kpi-mode">${fromHub ? 'HUB' : 'SOLO'}</strong><span>وضع التشغيل</span></div>
        </div>
        <div class="sys-grid">
          <article class="sys-card">
            <h3><i class="fas fa-cloud-arrow-up"></i> رفع المعلومات على هوب</h3>
            <p>يرسل المقاييس والحالة والوحدات إلى سجل هوب ومركز الإشعارات.</p>
            <button type="button" class="sys-btn primary" id="btn-sync"><i class="fas fa-upload"></i> رفع الكل الآن</button>
          </article>
          <article class="sys-card">
            <h3><i class="fas fa-bell"></i> إرسال إشعار لهوب</h3>
            <p>أي تنبيه من هذا النظام يظهر في مركز إشعارات هوب الموحّد.</p>
            <button type="button" class="sys-btn" id="btn-notify"><i class="fas fa-paper-plane"></i> إشعار تجريبي</button>
          </article>
          <article class="sys-card">
            <h3><i class="fas fa-shuffle"></i> تبديل وضع التشغيل</h3>
            <ul>
              <li>عبر هوب: انتقال مباشر مع سياق العودة</li>
              <li>منفرد: تشغيل مستقل بدون اعتماد على الواجهة المركزية</li>
            </ul>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              <a class="sys-btn" href="?from=hub&return=${encodeURIComponent(returnUrl)}"><i class="fas fa-bolt"></i> عبر هوب</a>
              <a class="sys-btn" href="?mode=standalone"><i class="fas fa-window-restore"></i> منفرد</a>
            </div>
          </article>
        </div>
        <ul class="sys-log" id="sys-log"></ul>
      </main>
    `;

    const payload = buildPayload();
    document.getElementById('kpi-health').textContent = `${payload.health}%`;
    document.getElementById('kpi-users').textContent = String(payload.metrics.activeUsers);

    document.getElementById('btn-sync')?.addEventListener('click', () => syncToHub({ notify: true }));
    document.getElementById('btn-notify')?.addEventListener('click', () =>
      sendNotification(
        `تنبيه من ${meta.nameAr}`,
        `حدث تشغيلي داخل ${code} يحتاج متابعة من غرفة عمليات هوب.`,
        'alert'
      )
    );

    logLine(fromHub ? 'تم الدخول مباشرة من هوب' : 'تشغيل منفرد جاهز', 'boot');

    // Auto announce arrival to Hub when launched from Hub
    if (fromHub) {
      pushLocalNotification({
        source: code,
        sourceName: meta.nameAr,
        title: `فُتح ${meta.nameAr} من هوب`,
        body: 'انتقال مباشر إلى النظام نفسه — جاهز للتشغيل ورفع البيانات.',
        level: 'success',
        category: 'launch',
        link: `systems/${code.toLowerCase()}.html?from=hub`,
      });
      fetch('/api/hub/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: code,
          sourceName: meta.nameAr,
          title: `فُتح ${meta.nameAr} من هوب`,
          body: 'انتقال مباشر إلى النظام نفسه.',
          level: 'success',
          category: 'launch',
        }),
      }).catch(() => {});
    }
  };

  if (!code) {
    document.body.innerHTML = '<main class="sys-wrap"><h1>نظام غير محدد</h1><p>أضف رمز النظام في الرابط.</p></main>';
    return;
  }

  render();

  window.HubSystemRuntime = { code, fromHub, standalone, syncToHub, sendNotification, buildPayload };
})();
