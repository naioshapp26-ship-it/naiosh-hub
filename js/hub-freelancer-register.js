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

  const fileMeta = async (input) => {
    const f = input?.files?.[0];
    if (!f) return null;
    const limits = window.HubUploadLimits;
    const check = limits?.assertFile ? limits.assertFile(f) : { ok: f.size <= 150 * 1024 * 1024 };
    if (!check.ok) throw new Error(check.error || 'حجم الملف أكبر من 150MB');
    let url = '';
    if (limits?.uploadFile) {
      const uploaded = await limits.uploadFile(f);
      url = uploaded.url || '';
    }
    return { name: f.name, size: f.size, type: f.type, url };
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
    // مسار الفريلانسر: مكتب فقط من المقر — بدون منصة وبدون نظام
    if (window.HubClientOffices?.grantFromBooking) {
      const res = window.HubClientOffices.grantFromBooking({
        kind: 'freelancer',
        source: 'freelancer',
        email: app.email,
        fullName: app.fullName,
        phone: app.phone,
        officeName: nameAr,
        systems: [],
      });
      if (res?.ok) {
        return {
          nameAr: res.office?.officeName || nameAr,
          grantId: res.office?.grantId || '',
          type: 'office',
          platform: false,
          system: false,
          operatedBy: 'hq',
          office: res.office,
        };
      }
    }
    try {
      if (window.HubSystemOps?.grantStructure) {
        return window.HubSystemOps.grantStructure({
          type: 'office',
          nameAr,
          tenantName: app.fullName,
          systemCode: '',
          refId: 'HQ',
        });
      }
    } catch {
      /* ignore */
    }
    return { nameAr, type: 'office', granted: true, platform: false, system: false, operatedBy: 'hq' };
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form) return;
    syncRequired();
    if (!form.checkValidity()) {
      form.reportValidity();
      if (!selectedCount()) toast('اختر مشروعًا جانبيًا واحدًا على الأقل من القائمة');
      return;
    }

    const fd = new FormData(form);
    toast('جاري رفع الملفات (حتى 150 ميجابايت)...');
    let files;
    try {
      files = {
        file: await fileMeta(form.querySelector('[name="profileFile"]')),
        image: await fileMeta(form.querySelector('[name="imageFile"]')),
        video: await fileMeta(form.querySelector('[name="videoFile"]')),
      };
    } catch (err) {
      toast(err.message || 'فشل رفع الملف');
      return;
    }
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
      files,
      projects: [...selected.values()],
      at: new Date().toISOString(),
    };

    const office = grantOfficeOnly(app);
    app.office = {
      nameAr: office?.nameAr || `مكتب فريلانسر — ${app.fullName}`,
      grantId: office?.grantId || '',
      operatedBy: 'hq',
      platformGranted: false,
      systemGranted: false,
    };

    const prev = readSaved();
    prev.unshift(app);
    localStorage.setItem(KEY, JSON.stringify(prev.slice(0, 80)));
    try {
      window.HubStore?.pushFeed?.(
        'decision',
        `احجز معنا فريلانسر: ${app.fullName} — مكتب فقط من المقر · بدون منصة/نظام · ${app.projects.length} مشروع`
      );
    } catch {
      /* ignore */
    }

    const emailQ = encodeURIComponent(app.email);
    if (feedback) {
      feedback.hidden = false;
      feedback.classList.remove('is-error');
      feedback.classList.add('is-ok');
      feedback.innerHTML = `تم استلام حجزك كفريلانسر. <strong>لا منصة ولا نظام</strong> — يُمنح <strong>مكتب فقط</strong> ويُشغَّل من <strong>المكتب الرئيسي</strong> حسب حاجة المنصات.${
        app.office.grantId ? ` رقم المكتب: <strong>${esc(app.office.grantId)}</strong>.` : ''
      } <a href="my-office.html?email=${emailQ}">افتح مكتبي</a>`;
    }
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
