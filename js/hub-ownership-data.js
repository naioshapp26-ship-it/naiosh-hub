/**
 * بيانات ملكية نايوش — المصدر المركزي (Seed من عناصر القائمة السابقة)
 * localStorage: hubOwnershipV1
 */
(() => {
  'use strict';

  const KEY = 'hubOwnershipV1';

  const nowIso = () => new Date().toISOString();
  const uid = (p = 'own') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

  /** visibility: public | customers | admin */
  const SECTIONS = [
    { id: 'overview', label: 'نظرة عامة', icon: 'fa-eye' },
    { id: 'ownerships', label: 'الملكيات', icon: 'fa-building' },
    { id: 'ip', label: 'الملكية الفكرية', icon: 'fa-copyright' },
    { id: 'docs', label: 'الوثائق والتوثيق', icon: 'fa-file-contract' },
    { id: 'other', label: 'أخرى', icon: 'fa-ellipsis' },
    { id: 'actions', label: 'إجراءات', icon: 'fa-plus-circle' },
  ];

  const SEED = [
    {
      id: 'own-hq',
      section: 'ownerships',
      kind: 'ownership',
      title: 'ملكية المكتب الرئيسي',
      category: 'ملكية هيكلية',
      description: 'سجل ملكية المكتب الرئيسي ضمن منظومة نايوش وهوب.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-building-columns',
      href: 'office.html',
      sortOrder: 10,
    },
    {
      id: 'own-branch',
      section: 'ownerships',
      kind: 'ownership',
      title: 'ملكية الفرع',
      category: 'ملكية هيكلية',
      description: 'ملكية الفروع وربطها بالدولة والمكتب التشغيلي.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-code-branch',
      href: 'branches.html',
      sortOrder: 20,
    },
    {
      id: 'own-incubator',
      section: 'ownerships',
      kind: 'ownership',
      title: 'ملكية الحاضنة',
      category: 'ملكية هيكلية',
      description: 'ملكية الحاضنات القطاعية التابعة للفروع.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-seedling',
      href: 'incubators.html',
      sortOrder: 30,
    },
    {
      id: 'own-platform',
      section: 'ownerships',
      kind: 'ownership',
      title: 'ملكية المنصة',
      category: 'ملكية هيكلية',
      description: 'ملكية المنصات السيادية وربطها بالحاضنة أو المكتب الرئيسي.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-layer-group',
      href: 'platforms.html',
      sortOrder: 40,
    },
    {
      id: 'own-office',
      section: 'ownerships',
      kind: 'ownership',
      title: 'ملكية المكتب',
      category: 'ملكية هيكلية',
      description: 'ملكية المكاتب الإلكترونية ووحدات التشغيل المحلية.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-briefcase',
      href: 'office.html',
      sortOrder: 50,
    },
    {
      id: 'own-franchise',
      section: 'ownerships',
      kind: 'ownership',
      title: 'ملكية الفرانشايز',
      category: 'ملكية هيكلية',
      description: 'ملكية نماذج الفرانشايز والتراخيص التشغيلية المرتبطة بنايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-store',
      href: 'services.html',
      sortOrder: 60,
    },
    {
      id: 'own-ip',
      section: 'ip',
      kind: 'right',
      title: 'الملكية الفكرية',
      category: 'حقوق',
      description: 'حماية الأصول الفكرية وتتبع الاستخدام داخل مشاريع هوب.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-copyright',
      href: 'services.html',
      sortOrder: 10,
    },
    {
      id: 'doc-contracts',
      section: 'docs',
      kind: 'document',
      title: 'توثيق العقود',
      category: 'وثيقة',
      docType: 'عقد',
      description: 'توثيق العقود والاتفاقيات المرتبطة بمنظومة نايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-file-signature',
      reference: 'OWN-DOC-CONTRACTS',
      sortOrder: 10,
    },
    {
      id: 'doc-seal',
      section: 'docs',
      kind: 'document',
      title: 'توثيق ختم',
      category: 'وثيقة',
      docType: 'ختم',
      description: 'توثيق الأختام الرسمية المعتمدة لوحدات نايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-stamp',
      reference: 'OWN-DOC-SEAL',
      sortOrder: 20,
    },
    {
      id: 'doc-patents',
      section: 'docs',
      kind: 'document',
      title: 'توثيق براءات الاختراع',
      category: 'وثيقة',
      docType: 'براءة اختراع',
      description: 'سجل توثيق براءات الاختراع المرتبطة بنايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-lightbulb',
      reference: 'OWN-DOC-PATENT',
      sortOrder: 30,
    },
    {
      id: 'doc-innovation',
      section: 'docs',
      kind: 'document',
      title: 'توثيق الابتكار',
      category: 'وثيقة',
      docType: 'ابتكار',
      description: 'توثيق ملفات الابتكار والمبادرات الإبداعية.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-flask',
      reference: 'OWN-DOC-INNOV',
      sortOrder: 40,
    },
    {
      id: 'doc-industrial-models',
      section: 'docs',
      kind: 'document',
      title: 'توثيق النماذج الصناعية',
      category: 'وثيقة',
      docType: 'نموذج صناعي',
      description: 'توثيق النماذج الصناعية المسجّلة ضمن منظومة نايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-industry',
      reference: 'OWN-DOC-IND-MODELS',
      sortOrder: 50,
    },
    {
      id: 'doc-trademark',
      section: 'docs',
      kind: 'document',
      title: 'توثيق علامة تجارية',
      category: 'وثيقة',
      docType: 'علامة تجارية',
      description: 'توثيق العلامات التجارية التابعة لنايوش وهوب.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-trademark',
      reference: 'OWN-DOC-TM',
      sortOrder: 60,
    },
    {
      id: 'doc-biz-model',
      section: 'docs',
      kind: 'document',
      title: 'توثيق نموذج تجاري',
      category: 'وثيقة',
      docType: 'نموذج تجاري',
      description: 'توثيق النماذج التجارية المعتمدة للتشغيل والترخيص.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-chart-pie',
      reference: 'OWN-DOC-BIZ',
      sortOrder: 70,
    },
    {
      id: 'doc-industrial-model',
      section: 'docs',
      kind: 'document',
      title: 'توثيق نموذج صناعي',
      category: 'وثيقة',
      docType: 'نموذج صناعي',
      description: 'توثيق نموذج صناعي فردي ضمن سجلات الملكية.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-gears',
      reference: 'OWN-DOC-IND-MODEL',
      sortOrder: 80,
    },
    {
      id: 'doc-disputes',
      section: 'docs',
      kind: 'document',
      title: 'توثيق تسوية النزاعات',
      category: 'وثيقة',
      docType: 'تسوية نزاع',
      description: 'توثيق إجراءات وملفات تسوية النزاعات.',
      status: 'active',
      visibility: 'admin',
      icon: 'fa-scale-balanced',
      reference: 'OWN-DOC-DISPUTE',
      sortOrder: 90,
    },
    {
      id: 'own-other',
      section: 'other',
      kind: 'info',
      title: 'أخرى',
      category: 'عام',
      description: 'عناصر ملكية إضافية وتصنيفات مساندة ضمن منظومة نايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-folder-open',
      sortOrder: 10,
    },
    {
      id: 'own-add',
      section: 'actions',
      kind: 'action',
      title: 'إضافة ملكية جديدة',
      category: 'إجراء',
      description: 'إضافة سجل ملكية أو وثيقة جديدة إلى مركز ملكية نايوش.',
      status: 'active',
      visibility: 'public',
      icon: 'fa-plus',
      action: 'add',
      sortOrder: 10,
    },
  ].map((r) => ({
    ...r,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));

  const blank = () => ({ version: 1, items: [], updatedAt: nowIso() });

  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || !Array.isArray(raw.items)) return null;
      return raw;
    } catch {
      return null;
    }
  };

  const write = (state) => {
    state.updatedAt = nowIso();
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      window.dispatchEvent?.(new CustomEvent('hub:ownership', { detail: state }));
    } catch {
      /* ignore */
    }
    return state;
  };

  const ensure = () => {
    let state = read();
    if (!state || !state.items.length) {
      state = { version: 1, items: SEED.slice(), updatedAt: nowIso() };
      return write(state);
    }
    const ids = new Set(state.items.map((i) => i.id));
    SEED.forEach((s) => {
      if (!ids.has(s.id)) state.items.push({ ...s });
    });
    return write(state);
  };

  const isStaff = () => {
    try {
      return !!window.HubAuth?.isStaff?.();
    } catch {
      return false;
    }
  };

  const isLoggedIn = () => {
    try {
      if (window.HubAuth?.getUser?.()) return true;
      const u = JSON.parse(localStorage.getItem('hubUser') || 'null');
      return !!(u && (u.email || u.id));
    } catch {
      return false;
    }
  };

  const canSee = (item) => {
    if (!item || item.status === 'archived' || item.status === 'disabled') {
      return isStaff();
    }
    const v = item.visibility || 'public';
    if (v === 'public') return true;
    if (v === 'customers') return isLoggedIn() || isStaff();
    if (v === 'admin') return isStaff();
    return false;
  };

  const canManage = () => isStaff();

  const list = ({ includeHidden = false, q = '', section = '' } = {}) => {
    const state = ensure();
    const query = String(q || '').trim().toLowerCase();
    return state.items
      .filter((i) => (includeHidden && canManage() ? true : canSee(i)))
      .filter((i) => !section || section === 'overview' || i.section === section)
      .filter((i) => {
        if (!query) return true;
        const hay = `${i.title} ${i.description || ''} ${i.category || ''} ${i.docType || ''} ${i.reference || ''} ${i.kind || ''}`.toLowerCase();
        return hay.includes(query);
      })
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title, 'ar'));
  };

  const get = (id) => ensure().items.find((i) => i.id === id) || null;

  const stats = () => {
    const items = list({ includeHidden: false });
    const docs = items.filter((i) => i.kind === 'document');
    const activeDocs = docs.filter((i) => i.status === 'active');
    const state = ensure();
    return {
      total: items.length,
      documents: docs.length,
      activeDocuments: activeDocs.length,
      ownerships: items.filter((i) => i.kind === 'ownership').length,
      updatedAt: state.updatedAt,
    };
  };

  const add = (payload = {}) => {
    if (!canManage()) return { ok: false, error: 'صلاحية الإدارة مطلوبة' };
    const title = String(payload.title || '').trim();
    if (!title) return { ok: false, error: 'اسم السجل مطلوب' };
    const state = ensure();
    const row = {
      id: uid('own'),
      section: payload.section || 'other',
      kind: payload.kind || 'info',
      title,
      category: String(payload.category || 'عام').trim(),
      description: String(payload.description || '').trim(),
      docType: String(payload.docType || '').trim(),
      reference: String(payload.reference || '').trim(),
      status: payload.status === 'disabled' || payload.status === 'archived' ? payload.status : 'active',
      visibility: ['public', 'customers', 'admin'].includes(payload.visibility) ? payload.visibility : 'public',
      icon: String(payload.icon || 'fa-file').trim(),
      href: String(payload.href || '').trim(),
      attachmentName: String(payload.attachmentName || '').trim(),
      attachmentUrl: String(payload.attachmentUrl || '').trim(),
      sortOrder: Number(payload.sortOrder) || state.items.length * 10 + 10,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.items.unshift(row);
    write(state);
    return { ok: true, item: row };
  };

  const update = (id, patch = {}) => {
    if (!canManage()) return { ok: false, error: 'صلاحية الإدارة مطلوبة' };
    const state = ensure();
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx < 0) return { ok: false, error: 'السجل غير موجود' };
    const cur = state.items[idx];
    state.items[idx] = {
      ...cur,
      ...patch,
      title: patch.title != null ? String(patch.title).trim() : cur.title,
      description: patch.description != null ? String(patch.description).trim() : cur.description,
      updatedAt: nowIso(),
    };
    write(state);
    return { ok: true, item: state.items[idx] };
  };

  const setStatus = (id, status) => update(id, { status });

  const remove = (id) => {
    if (!canManage()) return { ok: false, error: 'صلاحية الإدارة مطلوبة' };
    const state = ensure();
    if (!state.items.some((i) => i.id === id)) return { ok: false, error: 'السجل غير موجود' };
    state.items = state.items.filter((i) => i.id !== id);
    write(state);
    return { ok: true };
  };

  window.HubOwnership = {
    KEY,
    SECTIONS,
    SEED,
    ensure,
    list,
    get,
    stats,
    add,
    update,
    setStatus,
    remove,
    canManage,
    canSee,
    isStaff,
    isLoggedIn,
  };
})();
