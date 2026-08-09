/**
 * سياق المستأجر في هوب — يسهّل «مساحتي» من الشريط الجانبي
 * تخزين محلي فقط (ليس SSO مؤسسي)
 */
(() => {
  'use strict';

  const KEY = 'naiosh_hub_tenant_v1';

  const defaults = () => ({
    id: 'tenant-demo',
    nameAr: 'مستأجر نايوش التجريبي',
    type: 'platform', // branch | incubator | platform | office
    role: 'owner', // owner | staff | trainee | trainer
    updatedAt: new Date().toISOString(),
  });

  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return { ...defaults(), ...JSON.parse(raw) };
    } catch {
      return defaults();
    }
  };

  const write = (patch = {}) => {
    const next = { ...read(), ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('hub:tenant-changed', { detail: next }));
    return next;
  };

  const labelForType = (type) =>
    ({
      branch: 'فرع',
      incubator: 'حاضنة',
      platform: 'منصة',
      office: 'مكتب إلكتروني',
    }[type] || 'مستأجر');

  const bannerHtml = () => {
    const t = read();
    return `<aside class="hub-tenant-banner" data-hub-tenant-banner>
      <div>
        <strong>${t.nameAr}</strong>
        <span>${labelForType(t.type)} · دور: ${t.role}</span>
      </div>
      <div class="hub-tenant-banner-actions">
        <a href="office.html">مكتبي</a>
        <a href="user-path.html">مسار المستخدم</a>
        <button type="button" data-hub-tenant-edit>تعديل السياق</button>
      </div>
    </aside>`;
  };

  const mountBanner = (root) => {
    if (!root) return;
    root.insertAdjacentHTML('afterbegin', bannerHtml());
    root.querySelector('[data-hub-tenant-edit]')?.addEventListener('click', () => {
      const nameAr = window.prompt('اسم المستأجر / المنصة / الفرع', read().nameAr);
      if (!nameAr) return;
      const type = window.prompt('النوع: branch | incubator | platform | office', read().type) || read().type;
      write({ nameAr: nameAr.trim(), type: String(type).trim() });
      location.reload();
    });
  };

  window.HubTenant = { KEY, read, write, defaults, labelForType, bannerHtml, mountBanner };
})();
