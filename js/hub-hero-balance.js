(() => {
  'use strict';

  const FREE_KEY = 'hubFreeBalancePoints';
  const PAID_KEY = 'hubPaidBalancePoints';
  const DEFAULT_FREE = 300;
  const OWNER_FALLBACK = 'زائر هوب';

  const fmt = (n) => Number(n || 0).toLocaleString('ar-EG');

  const readFree = () => {
    const raw = localStorage.getItem(FREE_KEY);
    if (raw === null || raw === '') {
      localStorage.setItem(FREE_KEY, String(DEFAULT_FREE));
      return DEFAULT_FREE;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE;
  };

  const walletOwner = () => {
    const user = window.HubAuth?.getUser?.();
    if (user?.name) return user.name;
    if (user?.email) return user.email;
    return OWNER_FALLBACK;
  };

  const paidBalance = () => {
    try {
      const user = window.HubAuth?.getUser?.();
      const wallets = window.HubStore?.get?.()?.empire?.wallet?.wallets || [];
      if (user) {
        const owner = user.name || user.email;
        const mine = wallets.find((w) => w.owner === owner);
        if (mine) return Number(mine.balance) || 0;
      }
      const guest = wallets.find((w) => w.owner === OWNER_FALLBACK);
      if (guest) return Number(guest.balance) || 0;
      const localPaid = Number(localStorage.getItem(PAID_KEY));
      return Number.isFinite(localPaid) && localPaid > 0 ? localPaid : 0;
    } catch {
      return Number(localStorage.getItem(PAID_KEY)) || 0;
    }
  };

  const render = () => {
    const freeEl = document.querySelector('[data-hub-free-points]');
    const paidEl = document.querySelector('[data-hub-paid-points]');
    if (freeEl) freeEl.textContent = fmt(readFree());
    if (paidEl) paidEl.textContent = fmt(paidBalance());
  };

  const openModal = () => {
    const modal = document.getElementById('hub-charge-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const input = document.getElementById('hub-charge-amount');
    if (input && !input.value) input.value = '500';
    document.querySelectorAll('.hub-charge-pack').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.amount === String(input?.value || '500'));
    });
  };

  const closeModal = () => {
    const modal = document.getElementById('hub-charge-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    const fb = document.getElementById('hub-charge-feedback');
    if (fb) {
      fb.textContent = '';
      fb.classList.remove('is-error');
    }
  };

  const ensureWalletAndTopup = (owner, amt) => {
    if (!window.HubStore?.get || !window.HubStore?.topupWallet) return null;
    const state = window.HubStore.get();
    const list = state?.empire?.wallet?.wallets;
    if (!Array.isArray(list)) return null;
    let w = list.find((x) => x.owner === owner);
    if (!w) {
      list.unshift({
        id: `w-guest-${Date.now()}`,
        owner,
        balance: 0,
        burn30d: 0,
      });
    }
    return window.HubStore.topupWallet(owner, amt);
  };

  const charge = (amount) => {
    const amt = Math.floor(Number(amount) || 0);
    const fb = document.getElementById('hub-charge-feedback');
    if (amt <= 0) {
      if (fb) {
        fb.textContent = 'أدخل مبلغ شحن صالح.';
        fb.classList.add('is-error');
      }
      return;
    }

    const owner = walletOwner();
    let ok = ensureWalletAndTopup(owner, amt);

    if (!ok) {
      const cur = Number(localStorage.getItem(PAID_KEY)) || 0;
      localStorage.setItem(PAID_KEY, String(cur + amt));
      ok = true;
    }

    if (fb) {
      fb.textContent = `تم شحن ${fmt(amt)} نقطة بنجاح.`;
      fb.classList.remove('is-error');
    }
    render();
    window.setTimeout(closeModal, 900);
  };

  const bind = () => {
    document.querySelectorAll('[data-hub-charge-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    document.getElementById('hub-charge-modal-close')?.addEventListener('click', closeModal);
    document.querySelector('.hub-charge-modal__backdrop')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    document.querySelectorAll('.hub-charge-pack').forEach((btn) => {
      btn.addEventListener('click', () => {
        const amount = btn.dataset.amount || '500';
        const input = document.getElementById('hub-charge-amount');
        if (input) input.value = amount;
        document.querySelectorAll('.hub-charge-pack').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });

    document.getElementById('hub-charge-submit')?.addEventListener('click', () => {
      const amount = document.getElementById('hub-charge-amount')?.value;
      charge(amount);
    });

    render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.HubHeroBalance = { render, openModal, readFree, paidBalance };
})();
