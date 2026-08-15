/**
 * صفحات الحجز — حاضنة · منصة · مكتب
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-hub-book]');
  if (!root) return;

  const kind = root.getAttribute('data-hub-book') || 'incubator';
  const select = root.querySelector('[data-book-target]');
  const form = root.querySelector('[data-book-form]');
  const feedback = root.querySelector('[data-book-feedback]');

  const OFFICE_OPTIONS = [
    { id: 'office-private', label: 'مكتب خاص — تشغيل فردي داخل هوب' },
    { id: 'office-branch', label: 'مكتب فرع — مرتبط بفرع جغرافي' },
    { id: 'office-incubator', label: 'مكتب حاضنة — داخل برنامج قطاعي' },
    { id: 'office-platform', label: 'مكتب منصة — مرتبط بمنصة سيادية' },
    { id: 'office-shared', label: 'مكتب مشترك — مساحة عمل جماعية' },
  ];

  const fillTargets = () => {
    if (!select) return;
    let options = [];

    if (kind === 'incubator') {
      const list = window.HubIncubatorsData?.INCUBATORS || [];
      options = list.slice(0, 40).map((inc) => ({
        id: inc.id,
        label: `${inc.num}. ${inc.name} — ${inc.sector}`,
      }));
      if (!options.length) {
        options = [
          { id: 'inc-edu', label: 'التعليم والتعلم' },
          { id: 'inc-digital', label: 'التسويق الرقمي' },
          { id: 'inc-health', label: 'الصحة والجمال' },
          { id: 'inc-food', label: 'الطعام والشراب' },
        ];
      }
    } else if (kind === 'platform') {
      const list = window.HubSovereignPlatforms?.list || [];
      options = list.map((p) => ({
        id: p.code,
        label: `${p.nameAr} — ${p.role}`,
      }));
    } else if (kind === 'office') {
      options = OFFICE_OPTIONS.map((o) => ({ id: o.id, label: o.label }));
    }

    select.innerHTML =
      `<option value="" selected disabled>اختر ${
        kind === 'incubator' ? 'الحاضنة' : kind === 'platform' ? 'المنصة' : 'نوع المكتب'
      }</option>` +
      options.map((o) => `<option value="${o.id}">${o.label}</option>`).join('');
  };

  const kindLabel =
    kind === 'incubator' ? 'حاضنة' : kind === 'platform' ? 'منصة' : 'مكتب';

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const payload = {
      kind,
      target: String(data.get('target') || ''),
      fullName: String(data.get('fullName') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      date: String(data.get('date') || ''),
      duration: String(data.get('duration') || ''),
      notes: String(data.get('notes') || '').trim(),
      at: new Date().toISOString(),
    };

    try {
      const key = 'naiosh-hub-bookings';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift(payload);
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
    } catch {
      /* ignore storage errors */
    }

    window.HubStore?.pushFeed?.('decision', `طلب حجز ${kindLabel}: ${payload.target} — ${payload.fullName}`);

    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = `تم استلام طلب حجز ال${kindLabel}. فريق هوب بيتواصل معك خلال 24 ساعة لتأكيد الموعد والمسار.`;
    }
    form.reset();
    fillTargets();
  });

  fillTargets();
})();
