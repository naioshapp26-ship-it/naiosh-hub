/**
 * Multi-gateway payment registry for NAIOSH HUB packages.
 * No real charges unless the matching secret env vars are set.
 * Display FX ≠ settlement acceptance.
 */
'use strict';

/**
 * Regional guidance (merchant must verify current onboarding eligibility):
 * - Stripe: strong developer UX; business entity often needed in supported country (e.g. UAE). Not a sole MENA solution.
 * - Paymob: Egypt / UAE / KSA / Oman — local cards, wallets; Egypt SME ~2.75%+EGP3 (verify current pricing).
 * - Tap Payments: GCC + Egypt + Jordan coverage (verify); Apple Pay / local methods.
 * - Moyasar: Saudi-focused, mada-friendly rates (verify current commercial terms).
 *
 * Fees below are approximate public figures for planning only — not a contract.
 */
const GATEWAYS = [
  {
    // Egypt-first launch gateway; keep ahead of Stripe so public status prefers Paymob when both exist.
    id: 'paymob',
    nameAr: 'Paymob',
    nameEn: 'Paymob',
    envReady: () => {
      try {
        return require('./hub-paymob').configured();
      } catch {
        return Boolean(
          String(process.env.PAYMOB_API_KEY || '').trim() &&
            String(process.env.PAYMOB_INTEGRATION_ID || '').trim() &&
            String(process.env.PAYMOB_HMAC_SECRET || '').trim()
        );
      }
    },
    webhookEnv: 'PAYMOB_HMAC_SECRET',
    settlementCurrencies: () =>
      String(process.env.HUB_PAYMOB_SETTLEMENT_CURRENCIES || 'EGP,AED,SAR')
        .split(/[,\s]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    focusMarketsAr: 'مصر أولًا · ثم الإمارات / السعودية / عُمان — بطاقات محلية ومحافظ في مصر.',
    approxFeesAr: 'مثال مصر (SME): نحو 2.75% + 3 ج.م؛ الخليج يختلف (تحقق من عقد التاجر).',
    methodsAr: ['بطاقات محلية', 'محافظ إلكترونية (مصر)', 'Apple Pay حسب التفعيل'],
    docsUrl: 'https://developers.paymob.com/',
  },
  {
    id: 'stripe',
    nameAr: 'Stripe',
    nameEn: 'Stripe',
    envReady: () => Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim()),
    webhookEnv: 'STRIPE_WEBHOOK_SECRET',
    settlementCurrencies: () =>
      String(process.env.HUB_STRIPE_SETTLEMENT_CURRENCIES || process.env.HUB_PAYMENT_SETTLEMENT_CURRENCIES || 'USD')
        .split(/[,\s]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    focusMarketsAr: 'مناسب أكثر إن كان الكيان التجاري مسجّلًا في دولة يدعمها Stripe (مثل الإمارات). لا تعتمد عليه وحده لمصر أو السعودية.',
    approxFeesAr: 'حوالي 2.9% + رسوم ثابتة محلية (يتغير حسب الدولة والطاقة الاستيعابية).',
    methodsAr: ['بطاقات دولية', 'Apple Pay حسب الدولة'],
    docsUrl: 'https://stripe.com/docs/checkout/quickstart',
  },
  {
    id: 'tap',
    nameAr: 'Tap Payments',
    nameEn: 'Tap Payments',
    envReady: () => Boolean(String(process.env.TAP_SECRET_KEY || '').trim()),
    webhookEnv: 'TAP_WEBHOOK_SECRET',
    settlementCurrencies: () =>
      String(process.env.HUB_TAP_SETTLEMENT_CURRENCIES || 'SAR,AED,KWD,BHD,QAR,OMR,EGP,JOD')
        .split(/[,\s]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    focusMarketsAr: 'تغطية خليجية واسعة + مصر والأردن (تحقق من أهلية التسجيل).',
    approxFeesAr: 'شائع الإعلان عن نحو 2.75% + رسوم ثابتة — يعتمد على الدولة وطريقة الدفع.',
    methodsAr: ['مدى / بطاقات محلية', 'Apple Pay', 'KNET حسب الدولة'],
    docsUrl: 'https://developers.tap.company/',
  },
  {
    id: 'moyasar',
    nameAr: 'Moyasar',
    nameEn: 'Moyasar',
    envReady: () => Boolean(String(process.env.MOYASAR_SECRET_KEY || '').trim()),
    webhookEnv: 'MOYASAR_WEBHOOK_SECRET',
    settlementCurrencies: () =>
      String(process.env.HUB_MOYASAR_SETTLEMENT_CURRENCIES || 'SAR')
        .split(/[,\s]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    focusMarketsAr: 'مركّز على السعودية وبطاقات مدى.',
    approxFeesAr: 'مدى غالبًا أقل من البطاقات الائتمانية الدولية (تحقق من التسعير التجاري الحالي).',
    methodsAr: ['مدى', 'Visa/Mastercard', 'Apple Pay'],
    docsUrl: 'https://docs.moyasar.com/',
  },
];

function listGateways() {
  return GATEWAYS.map((g) => {
    const ready = g.envReady();
    return {
      id: g.id,
      nameAr: g.nameAr,
      nameEn: g.nameEn,
      configured: ready,
      settlementCurrencies: g.settlementCurrencies(),
      focusMarketsAr: g.focusMarketsAr,
      approxFeesAr: g.approxFeesAr,
      methodsAr: g.methodsAr,
      docsUrl: g.docsUrl,
      webhookEnv: g.webhookEnv,
      statusAr: ready ? 'مفاتيح البيئة موجودة — جاهز للربط التشغيلي' : 'غير مفعّل (لا مفاتيح في البيئة)',
    };
  });
}

function activeGateways() {
  return listGateways().filter((g) => g.configured);
}

function paymentStatusPublic() {
  const all = listGateways();
  const active = all.filter((g) => g.configured);
  const primary = active.find((g) => g.id === 'paymob') || active[0] || null;
  const settlement = [...new Set(active.flatMap((g) => g.settlementCurrencies))];
  let stubMode = false;
  try {
    stubMode = require('./hub-paymob').stubAllowed() && Boolean(active.find((g) => g.id === 'paymob'));
  } catch {
    stubMode = false;
  }
  return {
    available: active.length > 0,
    gateway: primary?.id || null,
    gateways: all,
    activeGatewayIds: active.map((g) => g.id),
    settlementCurrencies: settlement.length ? settlement : ['USD'],
    displayFxOnly: true,
    stubMode,
    messageAr: active.length
      ? `بوابات مفعّلة: ${active.map((g) => g.nameAr).join(' · ')}. لن تُضاف النقاط إلا بعد إشعار موثوق من البوابة.` +
        (stubMode ? ' (وضع تجريبي Paymob — غير مسموح في الإنتاج)' : '')
      : 'الدفع الإلكتروني غير متاح حاليًا. لا توجد مفاتيح تاجر في بيئة التشغيل. يمكنك إنشاء طلب شحن للمراجعة الإدارية؛ لن تُضاف النقاط قبل تأكيد موثوق.',
    recommendationAr:
      'للانطلاق من مصر: Paymob هي البوابة الأساسية (حساب تاجر حقيقي + HMAC). لاحقًا للخليج: Paymob و/أو Tap و/أو Moyasar حسب دولة التسجيل. Stripe اختياري للكيانات في دولة يدعمها Stripe — لا تعتمد عليه وحده لمصر.',
  };
}

function preferredGatewayForCurrency(currency) {
  const code = String(currency || 'USD').toUpperCase();
  const active = activeGateways();
  const hit = active.find((g) => g.settlementCurrencies.includes(code));
  return hit || active[0] || null;
}

module.exports = {
  GATEWAYS,
  listGateways,
  activeGateways,
  paymentStatusPublic,
  preferredGatewayForCurrency,
};
