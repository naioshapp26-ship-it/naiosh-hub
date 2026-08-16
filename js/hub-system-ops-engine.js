/**
 * محرك تنفيذ آلية تشغيل الأنظمة — تنفيذ فعلي لكل بند «النظام =»
 */
(() => {
  'use strict';

  const KEY = 'naiosh_system_ops_v1';
  const spec = () => window.HubSystemOpsSpec || {};

  const blank = () => ({
    subdomains: [],
    structures: [],
    grantCounters: { incubator: 0, platform: 0, subdomain: 0, branch: 0, office: 0 },
    roleAssignments: [],
    memberships: [],
    certificates: [],
    blogPosts: [],
    pages: [],
    rentals: [],
    erpiActive: {},
    lawActive: {},
    lawTaxonomyActive: {},
    assets: [],
    costActions: [],
    opsLog: [],
    activeSystem: 'ERP',
    updatedAt: new Date().toISOString(),
  });

  const read = () => {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return blank();
    }
  };

  const save = (state) => {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('hub:system-ops', { detail: state }));
    return state;
  };

  const log = (state, action, detail = '') => {
    state.opsLog = [{ at: new Date().toISOString(), action, detail }, ...(state.opsLog || [])].slice(0, 80);
  };

  const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

  const slugify = (s = '') =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u0600-\u06ff-]/gi, '')
      .slice(0, 40) || `tenant-${Date.now().toString(36)}`;

  /** تسلسل أرقام المنح: حاضنة / منصة / دومين فرعي / فرع */
  const nextGrantNum = (state, kind) => {
    const counters = state.grantCounters || {};
    const n = Number(counters[kind] || 0) + 1;
    counters[kind] = n;
    state.grantCounters = counters;
    return n;
  };

  const formatGrantId = (prefix, num) => `${prefix}-${String(num).padStart(3, '0')}`;

  /** منح دومين فرعي */
  const grantSubdomain = ({ tenantName, systemCode = 'ERP', baseDomain = 'naiosh.app', slug: slugIn } = {}) => {
    const state = read();
    const slug = slugIn ? slugify(slugIn) : slugify(tenantName);
    const host = `${slug}.${baseDomain}`;
    const num = nextGrantNum(state, 'subdomain');
    const grantId = formatGrantId('SD', num);
    const row = {
      id: uid('sd'),
      num,
      grantId,
      tenantName: tenantName || slug,
      slug,
      host,
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      status: 'active',
      at: new Date().toISOString(),
    };
    state.subdomains.unshift(row);
    log(state, 'منح دومين فرعي', `${grantId} · ${host}`);
    save(state);
    return row;
  };

  /** منح فرع/حاضنة/منصة/مكتب */
  const grantStructure = ({ type, nameAr, tenantName, systemCode = 'ERP', refId = '', refNum = null } = {}) => {
    const state = read();
    const types = (spec().STRUCTURE_TYPES || []).map((t) => t.id);
    const kind = types.includes(type) ? type : 'platform';
    const counterKey =
      kind === 'incubator' ? 'incubator' : kind === 'platform' ? 'platform' : kind === 'branch' ? 'branch' : kind;
    const prefix =
      kind === 'incubator' ? 'INC' : kind === 'platform' ? 'PLT' : kind === 'branch' ? 'BR' : kind === 'office' ? 'OFF' : 'GR';
    const num = refNum != null ? Number(refNum) : nextGrantNum(state, counterKey);
    if (refNum == null) {
      /* counter already advanced */
    } else {
      const counters = state.grantCounters || {};
      counters[counterKey] = Math.max(Number(counters[counterKey] || 0), num);
      state.grantCounters = counters;
    }
    const grantId = formatGrantId(prefix, num);
    const row = {
      id: uid(kind),
      type: kind,
      nameAr: nameAr || kind,
      tenantName: tenantName || 'مستأجر',
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      status: 'granted',
      num,
      grantId,
      refId: refId || '',
      at: new Date().toISOString(),
    };
    state.structures.unshift(row);
    // ربط بهوب إن وُجدت واجهات المنح
    try {
      if (kind === 'office' && window.HubStore?.grantOffice) {
        window.HubStore.grantOffice({ nameAr: row.nameAr, platform: row.systemCode });
      }
    } catch {}
    log(state, 'منح هيكل', `${grantId} · ${kind}: ${row.nameAr}`);
    save(state);
    return row;
  };

  /** أدوار وصلاحيات */
  const assignRole = ({ user, roleId, systemCode = 'ERP' } = {}) => {
    const state = read();
    const role = (spec().ROLES || []).find((r) => r.id === roleId) || (spec().ROLES || [])[0];
    const row = {
      id: uid('role'),
      user: user || 'مستخدم',
      roleId: role?.id || 'staff',
      roleName: role?.nameAr || roleId,
      perms: role?.perms || ['read'],
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      at: new Date().toISOString(),
    };
    state.roleAssignments = [row, ...state.roleAssignments.filter((x) => !(x.user === row.user && x.systemCode === row.systemCode))];
    log(state, 'تعيين دور', `${row.user} → ${row.roleName}`);
    save(state);
    return row;
  };

  const permsFor = (user, systemCode) => {
    const state = read();
    const row = state.roleAssignments.find(
      (x) => x.user === user && String(x.systemCode).toUpperCase() === String(systemCode || '').toUpperCase()
    );
    return row?.perms || [];
  };

  const can = (user, systemCode, perm) => permsFor(user, systemCode).includes(perm) || permsFor(user, systemCode).includes('admin');

  /** عضوية + شهادة */
  const registerMembership = ({ name, email, plan = 'تشغيلي', systemCode = 'ERP' } = {}) => {
    const state = read();
    const member = {
      id: uid('mem'),
      name: name || 'عضو',
      email: email || '',
      plan,
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      status: 'active',
      at: new Date().toISOString(),
    };
    const cert = {
      id: uid('cert'),
      membershipId: member.id,
      title: `شهادة عضوية ${plan} — ${member.name}`,
      systemCode: member.systemCode,
      at: new Date().toISOString(),
    };
    state.memberships.unshift(member);
    state.certificates.unshift(cert);
    if (window.HubStore?.grantSubscription && email) {
      try {
        window.HubStore.grantSubscription({
          email,
          systemCode: member.systemCode,
          plan,
          permissions: ['read', 'write'],
          source: 'system-ops-membership',
        });
      } catch {}
    }
    log(state, 'عضوية + شهادة', member.name);
    save(state);
    return { member, cert };
  };

  /** مدونة النظام */
  const publishPost = ({ title, body, systemCode = 'ERP' } = {}) => {
    const state = read();
    if (!title?.trim()) return null;
    const post = {
      id: uid('post'),
      title: title.trim(),
      body: (body || '').trim(),
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      at: new Date().toISOString(),
    };
    state.blogPosts.unshift(post);
    log(state, 'منشور مدونة', post.title);
    save(state);
    return post;
  };

  /** أنشئ صفحتك على النظام وهوب */
  const createPage = ({ title, kind = 'tenant', systemCode = 'ERP', publishToHub = true } = {}) => {
    const state = read();
    const page = {
      id: uid('page'),
      title: title || 'صفحتي',
      kind,
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      hubUrl: publishToHub ? `office.html?page=${encodeURIComponent(title || 'صفحتي')}` : '',
      systemUrl: `system-ops.html?tab=pages&page=${encodeURIComponent(title || 'صفحتي')}`,
      at: new Date().toISOString(),
    };
    state.pages.unshift(page);
    log(state, 'إنشاء صفحة', page.title);
    save(state);
    return page;
  };

  /** استئجار منصة + دومين فرعي */
  const rentPlatform = ({ nameAr, tenantName, systemCode = 'ERP' } = {}) => {
    const state = read();
    const subdomain = grantSubdomain({ tenantName: tenantName || nameAr, systemCode });
    const structure = grantStructure({ type: 'platform', nameAr: nameAr || 'منصة مستأجرة', tenantName, systemCode });
    const rental = {
      id: uid('rent'),
      nameAr: nameAr || structure.nameAr,
      subdomainId: subdomain.id,
      structureId: structure.id,
      host: subdomain.host,
      systemCode: String(systemCode || 'ERP').toUpperCase(),
      status: 'rented',
      at: new Date().toISOString(),
    };
    // grantSubdomain/grantStructure already saved; refresh and append rental
    const next = read();
    next.rentals.unshift(rental);
    log(next, 'استئجار منصة', `${rental.nameAr} @ ${rental.host}`);
    save(next);
    return { rental, subdomain, structure };
  };

  /** تفعيل وحدة ERPI / قانونية */
  const toggleErpi = (name, on = true) => {
    const state = read();
    state.erpiActive[name] = Boolean(on);
    log(state, on ? 'تفعيل ERPI' : 'إيقاف ERPI', name);
    return save(state);
  };

  const toggleLaw = (name, on = true) => {
    const state = read();
    state.lawActive[name] = Boolean(on);
    log(state, on ? 'تفعيل قانوني' : 'إيقاف قانوني', name);
    return save(state);
  };

  const toggleLawTaxonomy = (name, on = true) => {
    const state = read();
    state.lawTaxonomyActive[name] = Boolean(on);
    log(state, on ? 'تفعيل تصنيف قانوني' : 'إيقاف تصنيف', name);
    return save(state);
  };

  /** سيطرة على أصول المستأجر */
  const registerAsset = ({ tenantName, kind, nameAr, value = 0 } = {}) => {
    const state = read();
    const asset = {
      id: uid('asset'),
      tenantName: tenantName || 'مستأجر',
      kind: kind || 'أصل',
      nameAr: nameAr || 'أصل',
      value: Number(value) || 0,
      at: new Date().toISOString(),
    };
    state.assets.unshift(asset);
    log(state, 'تسجيل أصل', `${asset.tenantName}: ${asset.nameAr}`);
    save(state);
    return asset;
  };

  /** خفض التكاليف */
  const recordCostAction = ({ title, saving = 0 } = {}) => {
    const state = read();
    const row = {
      id: uid('cost'),
      title: title || 'إجراء خفض تكلفة',
      saving: Number(saving) || 0,
      at: new Date().toISOString(),
    };
    state.costActions.unshift(row);
    log(state, 'خفض تكلفة', `${row.title} · ${row.saving}`);
    save(state);
    return row;
  };

  /** عناصر المنيو الجانبي حسب الصلاحيات */
  const sidebarFor = (user, systemCode) => {
    const perms = permsFor(user, systemCode);
    const all = [
      { id: 'home', label: 'الرئيسية', href: 'system-ops.html', need: 'read' },
      { id: 'panel', label: 'لوحة التحكم', href: 'system-ops.html?tab=panel', need: 'read' },
      { id: 'products', label: 'المنتجات', href: 'products.html', need: 'read' },
      { id: 'services', label: 'الخدمات', href: 'system-ops.html?tab=catalog', need: 'read' },
      { id: 'ads', label: 'الإعلانات', href: 'ads.html', need: 'write' },
      { id: 'blog', label: 'المدونة', href: 'system-ops.html?tab=blog', need: 'read' },
      { id: 'packages', label: 'الباقات', href: 'packages.html', need: 'read' },
      { id: 'info', label: 'مركز المعلومات', href: 'info-center.html', need: 'read' },
      { id: 'structure', label: 'الفروع والمنصات', href: 'system-ops.html?tab=grants', need: 'grant' },
      { id: 'roles', label: 'إدارة الأدوار والصلاحيات', href: 'roles-permissions.html', need: 'admin', icon: 'fa-shield-alt' },
      { id: 'erpi', label: 'وحدات ERPI', href: 'system-ops.html?tab=erpi', need: 'ops' },
      { id: 'law', label: 'القانونية', href: 'system-ops.html?tab=law', need: 'legal' },
      { id: 'assets', label: 'الأصول', href: 'system-ops.html?tab=assets', need: 'admin' },
      { id: 'tenant', label: 'نظام المستأجر', href: 'system-ops.html?tab=tenant', need: 'read' },
    ];
    const has = (need) => !need || perms.includes(need) || perms.includes('admin') || (need === 'ops' && (perms.includes('write') || perms.includes('ops')));
    // إن لم يُعيَّن دور بعد: اعرض الحد الأدنى للقراءة
    if (!perms.length) {
      return all.filter((x) => ['home', 'panel', 'products', 'services', 'packages', 'info', 'tenant'].includes(x.id));
    }
    return all.filter((x) => has(x.need));
  };

  const setActiveSystem = (code) => {
    const state = read();
    state.activeSystem = String(code || 'ERP').toUpperCase();
    return save(state);
  };

  const openTenantSystem = (systemCode) => {
    const code = String(systemCode || read().activeSystem || 'ERP').toUpperCase();
    if (window.HubLauncher?.launch) {
      return window.HubLauncher.launch(code, { mode: 'hub', force: window.HubLiveSystems?.isLive?.(code) });
    }
    window.location.href = `apps.html#${code.toLowerCase()}`;
    return null;
  };

  const stats = () => {
    const s = read();
    return {
      subdomains: s.subdomains.length,
      structures: s.structures.length,
      roles: s.roleAssignments.length,
      memberships: s.memberships.length,
      certificates: s.certificates.length,
      posts: s.blogPosts.length,
      pages: s.pages.length,
      rentals: s.rentals.length,
      erpiOn: Object.values(s.erpiActive || {}).filter(Boolean).length,
      lawOn: Object.values(s.lawActive || {}).filter(Boolean).length,
      taxonomyOn: Object.values(s.lawTaxonomyActive || {}).filter(Boolean).length,
      assets: s.assets.length,
      costSaving: (s.costActions || []).reduce((n, x) => n + Number(x.saving || 0), 0),
    };
  };

  window.HubSystemOps = {
    KEY,
    read,
    save,
    grantSubdomain,
    grantStructure,
    assignRole,
    permsFor,
    can,
    registerMembership,
    publishPost,
    createPage,
    rentPlatform,
    toggleErpi,
    toggleLaw,
    toggleLawTaxonomy,
    registerAsset,
    recordCostAction,
    sidebarFor,
    setActiveSystem,
    openTenantSystem,
    stats,
  };
})();
