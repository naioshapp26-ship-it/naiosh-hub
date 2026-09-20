/**
 * Site Settings — central admin settings bag + audit log
 * Key: naiosh_site_settings_v1
 */
(function () {
  'use strict';

  const KEY = 'naiosh_site_settings_v1';

  const nowIso = () => new Date().toISOString();

  const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 7)}`;

  const defaults = () => ({
    schemaVersion: 1,
    general: {
      platformName: 'NAIOSH HUB 360',
      siteLogo: '',
      favicon: '',
      language: 'ar',
      timezone: 'Asia/Riyadh',
      dateFormat: 'YYYY-MM-DD',
      supportEmail: 'support@naioshai.com',
      supportPhone: '',
      maintenanceMode: false,
    },
    orders: {
      requestIdFormat: 'YYYY-#####',
      requireAdminApproval: true,
      defaultRequestStatus: 'Pending Review',
      autoAssignment: false,
      defaultDepartment: 'Sales',
      slaHours: 4,
      requestNotifications: true,
      customerRequestRouting: true,
    },
    payment: {
      defaultCurrency: 'USD',
      paymentMethods: 'card,wallet',
      taxEnabled: false,
      taxRate: 0,
      invoicePrefix: 'INV-',
      refundWindowDays: 14,
      paymentNotifications: true,
      statusRules: 'pending→paid→refunded',
    },
    shipping: {
      enableShipping: false,
      methods: 'standard,express',
      regions: 'global',
      fees: '0',
      freeShippingMin: 0,
      estimatedDelivery: '3-7 أيام',
      trackingEnabled: true,
    },
    ads: {
      enableAdvertisements: true,
      requireAdminApproval: true,
      allowedTypes: 'image,video,text,file',
      maxImageMb: 5,
      maxVideoMb: 50,
      maxFileMb: 20,
      defaultDurationDays: 30,
      placements: 'home,store,products',
      ctaTypes: 'learn_more,buy,contact',
      autoExpiration: true,
    },
    content: {
      enableArticles: true,
      requireArticleApproval: true,
      categories: 'عام,أخبار,معرفة',
      allowedUploadTypes: 'jpg,png,webp,pdf,docx',
      maxImageMb: 5,
      maxAttachmentMb: 15,
      publishingWorkflow: 'draft→review→publish',
      moderationEnabled: true,
    },
    notifications: {
      inApp: true,
      email: true,
      sms: false,
      push: false,
      templates: {
        newRequest: 'طلب جديد بانتظار المراجعة',
        requestApproved: 'تمت الموافقة على طلبك',
        requestRejected: 'تم رفض طلبك',
        articleApproved: 'تمت الموافقة على مقالك',
        adApproved: 'تمت الموافقة على إعلانك',
        productApproved: 'تمت الموافقة على منتجك',
      },
    },
    integrations: {
      apisEnabled: true,
      webhooksEnabled: false,
      externalSystems: '',
      connectionStatus: 'idle',
      lastSync: '',
      syncIntervalMin: 60,
    },
    security: {
      sessionTimeoutMin: 60,
      passwordMinLength: 8,
      mfaRequired: false,
      maxLoginAttempts: 5,
      lockoutMinutes: 15,
      ipRestrictions: '',
      auditLogging: true,
    },
    seo: {
      siteTitle: 'NAIOSH HUB 360',
      metaDescription: 'منصة نايوش هوب للمعرفة والتشغيل',
      keywords: 'naiosh,hub,360',
      openGraphImage: '',
      canonicalBase: 'https://naioshai.com',
      indexingEnabled: true,
      sitemapEnabled: true,
      robots: 'index,follow',
    },
    searchEngines: {
      google: {
        enabled: true,
        cx: '',
        cardTitle: 'محرك بحث جوجل',
        cardDescription: 'ابحث على الإنترنت باستخدام جوجل',
        resultsMode: 'web',
        openLinksInNewTab: true,
      },
    },
    permissions: {
      viewSiteSettings: true,
      manageSiteSettings: true,
      manageStores: true,
      createStore: true,
      editStore: true,
      disableStore: true,
      archiveStore: true,
      managePaymentSettings: true,
      manageSecuritySettings: true,
      manageIntegrations: true,
    },
    storeModule: {
      products: {
        defaultCurrency: 'USD',
        requireProductUrl: true,
        requireAdminApproval: true,
        allowExternalStores: true,
        allowCustomerAddProduct: true,
        allowCustomerSuggestStore: true,
        openExternalLinksInNewTab: true,
      },
      general: {
        storeStatus: 'enabled',
        productsPerPage: 24,
        defaultView: 'grid',
        showStoreLogo: true,
        showStoreName: true,
        showProductSource: true,
        showProductPrice: true,
        currencyDisplay: 'USD ($)',
        enableSearch: true,
        enableFilters: true,
        enableReviews: false,
        enableProductSharing: true,
      },
    },
    audit: [],
    updatedAt: '',
    updatedBy: '',
  });

  const deepMerge = (base, patch) => {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(patch || {}).forEach((k) => {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], v);
      } else {
        out[k] = v;
      }
    });
    return out;
  };

  const load = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.schemaVersion) return deepMerge(defaults(), raw);
    } catch (_) {}
    const bag = defaults();
    try {
      localStorage.setItem(KEY, JSON.stringify(bag));
    } catch (_) {}
    return bag;
  };

  let state = load();

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('hub-site-settings-changed', { detail: state }));
    } catch (_) {}
  };

  const actorName = () => {
    try {
      const u = window.HubAuth?.getUser?.() || JSON.parse(localStorage.getItem('hubUser') || '{}');
      return u?.name || u?.email || 'Admin';
    } catch (_) {
      return 'Admin';
    }
  };

  const actorRole = () => {
    try {
      const u = window.HubAuth?.getUser?.() || JSON.parse(localStorage.getItem('hubUser') || '{}');
      return u?.role || 'admin';
    } catch (_) {
      return 'admin';
    }
  };

  const logAudit = (entry = {}) => {
    if (!Array.isArray(state.audit)) state.audit = [];
    const row = {
      id: uid('TX'),
      section: entry.section || 'general',
      action: entry.action || entry.setting || 'Updated',
      setting: entry.setting || entry.action || '',
      storeId: entry.storeId || '',
      oldValue: entry.oldValue == null ? '' : String(entry.oldValue).slice(0, 500),
      newValue: entry.newValue == null ? '' : String(entry.newValue).slice(0, 500),
      changedBy: entry.changedBy || actorName(),
      role: entry.role || actorRole(),
      at: nowIso(),
    };
    state.audit.unshift(row);
    state.audit = state.audit.slice(0, 500);
    save();
    return row;
  };

  const can = (perm) => {
    const p = state.permissions || {};
    if (perm && p[perm] === false) return false;
    try {
      if (window.HubAuth?.isStaff && !window.HubAuth.isStaff()) return false;
    } catch (_) {}
    return true;
  };

  const get = () => state;

  const getSection = (key) => state[key];

  const updateSection = (section, patch = {}, actor) => {
    if (!can('manageSiteSettings') && section !== 'storeModule') {
      throw new Error('ليست لديك صلاحية تعديل إعدادات الموقع');
    }
    if (section === 'payment' && !can('managePaymentSettings')) throw new Error('لا صلاحية لإعدادات الدفع');
    if (section === 'security' && !can('manageSecuritySettings')) throw new Error('لا صلاحية لإعدادات الأمان');
    if (section === 'integrations' && !can('manageIntegrations')) throw new Error('لا صلاحية للتكاملات');

    const prev = JSON.stringify(state[section] || {});
    state[section] = deepMerge(state[section] || {}, patch);
    if (section === 'storeModule') {
      if (state.storeModule?.products) state.storeModule.products.defaultCurrency = 'USD';
    }
    state.updatedAt = nowIso();
    state.updatedBy = actor || actorName();
    logAudit({
      section,
      action: 'Settings Updated',
      setting: section,
      oldValue: prev,
      newValue: JSON.stringify(state[section]),
      changedBy: state.updatedBy,
    });
    save();

    // Live links to existing modules
    if (section === 'orders') {
      try {
        const o = state.orders;
        window.HubCustomerRequests?.updateSettings?.({
          slaHours: { default: Number(o.slaHours) || 4 },
          routingEnabled: !!o.customerRequestRouting,
          requireAdminApproval: !!o.requireAdminApproval,
          autoAssignment: !!o.autoAssignment,
          defaultDepartment: o.defaultDepartment || 'Sales',
          requestNotifications: !!o.requestNotifications,
          defaultRequestStatus: o.defaultRequestStatus || 'Pending Review',
          requestIdFormat: o.requestIdFormat || 'YYYY-#####',
        });
      } catch (_) {}
    }
    return state[section];
  };

  const listAudit = (filter = {}) => {
    let rows = (state.audit || []).slice();
    if (filter.section) rows = rows.filter((r) => r.section === filter.section);
    if (filter.action) rows = rows.filter((r) => String(r.action).includes(filter.action));
    if (filter.user) {
      const q = String(filter.user).toLowerCase();
      rows = rows.filter((r) => String(r.changedBy).toLowerCase().includes(q));
    }
    if (filter.q) {
      const q = String(filter.q).toLowerCase();
      rows = rows.filter(
        (r) =>
          `${r.id} ${r.section} ${r.action} ${r.oldValue} ${r.newValue} ${r.changedBy} ${r.storeId}`
            .toLowerCase()
            .includes(q)
      );
    }
    if (filter.from) rows = rows.filter((r) => r.at >= filter.from);
    if (filter.to) rows = rows.filter((r) => r.at <= filter.to);
    return rows;
  };

  window.HubSiteSettings = {
    KEY,
    get,
    getSection,
    updateSection,
    logAudit,
    listAudit,
    can,
    defaults,
    reload: () => {
      state = load();
      return state;
    },
    save,
  };
})();
