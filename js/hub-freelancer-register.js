/**
 * تسجيل فريلانسر — مكتب فقط من المقر، بدون منصة وبدون نظام
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-freelancer-register]');
  if (!root) return;

  const form = root.querySelector('[data-freelancer-form]');
  const feedback = root.querySelector('[data-freelancer-feedback]');
  const listEl = root.querySelector('[data-fl-project-list]');
  const countEl = root.querySelector('[data-fl-project-count]');
  const searchEl = root.querySelector('[data-fl-project-search]');
  const catEl = root.querySelector('[data-fl-project-cat]');
  const requiredProxy = root.querySelector('[data-fl-projects-required]');
  const KEY = 'naiosh_freelancer_applications_v1';
  const DATA_URL = 'js/hub-freelancer-projects.json?v=1';

  let catalog = { categories: [], projects: [] };
  let selected = new Map();

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const toast = (msg, ok = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.classList.toggle('is-error', !ok);
    feedback.classList.toggle('is-ok', ok);
  };

  const fileMeta = (input) => {
    const f = input?.files?.[0];
    if (!f) return null;
    return { name: f.name, size: f.size, type: f.type };
  };

  const normalize = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');

  const selectedCount = () => selected.size;

  const syncRequired = () => {
    if (!requiredProxy) return;
    requiredProxy.setCustomValidity(selectedCount() ? '' : 'اختر مشروعًا جانبيًا واحدًا على الأقل');
    requiredProxy.value = selectedCount() ? String(selectedCount()) : '';
  };

  const filteredProjects = () => {
    const q = normalize(searchEl?.value || '');
    const cat = catEl?.value || '';
    return catalog.projects.filter((p) => {
      if (cat && p.categoryId !== cat) return false;
      if (!q) return true;
      const hay = normalize([p.title, ...(p.skills || [])].join(' '));
      return hay.includes(q);
    });
  };

  const renderList = () => {
    if (!listEl) return;
    const items = filteredProjects().slice(0, 80);
    const catName = (id) => catalog.categories.find((c) => c.id === id)?.nameAr || '';
    if (!catalog.projects.length) {
      listEl.innerHTML = '<p class="fl-projects-empty">تعذر تحميل قائمة المشاريع.</p>';
      return;
    }
    if (!items.length) {
      listEl.innerHTML = '<p class="fl-projects-empty">لا نتائج مطابقة — غيّر البحث أو التصنيف.</p>';
    } else {
      listEl.innerHTML = items
        .map((p) => {
          const checked = selected.has(p.id) ? 'checked' : '';
          return `<label class="fl-project-item">
            <input type="checkbox" value="${esc(p.id)}" data-fl-project="${esc(p.id)}" ${checked} />
            <span>
              <strong>${esc(p.title)}</strong>
              <small>${esc(catName(p.categoryId))}${p.skills?.length ? ` · ${esc(p.skills.slice(0, 3).join(' · '))}` : ''}</small>
            </span>
          </label>`;
        })
        .join('');
    }
    if (countEl) {
      countEl.textContent = `عرض ${items.length} من ${catalog.projects.length} · تم اختيار ${selectedCount()} مشروع`;
    }
    syncRequired();
  };

  const fillCategories = () => {
    if (!catEl) return;
    const opts = catalog.categories
      .map((c) => `<option value="${esc(c.id)}">${esc(c.nameAr)}</option>`)
      .join('');
    catEl.innerHTML = `<option value="">كل القوائم</option>${opts}`;
  };

  const readSaved = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  };

  const grantOfficeOnly = (app) => {
    const nameAr = `مكتب فريلانسر — ${app.fullName}`;
    try {
      if (window.HubSystemOps?.grantStructure) {
        return window.HubSystemOps.grantStructure({
          type: 'office',
          nameAr,
          tenantName: app.fullName,
          systemCode: 'HQ',
        });
      }
    } catch {
      /* ignore */
    }
    try {
      window.HubStore?.grantOffice?.({ nameAr, platform: 'المكتب الرئيسي' });
    } catch {
      /* ignore */
    }
    return { nameAr, type: 'office', granted: true };
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (!form) return;
    syncRequired();
    if (!form.checkValidity()) {
      form.reportValidity();
      if (!selectedCount()) toast('اختر مشروعًا جانبيًا واحدًا على الأقل من القائمة');
      return;
    }

    const fd = new FormData(form);
    const app = {
      id: `fl-${Date.now().toString(36)}`,
      kind: 'freelancer',
      status: 'pending-hq',
      grants: {
        platform: false,
        system: false,
        office: true,
        operatedBy: 'hq',
        note: 'يمنح فقط مكتب ويتم تشغيله حسب حاجة المنصات',
      },
      fullName: String(fd.get('fullName') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      specialty: String(fd.get('specialty') || '').trim(),
      experience: String(fd.get('experience') || '').trim(),
      files: {
        file: fileMeta(form.querySelector('[name="profileFile"]')),
        image: fileMeta(form.querySelector('[name="imageFile"]')),
        video: fileMeta(form.querySelector('[name="videoFile"]')),
      },
      projects: [...selected.values()],
      at: new Date().toISOString(),
    };

    const office = grantOfficeOnly(app);
    app.office = {
      nameAr: office?.nameAr || `مكتب فريلانسر — ${app.fullName}`,
      grantId: office?.grantId || '',
    };

    const prev = readSaved();
    prev.unshift(app);
    localStorage.setItem(KEY, JSON.stringify(prev.slice(0, 80)));
    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `تسجيل فريلانسر: ${app.fullName} — مكتب فقط من المقر · ${app.projects.length} مشروع`
      );
    } catch {
      /* ignore */
    }

    toast(
      `تم استلام تسجيلك كفريلانسر. لا منصة ولا نظام — يُمنح مكتب فقط ويُشغَّل من المكتب الرئيسي حسب حاجة المنصات.${
        app.office.grantId ? ` رقم المكتب: ${app.office.grantId}` : ''
      }`,
      true
    );
    form.reset();
    selected.clear();
    renderList();
  };

  const bind = async () => {
    try {
      const res = await fetch(DATA_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog = await res.json();
    } catch {
      catalog = { categories: [], projects: [] };
    }
    fillCategories();
    renderList();

    searchEl?.addEventListener('input', renderList);
    catEl?.addEventListener('change', renderList);
    listEl?.addEventListener('change', (e) => {
      const box = e.target.closest('[data-fl-project]');
      if (!box) return;
      const id = box.getAttribute('data-fl-project');
      const project = catalog.projects.find((p) => p.id === id);
      if (!project) return;
      if (box.checked) selected.set(id, { id: project.id, title: project.title, categoryId: project.categoryId });
      else selected.delete(id);
      if (countEl) {
        const showing = listEl.querySelectorAll('.fl-project-item').length;
        countEl.textContent = `عرض ${showing} · تم اختيار ${selectedCount()} مشروع`;
      }
      syncRequired();
    });
    form?.addEventListener('submit', onSubmit);
    syncRequired();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
