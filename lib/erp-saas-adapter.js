/**
 * محوّل HUB → ERP SaaS: إنشاء مستأجر فعلي عبر واجهات ERP العامة.
 * مصدر الحقيقة للتشغيل: ERP؛ قرار المنح والسجل: HUB.
 */
const DEFAULT_ERP_BASE = process.env.ERP_BASE_URL || 'https://web-production-419e2.up.railway.app';

const DEFAULT_PAGES = ['dashboard', 'finance', 'hr'];

async function erpFetch(base, pathname, { method = 'GET', body, timeoutMs = 12000 } = {}) {
  const url = `${String(base).replace(/\/$/, '')}${pathname}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message || 'fetch failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function getConfig(base = DEFAULT_ERP_BASE) {
  const { data } = await erpFetch(base, '/api/saas/config', { timeoutMs: 8000 });
  return data?.success ? data : null;
}

async function validateSubdomain(subdomain, base = DEFAULT_ERP_BASE) {
  const slug = String(subdomain || '')
    .trim()
    .toLowerCase();
  const { ok, data, error } = await erpFetch(base, '/api/saas/validate-subdomain', {
    method: 'POST',
    body: { subdomain: slug },
    timeoutMs: 8000,
  });
  // ERP unreachable/timeout → لا نحظر هوب؛ نسمح بالمتابعة محليًا
  if (!ok || !data) {
    return {
      ok: true,
      available: true,
      degraded: true,
      subdomain: slug,
      message: error ? `تعذّر التحقق من ERP (${error}) — النطاق مقبول مؤقتًا في هوب` : 'تعذّر التحقق من ERP — النطاق مقبول مؤقتًا في هوب',
    };
  }
  return {
    ok: Boolean(data.success),
    available: Boolean(data.available),
    subdomain: data.subdomain || slug,
    message: data.message || (data.available ? 'متاح!' : 'غير متاح'),
  };
}

function mapSystemsToPages(systems = []) {
  const codes = systems.map((c) => String(c).toUpperCase());
  if (!codes.length || codes.includes('ERP')) return DEFAULT_PAGES.slice();
  // أنظمة أخرى لاحقًا — حاليًا ERP هو المحرك الأول
  return DEFAULT_PAGES.slice();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollStatus(token, base = DEFAULT_ERP_BASE, { maxAttempts = 45, intervalMs = 2000 } = {}) {
  let last = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    const { data } = await erpFetch(base, `/api/saas/signup/status/${encodeURIComponent(token)}`);
    last = data;
    if (data?.status === 'ready' && data?.loginUrl) {
      return { ok: true, status: 'ready', loginUrl: data.loginUrl, steps: data.steps || [], raw: data };
    }
    if (data?.status === 'failed') {
      const failed = (data.steps || []).find((s) => s.status === 'failed');
      return {
        ok: false,
        status: 'failed',
        message: failed?.message || data.message || 'فشل تجهيز المستأجر في ERP',
        steps: data.steps || [],
        raw: data,
      };
    }
    await sleep(intervalMs);
  }
  return {
    ok: false,
    status: last?.status || 'timeout',
    message: 'انتهت مهلة انتظار تجهيز ERP',
    steps: last?.steps || [],
    raw: last,
  };
}

/**
 * مسار كامل: start → modules → payment/create-session → poll ready
 */
async function provisionTenant(payload = {}, base = DEFAULT_ERP_BASE) {
  const subdomain = String(payload.subdomain || payload.slug || '')
    .trim()
    .toLowerCase();
  const companyName = String(payload.companyName || '').trim();
  const adminName = String(payload.adminName || '').trim();
  const adminPhone = String(payload.adminPhone || '').trim();
  const adminEmail = String(payload.adminEmail || '').trim().toLowerCase();
  const adminPassword = String(payload.adminPassword || '');
  const plan = String(payload.plan || 'basic').toLowerCase();
  const pages = Array.isArray(payload.pages) && payload.pages.length
    ? payload.pages
    : mapSystemsToPages(payload.systems || []);

  if (!subdomain || !companyName || !adminName || !adminPhone || !adminPassword) {
    return { ok: false, error: 'بيانات التجهيز ناقصة (شركة / نطاق / مسؤول / كلمة مرور)' };
  }
  if (adminPassword.length < 8) {
    return { ok: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  }

  const start = await erpFetch(base, '/api/saas/signup/start', {
    method: 'POST',
    body: { subdomain, companyName, plan, adminName, adminPhone, adminEmail, adminPassword },
  });
  if (!start.data?.success || !start.data?.token) {
    return { ok: false, error: start.data?.message || 'فشل بدء التسجيل في ERP', stage: 'start' };
  }
  const token = start.data.token;

  const modules = await erpFetch(base, '/api/saas/signup/modules', {
    method: 'POST',
    body: { token, pages, page_restrictions: payload.page_restrictions || {} },
  });
  if (!modules.data?.success) {
    return { ok: false, error: modules.data?.message || 'فشل حفظ الأنظمة في ERP', stage: 'modules', token };
  }

  const pay = await erpFetch(base, '/api/saas/payment/create-session', {
    method: 'POST',
    body: { token, provider: payload.payMethod || 'hub' },
  });
  if (!pay.data?.success) {
    return { ok: false, error: pay.data?.message || 'فشل بدء التجهيز في ERP', stage: 'payment', token };
  }

  // خطط مدفوعة قد تحتاج دفعًا حقيقيًا — نُرجع الحالة للمتابعة
  if (!pay.data.skipPayment && !pay.data.provisioning && !pay.data.alreadyVerified) {
    return {
      ok: false,
      pendingPayment: true,
      token,
      paymentUrl: pay.data.paymentUrl || pay.data.checkoutUrl || pay.data.redirectUrl || null,
      message: pay.data.message || 'يلزم إتمام الدفع في ERP قبل التجهيز',
      stage: 'payment',
    };
  }

  const ready = await pollStatus(token, base);
  if (!ready.ok) {
    return { ok: false, error: ready.message, stage: 'provision', token, steps: ready.steps };
  }

  // تأكيد أن مسار المستأجر فعليًا يستجيب قبل إعلان النجاح في هوب
  const loginPage = `${String(base).replace(/\/$/, '')}/t/${encodeURIComponent(subdomain)}/login-page.html?login=1`;
  const probe = await erpFetch(base, `/t/${encodeURIComponent(subdomain)}/`, { timeoutMs: 8000 });
  const bodyText =
    probe.data && typeof probe.data === 'object' && probe.data.error
      ? String(probe.data.error)
      : '';
  if (probe.status === 404 || /المستأجر غير موجود/i.test(bodyText)) {
    return {
      ok: false,
      error: 'ERP أبلغ عن اكتمال التجهيز لكن المستأجر غير ظاهر بعد — أعد المحاولة بعد لحظات',
      stage: 'verify',
      token,
      steps: ready.steps,
    };
  }

  const config = await getConfig(base).catch(() => null);
  return {
    ok: true,
    token,
    loginUrl: loginPage,
    hostPath: `/t/${subdomain}`,
    publicOrigin: config?.publicOrigin || base,
    accessMode: config?.accessMode || 'path',
    steps: ready.steps,
    message: 'تم تجهيز مستأجر ERP بنجاح عبر HUB',
  };
}

module.exports = {
  DEFAULT_ERP_BASE,
  DEFAULT_PAGES,
  getConfig,
  validateSubdomain,
  mapSystemsToPages,
  provisionTenant,
  pollStatus,
};
