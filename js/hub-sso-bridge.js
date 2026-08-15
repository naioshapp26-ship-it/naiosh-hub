/**
 * صفحة جسر SSO: تحقق من تذكرة هوب ثم فتح النظام الهدف
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get('token') || params.get('hubTicket') || '').trim();
  const sig = String(params.get('sig') || params.get('hubSig') || '').trim();
  const auto = params.get('auto') !== '0';

  const setText = (sel, value) => {
    const el = $(sel);
    if (el) el.textContent = value || '—';
  };

  const setState = (state, lead, statusText) => {
    const panel = $('.hub-sso-panel');
    if (panel) panel.setAttribute('data-sso-state', state);
    if (lead != null) setText('[data-sso-lead]', lead);
    const status = $('[data-sso-status]');
    if (status) {
      if (statusText) {
        status.hidden = false;
        status.textContent = statusText;
      } else {
        status.hidden = true;
      }
    }
  };

  const openTarget = (url) => {
    if (!url) return;
    window.location.assign(url);
  };

  const run = async () => {
    if (!token) {
      setState('error', 'لا توجد تذكرة SSO في الرابط.', 'افتح النظام من «أنظمتي» أو بعد تفعيل الاستئجار.');
      $('[data-sso-actions]').hidden = false;
      $('[data-sso-open]')?.setAttribute('hidden', '');
      $('[data-sso-copy]')?.setAttribute('hidden', '');
      return;
    }

    try {
      const qs = new URLSearchParams({ token, format: 'json' });
      if (sig) qs.set('sig', sig);
      const res = await fetch(`/api/hub/sso/bridge?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!data?.ok) {
        setState('error', 'تعذّر التحقق من تذكرة هوب.', data?.error || 'التذكرة غير صالحة أو منتهية.');
        $('[data-sso-actions]').hidden = false;
        $('[data-sso-open]')?.setAttribute('hidden', '');
        $('[data-sso-copy]')?.setAttribute('hidden', '');
        return;
      }

      const ticket = data.ticket || {};
      setState('ready', 'تم التحقق من هويتك في هوب. جاري فتح النظام…', 'تذكرة SSO صالحة');
      $('[data-sso-meta]').hidden = false;
      $('[data-sso-actions]').hidden = false;
      setText('[data-sso-email]', ticket.email || ticket.name || '—');
      setText('[data-sso-system]', ticket.systemCode || data.systemCode || 'ERP');
      setText('[data-sso-tenant]', ticket.tenant || data.tenant || '—');

      const note = $('[data-sso-note]');
      if (note) {
        note.hidden = false;
        note.textContent =
          data.note ||
          'ERP يعرض صفحة الدخول للمستأجر الصحيح. أدخل كلمة المرور حتى يُفعَّل الدخول التلقائي على جانب ERP.';
      }

      const openBtn = $('[data-sso-open]');
      openBtn?.addEventListener('click', () => openTarget(data.targetUrl));

      const copyBtn = $('[data-sso-copy]');
      copyBtn?.addEventListener('click', async () => {
        const email = String(ticket.email || '');
        if (!email) return;
        try {
          await navigator.clipboard.writeText(email);
          copyBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> نسخ البريد';
          }, 1600);
        } catch {
          /* ignore */
        }
      });

      if (auto && data.targetUrl) {
        setTimeout(() => openTarget(data.targetUrl), 900);
      }
    } catch (error) {
      setState('error', 'فشل الاتصال بجسر SSO.', error.message || 'خطأ شبكة');
      $('[data-sso-actions]').hidden = false;
      $('[data-sso-open]')?.setAttribute('hidden', '');
    }
  };

  document.addEventListener('DOMContentLoaded', run);
})();
