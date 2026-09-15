/**
 * كتالوج الأنظمة والوحدات التشغيلية — Platform → Systems → Modules
 * localStorage: hubOpsCatalogV1
 */
(() => {
  'use strict';

  const KEY = 'hubOpsCatalogV1';
  const USAGE_KEY = 'hubOpsCatalogUsageV1';

  const uid = (p = 'ops') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const nowIso = () => new Date().toISOString();

  const mkMod = (id, systemId, name, desc, order, opts = {}) => ({
    id,
    systemId,
    name,
    description: desc,
    canStandalone: opts.canStandalone !== false,
    hideParentDefault: !!opts.hideParentDefault,
    requiresSiblingModules: !!opts.requiresSiblingModules,
    permissions: opts.permissions || ['read', 'write'],
    status: opts.status || 'active',
    sortOrder: order,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const SEED_SYSTEMS = [
    {
      id: 'HUB',
      code: 'HUB',
      name: 'نايوش هوب – تشغيل شمولي',
      shortName: 'HUB',
      description: 'تشغيل متكامل يجمع الأنظمة والوحدات التي يحتاجها العميل داخل تجربة موحدة في نايوش هوب.',
      icon: 'fa-layer-group',
      type: 'platform',
      status: 'active',
      sortOrder: 0,
      isUmbrella: true,
    },
    {
      id: 'ERP',
      code: 'ERP',
      name: 'نايوش إي آر بي',
      shortName: 'ERP',
      description: 'إدارة موارد المؤسسة: مخزون، مشتريات، مبيعات، فواتير، ومالية.',
      icon: 'fa-sitemap',
      type: 'system',
      status: 'active',
      sortOrder: 10,
    },
    {
      id: 'CRM',
      code: 'CRM',
      name: 'إدارة علاقات العملاء',
      shortName: 'CRM',
      description: 'العملاء والفرص والمتابعة داخل نايوش هوب.',
      icon: 'fa-handshake',
      type: 'system',
      status: 'active',
      sortOrder: 20,
    },
    {
      id: 'LMS',
      code: 'LMS',
      name: 'نظام التعلم',
      shortName: 'LMS',
      description: 'إدارة الدورات والمتعلمين والاختبارات.',
      icon: 'fa-laptop-code',
      type: 'system',
      status: 'active',
      sortOrder: 30,
    },
    {
      id: 'LAW',
      code: 'LAW',
      name: 'نايوش لو — النظام القانوني',
      shortName: 'LAW',
      description: 'المنظومة القانونية والقضايا والحوكمة.',
      icon: 'fa-gavel',
      type: 'system',
      status: 'active',
      sortOrder: 40,
    },
    {
      id: 'FIT',
      code: 'FIT',
      name: 'نايوش فيت — الصحة واللياقة',
      shortName: 'FIT',
      description: 'إدارة اللياقة والاشتراكات الصحية.',
      icon: 'fa-dumbbell',
      type: 'system',
      status: 'active',
      sortOrder: 50,
    },
    {
      id: 'ACADEMY',
      code: 'ACADEMY',
      name: 'أكاديمية نايوش',
      shortName: 'ACADEMY',
      description: 'برامج ودورات أكاديمية داخل هوب.',
      icon: 'fa-chalkboard-user',
      type: 'system',
      status: 'active',
      sortOrder: 60,
    },
    {
      id: 'EDUSMARTX',
      code: 'EDUSMARTX',
      name: 'إيديو سمارتكس — أنظمة تعليمية',
      shortName: 'EDUSMARTX',
      description: 'أنظمة تعليمية متخصصة.',
      icon: 'fa-graduation-cap',
      type: 'system',
      status: 'active',
      sortOrder: 70,
    },
    {
      id: 'EDUNAIOSH',
      code: 'EDUNAIOSH',
      name: 'نايوش — مناهج ودورات',
      shortName: 'EDUNAIOSH',
      description: 'مناهج ودورات نايوش التعليمية.',
      icon: 'fa-book-open-reader',
      type: 'system',
      status: 'active',
      sortOrder: 80,
    },
    {
      id: 'NAIS',
      code: 'NAIS',
      name: 'نايس — ذكاء التشغيل',
      shortName: 'NAIS',
      description: 'ذكاء التشغيل والتحليل.',
      icon: 'fa-chart-line',
      type: 'system',
      status: 'active',
      sortOrder: 90,
    },
    {
      id: 'SMARTX',
      code: 'SMARTX',
      name: 'سمارتكس — اجتماعات وقاعات',
      shortName: 'SMARTX',
      description: 'اجتماعات وقاعات افتراضية.',
      icon: 'fa-video',
      type: 'system',
      status: 'active',
      sortOrder: 100,
    },
  ].map((s) => ({ ...s, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }));

  const SEED_MODULES = [
    mkMod('ERP_INV', 'ERP', 'إدارة المخزون', 'إدارة المخزون وحركات الأصناف.', 10, { hideParentDefault: true }),
    mkMod('ERP_PUR', 'ERP', 'المشتريات', 'طلبات الشراء والموردون.', 20),
    mkMod('ERP_SAL', 'ERP', 'المبيعات', 'عروض وفواتير البيع.', 30),
    mkMod('ERP_INVCE', 'ERP', 'الفواتير', 'إصدار ومتابعة الفواتير.', 40),
    mkMod('ERP_FIN', 'ERP', 'المالية', 'المحاسبة والتقارير المالية.', 50),
    mkMod('CRM_CUS', 'CRM', 'العملاء', 'قاعدة العملاء وملفات العلاقة.', 10),
    mkMod('CRM_LEADS', 'CRM', 'Leads', 'الفرص والعملاء المحتملون.', 20),
    mkMod('CRM_FLW', 'CRM', 'المتابعة', 'متابعة الفرص والدعم.', 30),
    mkMod('LMS_CRS', 'LMS', 'الدورات', 'إدارة الدورات والمحتوى.', 10),
    mkMod('LMS_LRN', 'LMS', 'المتعلمين', 'تسجيل ومتابعة المتعلمين.', 20),
    mkMod('LMS_EXM', 'LMS', 'الاختبارات', 'اختبارات وتقييمات.', 30),
    mkMod('LAW_CASE', 'LAW', 'القضايا', 'إدارة القضايا والملفات القانونية.', 10),
    mkMod('LAW_GOV', 'LAW', 'الحوكمة القانونية', 'سياسات وامتثال قانوني.', 20),
    mkMod('ACA_CRS', 'ACADEMY', 'برامج الأكاديمية', 'برامج ودورات أكاديمية.', 10),
    mkMod('FIT_MEM', 'FIT', 'الاشتراكات الصحية', 'عضويات ولياقة.', 10),
  ];

  const blank = () => ({
    version: 1,
    systems: [],
    modules: [],
    updatedAt: nowIso(),
  });

  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || !Array.isArray(raw.systems)) return null;
      return raw;
    } catch {
      return null;
    }
  };

  const write = (state) => {
    state.updatedAt = nowIso();
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent?.(new CustomEvent('hub:ops-catalog', { detail: state }));
    } catch {
      /* ignore */
    }
    return state;
  };

  const ensure = () => {
    let state = read();
    if (!state || !state.systems.length) {
      state = { version: 1, systems: SEED_SYSTEMS.slice(), modules: SEED_MODULES.slice(), updatedAt: nowIso() };
      write(state);
      return state;
    }
    // merge missing seed ids without wiping admin additions
    const sysIds = new Set(state.systems.map((s) => s.id));
    SEED_SYSTEMS.forEach((s) => {
      if (!sysIds.has(s.id)) state.systems.push({ ...s });
    });
    const modIds = new Set(state.modules.map((m) => m.id));
    SEED_MODULES.forEach((m) => {
      if (!modIds.has(m.id)) state.modules.push({ ...m });
    });
    write(state);
    return state;
  };

  const readUsage = () => {
    try {
      return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  };

  const markUsage = (refId, kind) => {
    const u = readUsage();
    const key = `${kind}:${refId}`;
    u[key] = (u[key] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  };

  const usageCount = (refId, kind) => {
    const u = readUsage();
    return Number(u[`${kind}:${refId}`] || 0);
  };

  const listSystems = ({ activeOnly = false, includeUmbrella = true } = {}) => {
    const state = ensure();
    return state.systems
      .filter((s) => (includeUmbrella ? true : !s.isUmbrella))
      .filter((s) => (activeOnly ? s.status === 'active' : true))
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'ar'));
  };

  const listModules = (systemId, { activeOnly = false } = {}) => {
    const state = ensure();
    return state.modules
      .filter((m) => !systemId || m.systemId === systemId)
      .filter((m) => (activeOnly ? m.status === 'active' : true))
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'ar'));
  };

  const getSystem = (id) => ensure().systems.find((s) => s.id === id || s.code === id) || null;
  const getModule = (id) => ensure().modules.find((m) => m.id === id) || null;

  const addSystem = (payload = {}) => {
    const name = String(payload.name || '').trim();
    const description = String(payload.description || '').trim();
    if (!name || !description) return { ok: false, error: 'اسم النظام والوصف مطلوبان' };
    const code = String(payload.code || payload.shortName || name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '')
      .slice(0, 16) || uid('SYS').toUpperCase();
    const state = ensure();
    if (state.systems.some((s) => s.code === code || s.id === code)) {
      return { ok: false, error: 'رمز النظام مستخدم مسبقًا' };
    }
    const row = {
      id: code,
      code,
      name,
      shortName: String(payload.shortName || code).trim(),
      description,
      icon: String(payload.icon || 'fa-cube').trim(),
      type: String(payload.type || 'system').trim(),
      status: payload.status === 'inactive' ? 'inactive' : 'active',
      sortOrder: Number(payload.sortOrder) || state.systems.length * 10 + 10,
      isUmbrella: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.systems.push(row);
    write(state);
    return { ok: true, system: row };
  };

  const updateSystem = (id, patch = {}) => {
    const state = ensure();
    const idx = state.systems.findIndex((s) => s.id === id);
    if (idx < 0) return { ok: false, error: 'النظام غير موجود' };
    const cur = state.systems[idx];
    if (cur.isUmbrella && patch.status === 'inactive') {
      return { ok: false, error: 'لا يمكن تعطيل مظلة نايوش هوب' };
    }
    state.systems[idx] = {
      ...cur,
      name: patch.name != null ? String(patch.name).trim() : cur.name,
      shortName: patch.shortName != null ? String(patch.shortName).trim() : cur.shortName,
      description: patch.description != null ? String(patch.description).trim() : cur.description,
      icon: patch.icon != null ? String(patch.icon).trim() : cur.icon,
      type: patch.type != null ? String(patch.type).trim() : cur.type,
      status: patch.status === 'inactive' || patch.status === 'active' ? patch.status : cur.status,
      sortOrder: patch.sortOrder != null ? Number(patch.sortOrder) : cur.sortOrder,
      updatedAt: nowIso(),
    };
    write(state);
    return { ok: true, system: state.systems[idx] };
  };

  const setSystemStatus = (id, status) => updateSystem(id, { status });

  const deleteSystem = (id, { force = false } = {}) => {
    const state = ensure();
    const sys = state.systems.find((s) => s.id === id);
    if (!sys) return { ok: false, error: 'النظام غير موجود' };
    if (sys.isUmbrella) return { ok: false, error: 'لا يمكن حذف مظلة نايوش هوب' };
    const mods = state.modules.filter((m) => m.systemId === id);
    const used = usageCount(id, 'system') + mods.reduce((n, m) => n + usageCount(m.id, 'module'), 0);
    if ((used > 0 || mods.length) && !force) {
      return {
        ok: false,
        error: `النظام مستخدم أو مرتبط بوحدات (${mods.length} وحدة، استخدام ${used}). أكّد الحذف القسري إن لزم.`,
        needsConfirm: true,
        modules: mods.length,
        usage: used,
      };
    }
    state.systems = state.systems.filter((s) => s.id !== id);
    state.modules = state.modules.filter((m) => m.systemId !== id);
    write(state);
    return { ok: true };
  };

  const addModule = (payload = {}) => {
    const systemId = String(payload.systemId || '').trim();
    const name = String(payload.name || '').trim();
    const description = String(payload.description || '').trim();
    if (!systemId || !name || !description) return { ok: false, error: 'النظام الأب واسم الوحدة والوصف مطلوبة' };
    if (!getSystem(systemId)) return { ok: false, error: 'النظام الأب غير موجود' };
    const state = ensure();
    const id =
      String(payload.id || `${systemId}_${name}`)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 24) || uid('MOD').toUpperCase();
    if (state.modules.some((m) => m.id === id)) return { ok: false, error: 'معرّف الوحدة مستخدم' };
    const row = {
      id,
      systemId,
      name,
      description,
      canStandalone: payload.canStandalone !== false,
      hideParentDefault: !!payload.hideParentDefault,
      requiresSiblingModules: !!payload.requiresSiblingModules,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : ['read', 'write'],
      status: payload.status === 'inactive' ? 'inactive' : 'active',
      sortOrder: Number(payload.sortOrder) || listModules(systemId).length * 10 + 10,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.modules.push(row);
    write(state);
    return { ok: true, module: row };
  };

  const updateModule = (id, patch = {}) => {
    const state = ensure();
    const idx = state.modules.findIndex((m) => m.id === id);
    if (idx < 0) return { ok: false, error: 'الوحدة غير موجودة' };
    const cur = state.modules[idx];
    state.modules[idx] = {
      ...cur,
      name: patch.name != null ? String(patch.name).trim() : cur.name,
      description: patch.description != null ? String(patch.description).trim() : cur.description,
      canStandalone: patch.canStandalone != null ? !!patch.canStandalone : cur.canStandalone,
      hideParentDefault: patch.hideParentDefault != null ? !!patch.hideParentDefault : cur.hideParentDefault,
      requiresSiblingModules:
        patch.requiresSiblingModules != null ? !!patch.requiresSiblingModules : cur.requiresSiblingModules,
      permissions: Array.isArray(patch.permissions) ? patch.permissions : cur.permissions,
      status: patch.status === 'inactive' || patch.status === 'active' ? patch.status : cur.status,
      sortOrder: patch.sortOrder != null ? Number(patch.sortOrder) : cur.sortOrder,
      updatedAt: nowIso(),
    };
    write(state);
    return { ok: true, module: state.modules[idx] };
  };

  const setModuleStatus = (id, status) => updateModule(id, { status });

  const deleteModule = (id, { force = false } = {}) => {
    const used = usageCount(id, 'module');
    if (used > 0 && !force) {
      return { ok: false, error: `الوحدة مستخدمة (${used}). أكّد الحذف القسري إن لزم.`, needsConfirm: true, usage: used };
    }
    const state = ensure();
    if (!state.modules.some((m) => m.id === id)) return { ok: false, error: 'الوحدة غير موجودة' };
    state.modules = state.modules.filter((m) => m.id !== id);
    write(state);
    return { ok: true };
  };

  /**
   * selection: {
   *   mode: 'hub_comprehensive' | 'by_need',
   *   items: [
   *     { kind:'system', systemId, full:true },
   *     { kind:'module', systemId, moduleId, standalone?, hideParent? }
   *   ]
   * }
   */
  const normalizeSelection = (selection = {}) => {
    const mode = selection.mode === 'hub_comprehensive' ? 'hub_comprehensive' : 'by_need';
    const items = Array.isArray(selection.items) ? selection.items : [];
    const normalized = [];
    items.forEach((it) => {
      if (it.kind === 'system' && it.systemId) {
        const sys = getSystem(it.systemId);
        if (!sys || sys.isUmbrella || sys.status !== 'active') return;
        if (it.full) {
          normalized.push({ kind: 'system', systemId: sys.id, code: sys.code, full: true, label: sys.name });
        }
      } else if (it.kind === 'module' && it.moduleId) {
        const mod = getModule(it.moduleId);
        if (!mod || mod.status !== 'active') return;
        const sys = getSystem(mod.systemId);
        if (!sys || sys.status !== 'active') return;
        const standalone = it.standalone != null ? !!it.standalone : !!mod.canStandalone;
        const hideParent = it.hideParent != null ? !!it.hideParent : !!mod.hideParentDefault;
        if (standalone === false && it.fullSystem) {
          /* ignored */
        }
        normalized.push({
          kind: 'module',
          systemId: sys.id,
          moduleId: mod.id,
          code: mod.id,
          label: mod.name,
          parentLabel: sys.name,
          standalone,
          hideParent,
          permissions: mod.permissions || ['read', 'write'],
        });
      }
    });
    return { mode, items: normalized };
  };

  /** Expand full systems into modules for entitlement resolution without granting unused siblings when only modules selected */
  const resolveEntitlements = (selection) => {
    const sel = normalizeSelection(selection);
    const services = [];
    const grants = []; // for HubStore.grantSubscription
    const seenSys = new Set();
    const seenMod = new Set();

    sel.items.forEach((it) => {
      if (it.kind === 'system' && it.full) {
        if (seenSys.has(it.systemId)) return;
        seenSys.add(it.systemId);
        const sys = getSystem(it.systemId);
        const mods = listModules(it.systemId, { activeOnly: true });
        grants.push({ systemCode: sys.code, label: sys.name, kind: 'system', permissions: ['read', 'write', 'admin'] });
        markUsage(sys.id, 'system');
        services.push({
          id: `sys:${sys.id}`,
          kind: 'system',
          systemId: sys.id,
          code: sys.code,
          label: sys.name,
          hideParent: false,
          modules: mods.map((m) => {
            markUsage(m.id, 'module');
            seenMod.add(m.id);
            return { id: m.id, label: m.name, code: m.id };
          }),
        });
        mods.forEach((m) => {
          if (!seenMod.has(m.id)) seenMod.add(m.id);
        });
      }
    });

    sel.items.forEach((it) => {
      if (it.kind !== 'module') return;
      if (seenSys.has(it.systemId)) return; // already full system
      if (seenMod.has(it.moduleId)) return;
      seenMod.add(it.moduleId);
      const mod = getModule(it.moduleId);
      const sys = getSystem(it.systemId);
      markUsage(mod.id, 'module');
      // grant module-level code only — NOT parent ERP
      grants.push({
        systemCode: mod.id,
        label: mod.name,
        kind: 'module',
        parentSystem: sys.code,
        permissions: it.permissions || mod.permissions || ['read', 'write'],
      });
      const label = it.hideParent ? mod.name : `${mod.name} · ${sys.name}`;
      services.push({
        id: `mod:${mod.id}`,
        kind: 'module',
        systemId: sys.id,
        moduleId: mod.id,
        code: mod.id,
        label: it.hideParent ? mod.name : label,
        customerLabel: it.hideParent ? mod.name : mod.name,
        parentLabel: it.hideParent ? null : sys.name,
        hideParent: !!it.hideParent,
        standalone: !!it.standalone,
      });
    });

    return {
      mode: sel.mode,
      umbrella: 'NAIOSH HUB',
      items: sel.items,
      services,
      grants,
      systemsCompat: services.map((s) => ({
        code: s.code,
        label: s.hideParent || s.kind === 'module' ? s.label : s.label,
        kind: s.kind,
        systemId: s.systemId,
        moduleId: s.moduleId || null,
        hideParent: !!s.hideParent,
      })),
    };
  };

  const customerFacingServices = (entitlements) => {
    const list = entitlements?.services || [];
    return list.map((s) => ({
      code: s.code,
      label: s.hideParent || s.kind === 'module' ? s.customerLabel || s.label : s.label,
      kind: s.kind,
      hideParent: !!s.hideParent,
      systemId: s.systemId,
      moduleId: s.moduleId || null,
    }));
  };

  /** Options for legacy flat pickers */
  const systemOptions = () =>
    listSystems({ activeOnly: true, includeUmbrella: false }).map((s) => ({
      code: s.code,
      label: s.name,
      id: s.id,
    }));

  const hierarchyTree = () => {
    const hub = getSystem('HUB');
    return {
      platform: hub
        ? { id: hub.id, name: hub.name, description: hub.description }
        : { id: 'HUB', name: 'نايوش هوب', description: '' },
      systems: listSystems({ activeOnly: false, includeUmbrella: false }).map((s) => ({
        ...s,
        modules: listModules(s.id),
      })),
    };
  };

  const resetToSeed = () => {
    localStorage.removeItem(KEY);
    return ensure();
  };

  window.HubOpsCatalog = {
    KEY,
    ensure,
    listSystems,
    listModules,
    getSystem,
    getModule,
    addSystem,
    updateSystem,
    setSystemStatus,
    deleteSystem,
    addModule,
    updateModule,
    setModuleStatus,
    deleteModule,
    normalizeSelection,
    resolveEntitlements,
    customerFacingServices,
    systemOptions,
    hierarchyTree,
    markUsage,
    usageCount,
    resetToSeed,
    SEED_SYSTEMS,
    SEED_MODULES,
  };
})();
