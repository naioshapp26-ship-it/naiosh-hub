/**
 * معالج صفحة استئجار النظام — نفس تدفق saas-signup في ERP داخل HUB
 */
(() => {
  'use strict';

  const store = () => window.HubRentStore;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    step: 1,
    plan: 'basic',
    systems: new Set(),
    subdomainOk: false,
    rentalId: null,
  };

  const toast = (msg) => {
    let el = $('#hub-rent-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hub-rent-toast';
      el.className = 'hub-rent-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-show');
    setTimeout(() => el.classList.remove('is-show'), 2600);
  };

  const setStep = (n) => {
    state.step = n;
    const shell = $('[data-rent-shell]');
    shell?.classList.toggle('is-wide', n === 2);

    $$('[data-rent-panel]').forEach((p) => {
      p.hidden = Number(p.dataset.rentPanel) !== n;
    });

    $$('[data-rent-circle]').forEach((c) => {
      const i = Number(c.dataset.rentCircle);
      c.classList.toggle('is-active', i === n);
      c.classList.toggle('is-done', i < n);
    });
    $$('[data-rent-line]').forEach((l) => {
      const i = Number(l.dataset.rentLine);
      l.classList.toggle('is-done', i < n);
    });
  };

  const currentEmail = () => String($('#adminEmail')?.value || '').trim().toLowerCase();

  const renderSystems = () => {
    const grid = $('[data-rent-systems]');
    const chips = $('[data-rent-chips]');
    const q = String($('[data-rent-search]')?.value || '').trim().toLowerCase();
    if (!grid) return;

    const email = currentEmail();
    const visible = new Set(store().visibleCodesFor(email));
    const all = store().catalogSystems();
    const list = all.filter((s) => {
      if (q && !`${s.code} ${s.nameAr}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (!list.length) {
      grid.innerHTML = '<p class="hub-rent-hint">لا أنظمة ظاهرة لصلاحيات هذا الحساب — راجع إدارة الاستئجار في هوب.</p>';
      chips.innerHTML = '<span style="color:#94a3b8;font-size:12px;font-weight:700">لم يتم اختيار أي نظام بعد</span>';
      return;
    }

    grid.innerHTML = list
      .map((s) => {
        const allowed = visible.has(s.code);
        const selected = state.systems.has(s.code);
        return `<button type="button" class="hub-rent-system-card ${selected ? 'is-selected' : ''} ${allowed ? '' : 'is-locked'}" data-sys="${s.code}" ${allowed ? '' : 'disabled'}>
          <div class="hub-rent-system-ico"><i class="fas ${s.icon}"></i></div>
          <strong>${s.nameAr}</strong>
          <small>${s.code}${s.isLive ? ' · مباشر' : ''}${allowed ? '' : ' · غير مسموح'}</small>
        </button>`;
      })
      .join('');

    chips.innerHTML = state.systems.size
      ? [...state.systems]
          .map((c) => {
            const meta = all.find((x) => x.code === c);
            return `<span class="hub-rent-chip"><i class="fas ${meta?.icon || 'fa-cube'}"></i>${meta?.nameAr || c}</span>`;
          })
          .join('')
      : '<span style="color:#94a3b8;font-size:12px;font-weight:700">لم يتم اختيار أي نظام بعد</span>';

    grid.querySelectorAll('[data-sys]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-sys');
        if (!visible.has(code)) return;
        if (state.systems.has(code)) state.systems.delete(code);
        else state.systems.add(code);
        renderSystems();
      });
    });
  };

  const checkSubdomain = async () => {
    const input = $('#subdomain');
    const status = $('[data-subdomain-status]');
    if (!input || !status) return;
    const raw = store().normalizeSlug(input.value);
    input.value = raw;
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق من هوب وERP…';
    status.className = 'hub-rent-subdomain-status';
    const res = await store().validateSubdomainAsync(raw);
    state.subdomainOk = Boolean(res.available);
    status.innerHTML = res.available
      ? `<i class="fas fa-circle-check"></i> ${res.message}`
      : raw
        ? `<i class="fas fa-circle-xmark"></i> ${res.message}`
        : res.message;
    status.className = `hub-rent-subdomain-status ${res.available ? 'is-ok' : raw ? 'is-bad' : ''}`;
  };

  const readForm = () => ({
    companyName: $('#companyName')?.value.trim() || '',
    subdomain: $('#subdomain')?.value.trim() || '',
    slug: $('#subdomain')?.value.trim() || '',
    adminName: $('#adminName')?.value.trim() || '',
    adminPhone: $('#adminPhone')?.value.trim() || '',
    adminEmail: $('#adminEmail')?.value.trim() || '',
    adminPassword: $('#adminPassword')?.value || '',
    plan: state.plan,
    systems: [...state.systems],
    payMethod: document.querySelector('input[name="payMethod"]:checked')?.value || 'hub',
  });

  const goStep2 = () => {
    const f = readForm();
    if (!f.companyName || !f.subdomain || !f.adminName || !f.adminPhone || !f.adminPassword) {
      return toast('يرجى ملء جميع الحقول المطلوبة *');
    }
    if (!state.subdomainOk) return toast('تحقق من توفر النطاق الفرعي أولًا');
    setStep(2);
    renderSystems();
  };

  const goStep3 = () => {
    if (!state.systems.size) return toast('اختر نظامًا واحدًا على الأقل');
    const plan = store().PLAN_META[state.plan];
    $('[data-pay-plan]').textContent = plan?.label || state.plan;
    $('[data-pay-amount]').textContent = plan?.amount || '—';
    $('[data-pay-host]').textContent = `${store().normalizeSlug($('#subdomain').value)}.${store().BASE_DOMAIN}`;
    $('[data-pay-systems]').textContent = [...state.systems].join(' · ');
    setStep(3);
  };

  const runProvision = async (rental) => {
    setStep(4);
    const steps = $$('[data-provision-step]');
    const mark = (i, cls) => {
      steps.forEach((s, idx) => {
        s.classList.remove('is-run', 'is-done');
        if (idx < i) s.classList.add('is-done');
        if (idx === i) s.classList.add(cls);
      });
    };

    mark(0, 'is-run');
    await wait(400);
    mark(1, 'is-run');
    await wait(300);
    mark(2, 'is-run');

    const act = await store().activateRentalAsync(rental.id);
    if (!act.ok) {
      toast(act.error || 'فشل التفعيل / ربط ERP');
      setStep(3);
      return;
    }

    mark(3, 'is-run');
    await wait(350);
    steps.forEach((s) => s.classList.add('is-done'));
    fillSuccess(act.rental, 'تم تجهيز المستأجر عبر نايوش هوب وربطه بمحرك ERP.');
    setStep(5);
  };

  const fillSuccess = (rental, note) => {
    state.rentalId = rental.id;
    $('[data-success-company]').textContent = rental.companyName;
    $('[data-success-host]').textContent = rental.host;
    $('[data-success-systems]').textContent = (rental.systems || []).join(' · ');
    if (note) $('[data-success-note]').textContent = note;

    const erpBox = $('[data-success-erp]');
    const erpLink = $('[data-success-erp-link]');
    const openBtn = $('[data-success-open]');
    const erpUrl = rental.erp?.loginUrl || '';

    if (erpBox && erpLink) {
      if (erpUrl) {
        erpBox.hidden = false;
        erpLink.href = erpUrl;
        erpLink.textContent = erpUrl;
      } else {
        erpBox.hidden = true;
      }
    }

    if (openBtn) {
      if (erpUrl) openBtn.href = erpUrl;
      else {
        const primary = rental.systems?.[0] || 'ERP';
        const live = window.HubLiveSystems?.url?.(primary);
        openBtn.href = live || `apps.html#${String(primary).toLowerCase()}`;
      }
    }
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const submitPayment = async () => {
    const f = readForm();
    const res = store().submitRental(f);
    if (!res.ok) return toast(res.error || 'تعذّر إرسال الطلب');

    if (res.rental.status === 'pending') {
      fillSuccess(
        res.rental,
        'الطلب بانتظار اعتماد غرفة العمليات في هوب — بعد الموافقة يُجهَّز مستأجر ERP ويُمنح الصب دومين.'
      );
      const openBtn = $('[data-success-open]');
      if (openBtn) openBtn.href = 'rent-admin.html';
      setStep(5);
      toast('تم إرسال طلب الاستئجار للمراجعة');
      return;
    }

    await runProvision(res.rental);
  };

  const bind = () => {
    let timer = null;
    $('#subdomain')?.addEventListener('input', () => {
      clearTimeout(timer);
      const status = $('[data-subdomain-status]');
      if (status) {
        status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق…';
        status.className = 'hub-rent-subdomain-status';
      }
      state.subdomainOk = false;
      timer = setTimeout(() => {
        checkSubdomain().catch(() => {});
      }, 500);
    });

    $$('[data-plan]').forEach((card) => {
      card.addEventListener('click', () => {
        $$('[data-plan]').forEach((c) => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        state.plan = card.getAttribute('data-plan');
      });
    });

    $('[data-go-step2]')?.addEventListener('click', goStep2);
    $('[data-go-step3]')?.addEventListener('click', goStep3);
    $('[data-back-step1]')?.addEventListener('click', () => setStep(1));
    $('[data-back-step2]')?.addEventListener('click', () => setStep(2));
    $('[data-submit-rent]')?.addEventListener('click', submitPayment);
    $('[data-rent-search]')?.addEventListener('input', renderSystems);
    $('#adminEmail')?.addEventListener('change', () => {
      if (state.step === 2) renderSystems();
    });

    // preselect system from query ?system=ERP
    const params = new URLSearchParams(location.search);
    const pre = String(params.get('system') || '').toUpperCase();
    if (pre) state.systems.add(pre);

    const suffix = $('[data-subdomain-suffix]');
    if (suffix) suffix.textContent = `.${store().BASE_DOMAIN}`;

    setStep(1);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!$('[data-rent-shell]')) return;
    await store()?.hydrate?.();
    bind();
  });
})();
