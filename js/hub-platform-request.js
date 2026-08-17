/**
 * طلب منصة — صفحة واحدة · بدون دفع · بانتظار موافقة الأدمن
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-book="platform"]');
  if (!root) return;

  const form = root.querySelector('[data-platform-request-form]');
  const feedback = root.querySelector('[data-book-feedback]');
  const statusEl = root.querySelector('[data-subdomain-status]');
  const grants = () => window.HubPlatformGrants;

  let subdomainOk = false;

  const toast = (msg, ok = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.classList.toggle('is-error', !ok);
    feedback.classList.toggle('is-ok', ok);
  };

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fillPlatforms = () => {
    const select = form?.querySelector('[name="platform"]');
    if (!select) return;
    const list = window.HubSovereignPlatforms?.list || [];
    const params = new URLSearchParams(window.location.search);
    const pre = params.get('platform') || params.get('code') || '';

    const options = list.length
      ? list.map((p) => ({ id: p.code, label: `${p.nameAr}${p.role ? ` — ${p.role}` : ''}` }))
      : [
          { id: 'core', label: 'المنصة المركزية' },
          { id: 'ops', label: 'منصة التشغيل' },
          { id: 'gov', label: 'منصة الحوكمة' },
        ];

    select.innerHTML =
      `<option value="">اختر المنصة</option>` +
      options.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');

    if (pre && options.some((o) => o.id === pre)) select.value = pre;
  };

  const checkSubdomain = () => {
    const input = form?.querySelector('[name="subdomain"]');
    if (!input || !statusEl || !grants()) return;
    const raw = grants().normalizeSlug(input.value);
    input.value = raw;
    const res = grants().validateSubdomain(raw);
    subdomainOk = Boolean(res.available);
    statusEl.innerHTML = res.available
      ? `<i class="fas fa-circle-check"></i> ${esc(res.message)}`
      : raw
        ? `<i class="fas fa-circle-xmark"></i> ${esc(res.message)}`
        : esc(res.message);
    statusEl.className = `hub-book-subdomain-status ${res.available ? 'is-ok' : raw ? 'is-bad' : ''}`;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form || !grants()) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    checkSubdomain();
    if (!subdomainOk) {
      toast('تحقق من توفر النطاق الفرعي أولًا');
      return;
    }

    const fd = new FormData(form);
    const platform = String(fd.get('platform') || '');
    const platformLabel =
      form.querySelector('[name="platform"]')?.selectedOptions?.[0]?.textContent?.trim() || platform;

    const res = grants().submitRequest({
      companyName: String(fd.get('companyName') || '').trim(),
      subdomain: String(fd.get('subdomain') || '').trim(),
      adminName: String(fd.get('adminName') || '').trim(),
      adminPhone: String(fd.get('adminPhone') || '').trim(),
      adminEmail: String(fd.get('adminEmail') || '').trim(),
      adminPassword: String(fd.get('adminPassword') || ''),
      platform,
      platformLabel,
    });

    if (!res.ok) {
      toast(res.error || 'تعذّر إرسال الطلب');
      return;
    }

    toast(
      'تم إرسال طلب المنصة لموافقة أدمن نايوش هوب. بعد الاعتماد ستفعَّل الباقة المجانية — وعند انتهائها ستُطلب منك شحن الرصيد.',
      true
    );
    form.reset();
    subdomainOk = false;
    fillPlatforms();
    if (statusEl) {
      statusEl.textContent = 'أدخل النطاق الفرعي للتحقق من توفره';
      statusEl.className = 'hub-book-subdomain-status';
    }
  };

  const bind = async () => {
    await grants()?.hydrate?.();
    fillPlatforms();

    const suffix = root.querySelector('[data-subdomain-suffix]');
    if (suffix && grants()) suffix.textContent = `.${grants().BASE_DOMAIN}`;

    let timer = null;
    form?.querySelector('[name="subdomain"]')?.addEventListener('input', () => {
      clearTimeout(timer);
      subdomainOk = false;
      if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق…';
        statusEl.className = 'hub-book-subdomain-status';
      }
      timer = setTimeout(checkSubdomain, 400);
    });

    form?.addEventListener('submit', onSubmit);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
