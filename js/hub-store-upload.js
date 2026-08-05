/**
 * Store upload form — categories dropdown + product/service + marketplace links
 */
(() => {
  if (document.body?.dataset?.marketPage !== 'store') return;

  const data = window.HubMarketplaceData;
  const store = window.HubStore;
  if (!data || !store) return;

  const cats = (data.SHOP_CATEGORIES || []).filter((c) => c.id !== 'الكل');
  const connectors = data.MARKETPLACE_CONNECTORS || [];
  const catSelect = document.getElementById('su-category');
  const chips = document.getElementById('su-mp-chips');
  const form = document.getElementById('store-upload-form');
  const selectedMp = new Set();

  if (catSelect) {
    catSelect.innerHTML =
      `<option value="">— اختر التصنيف —</option>` +
      cats.map((c) => `<option value="${c.id}" ${c.id === 'أكاديمية' ? 'selected' : ''}>${c.name}</option>`).join('');
  }

  if (chips) {
    chips.innerHTML = connectors
      .map(
        (m) => `<button type="button" class="store-mp-chip" data-mp="${m.id}" aria-pressed="false">
          <i class="${m.icon}"></i> ${m.nameAr}
        </button>`
      )
      .join('');
    chips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mp]');
      if (!btn) return;
      const id = btn.dataset.mp;
      if (selectedMp.has(id)) {
        selectedMp.delete(id);
        btn.setAttribute('aria-pressed', 'false');
        btn.style.background = 'rgba(255,255,255,.06)';
      } else {
        selectedMp.add(id);
        btn.setAttribute('aria-pressed', 'true');
        btn.style.background = 'rgba(220,38,38,.35)';
      }
    });
  }

  const toast = (msg) => {
    if (window.HubActions?.toast) return window.HubActions.toast(msg);
    alert(msg);
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('su-title')?.value.trim();
    const category = document.getElementById('su-category')?.value;
    if (!title) return toast('اسم المنتج أو الخدمة مطلوب');
    if (!category) return toast('اختر التصنيف من القائمة المنسدلة');

    const payload = {
      title,
      brand: document.getElementById('su-brand')?.value.trim() || 'نايوش هوب',
      category,
      itemKind: document.getElementById('su-kind')?.value || 'منتج',
      price: document.getElementById('su-price')?.value,
      stock: document.getElementById('su-stock')?.value,
      points: document.getElementById('su-points')?.value,
      platformCode: document.getElementById('su-platform')?.value.trim() || '',
      desc: document.getElementById('su-desc')?.value.trim() || '',
      mirrorToCatalog: true,
      // minimal common meta defaults for public upload (full form via modal)
      party1Name: 'متجر هوب',
      party1Phone: '0500000000',
      party2Name: 'أكاديمية نايوش',
      party2Phone: '0500000001',
      branch: 'المقر',
      incubator: 'النواة السيادية — هوب 360',
      platform: 'متجر المبيعات',
      office: 'المكتب الرقمي',
    };

    const sharedUrl = document.getElementById('su-mp-url')?.value.trim() || '';
    connectors.forEach((m) => {
      if (selectedMp.has(m.id)) {
        payload[`mp_${m.id}`] = '1';
        payload[`mp_url_${m.id}`] = sharedUrl;
      }
    });
    payload.mp_custom_name = document.getElementById('su-mp-custom-name')?.value.trim() || '';
    payload.mp_url_custom = document.getElementById('su-mp-custom-url')?.value.trim() || '';

    const item = store.addStoreItem(payload);
    if (!item) return toast('تعذّر الرفع على المتجر');
    toast(`تم الرفع: ${item.title} · ${item.category}`);
    form.reset();
    document.getElementById('su-brand').value = 'أكاديمية نايوش';
    document.getElementById('su-kind').value = 'خدمة';
    document.getElementById('su-platform').value = 'ACADEMY';
    if (catSelect) catSelect.value = 'أكاديمية';
    selectedMp.clear();
    chips?.querySelectorAll('[data-mp]').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.style.background = 'rgba(255,255,255,.06)';
    });
    // refresh grid
    window.dispatchEvent(new CustomEvent('hub-store-updated'));
    setTimeout(() => window.location.reload(), 450);
  });
})();
