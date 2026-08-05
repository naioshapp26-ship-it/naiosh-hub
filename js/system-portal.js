(() => {
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || 'ERP').toUpperCase();
  let mode = params.get('mode') === 'hub' ? 'hub' : 'standalone';

  const registry = window.HubSystemsRegistry;
  const store = window.HubStore;
  const meta = registry?.byCode?.[code] || {
    code,
    nameAr: code,
    nameEn: code,
    icon: 'fa-cube',
    category: 'أنظمة نايوش',
    desc: 'بوابة تشغيل النظام.',
    modules: ['التشغيل'],
    color: '#d70000',
  };

  const $ = (id) => document.getElementById(id);
  const toast = (msg) => {
    const el = $('sp-toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  };

  const paintMode = () => {
    const standalone = mode === 'standalone';
    $('sp-mode-label').textContent = standalone ? 'تشغيل مستقل' : 'تشغيل عبر هوب';
    $('sp-mode-pill').textContent = standalone ? 'وضع: تشغيل بشكل منفرد' : 'وضع: التشغيل عبر هوب';
    $('sp-mode-pill').classList.toggle('is-hub', !standalone);
    $('sp-status').textContent = standalone
      ? `${meta.nameAr} يعمل الآن بشكل منفرد — ويمكنه رفع البيانات والإشعارات إلى هوب.`
      : `${meta.nameAr} يعمل عبر هوب — الإشعارات والبيانات تتزامن مباشرة مع غرفة العمليات.`;
    document.title = `${meta.nameAr} | ${standalone ? 'تشغيل مستقل' : 'عبر هوب'}`;
  };

  const setMode = (next) => {
    mode = next;
    const url = new URL(location.href);
    url.searchParams.set('code', code);
    url.searchParams.set('mode', mode);
    history.replaceState({}, '', url);
    paintMode();
    store?.pushSystemNotification?.({
      source: code,
      sourceName: meta.nameAr,
      title: standaloneLabel(next),
      body: `تم تبديل وضع تشغيل ${meta.nameAr}`,
      severity: 'info',
    });
    toast(standaloneLabel(next));
  };

  const standaloneLabel = (m) => (m === 'hub' ? 'التشغيل عبر هوب مفعّل' : 'التشغيل المنفرد مفعّل');

  // paint shell
  $('sp-name').textContent = meta.nameAr;
  $('sp-title').textContent = meta.nameAr;
  $('sp-kicker').textContent = `${meta.category} · ${meta.nameEn || meta.code}`;
  $('sp-desc').textContent = meta.desc || '';
  $('sp-icon').className = `fas ${meta.icon || 'fa-cube'}`;
  $('notif-title').value = `تنبيه من ${meta.nameAr}`;
  $('upload-title').value = `حزمة بيانات ${meta.nameAr}`;
  $('sp-modules').innerHTML = (meta.modules || []).map((m) => `<li>${m}</li>`).join('');
  paintMode();

  // announce open
  store?.recordSystemLaunch?.({
    code,
    nameAr: meta.nameAr,
    mode,
  });

  $('btn-switch-standalone')?.addEventListener('click', () => setMode('standalone'));
  $('btn-switch-hub')?.addEventListener('click', () => setMode('hub'));

  $('btn-send-notif')?.addEventListener('click', () => {
    const title = $('notif-title')?.value.trim();
    const body = $('notif-body')?.value.trim();
    if (!title) return toast('اكتب عنوان الإشعار');
    const item = store?.pushSystemNotification?.({
      source: code,
      sourceName: meta.nameAr,
      title,
      body: body || `إشعار وارد من ${meta.nameAr}`,
      severity: 'alert',
    });
    if (!item) return toast('تعذّر الإرسال — تأكد من تحميل هوب');
    toast('وصل الإشعار إلى هوب');
    $('notif-body').value = '';
  });

  $('btn-upload-hub')?.addEventListener('click', async () => {
    const title = $('upload-title')?.value.trim();
    const kind = $('upload-kind')?.value || 'sync';
    const payload = $('upload-payload')?.value.trim();
    const fileInput = $('upload-file');
    const file = fileInput?.files?.[0];
    if (!title) return toast('اكتب عنوان الحزمة');
    if (!payload && !file) return toast('أضف ملخصًا أو ملفًا للرفع');

    let fileMeta = null;
    if (file) {
      fileMeta = { name: file.name, type: file.type, size: file.size };
    }

    const item = store?.ingestSystemUpload?.({
      source: code,
      sourceName: meta.nameAr,
      title,
      kind,
      payload: payload || `ملف: ${fileMeta?.name || ''}`,
      fileMeta,
      mode,
    });
    if (!item) return toast('تعذّر الرفع');
    toast('تم رفع المعلومات على هوب');
    $('upload-payload').value = '';
    if (fileInput) fileInput.value = '';
  });
})();
