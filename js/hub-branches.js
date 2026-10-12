/**
 * Public branches page — free-form location picker (no catalog cards for customers).
 * Legacy HubBranchesData remains available for admin/history compatibility only.
 */
(() => {
  'use strict';

  const page = document.body?.classList?.contains('branches-page');
  if (!page) return;

  const showcase = document.querySelector('.branches-showcase');
  if (!showcase) return;

  // Remove legacy card toolbar/grid if still in markup
  showcase.querySelector('.branches-toolbar')?.remove();
  showcase.querySelector('#branchGrid')?.remove();
  showcase.querySelector('#branchFilterStatus')?.remove();

  const head = showcase.querySelector('.branches-head-copy');
  if (head) {
    const h1 = head.querySelector('h1');
    const p = head.querySelector('p');
    if (h1) h1.textContent = 'حدد موقعك أو اكتب الفرع التابع لك';
    if (p) {
      p.textContent =
        'لا قوائم فروع جاهزة. اكتب اسم الفرع أو البلد، أو حدّد موقعك على الخريطة، ثم أكّد للمتابعة إلى الحجز أو التسجيل.';
    }
  }

  let panel = showcase.querySelector('[data-branches-geo-panel]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'branches-geo-panel';
    panel.setAttribute('data-branches-geo-panel', '');
    panel.innerHTML =
      '<div data-hub-geo-branch data-title="حدد موقعك أو اكتب الفرع التابع لك"></div>' +
      '<div class="branches-geo-next">' +
      '<p class="branches-geo-hint">بعد تأكيد الموقع يمكنك المتابعة لحجز حاضنة أو منصة أو التسجيل — سيُمرَّر اسم الفرع الذي كتبته.</p>' +
      '<div class="branches-geo-cta">' +
      '<a class="branches-cta-primary" data-geo-go="incubator" href="book-incubator.html">احجز حاضنة</a>' +
      '<a class="branches-cta" data-geo-go="platform" href="book-platform.html">احجز منصة</a>' +
      '<a class="branches-cta" data-geo-go="register" href="register.html">سجل معنا</a>' +
      '</div>' +
      '<p class="branches-geo-admin-note">إدارة الفروع التاريخية متاحة للمسؤولين من غرفة العمليات — ولا تُعرض كاختيارات إجبارية للعملاء.</p>' +
      '</div>';
    const ads = showcase.querySelector('.hub-inline-ads');
    if (ads) ads.insertAdjacentElement('afterend', panel);
    else showcase.appendChild(panel);
  }

  const mountGeo = () => {
    const host = panel.querySelector('[data-hub-geo-branch]');
    if (!host || !window.HubGeoBranch) return;
    window.HubGeoBranch.mount(host, {
      required: true,
      title: 'حدد موقعك أو اكتب الفرع التابع لك',
    });
  };

  if (window.HubGeoBranch) mountGeo();
  else {
    document.addEventListener('DOMContentLoaded', mountGeo);
    setTimeout(mountGeo, 50);
  }

  const withLocationQuery = (href) => {
    const host = panel.querySelector('[data-hub-geo-branch]');
    const data = window.HubGeoBranch?.collect?.(host) || {};
    const url = new URL(href, location.href);
    if (data.branchName) {
      url.searchParams.set('branch', data.branchName);
      url.searchParams.set('branchLabel', data.branchName);
    }
    if (data.country) url.searchParams.set('country', data.country);
    if (data.city) url.searchParams.set('city', data.city);
    if (data.lat != null) url.searchParams.set('lat', String(data.lat));
    if (data.lng != null) url.searchParams.set('lng', String(data.lng));
    if (data.locationSource) url.searchParams.set('locationSource', data.locationSource);
    return url.pathname + url.search;
  };

  panel.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-geo-go]');
    if (!a) return;
    const host = panel.querySelector('[data-hub-geo-branch]');
    const v = window.HubGeoBranch?.validate?.(host, { required: true });
    if (!v?.ok) {
      ev.preventDefault();
      return;
    }
    a.setAttribute('href', withLocationQuery(a.getAttribute('href') || a.href));
  });

  // Keep hubRerender noop-safe for ads refresh
  window.hubRerender = () => {};
})();
