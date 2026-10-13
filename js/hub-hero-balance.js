(() => {
  'use strict';

  const FREE_KEY = 'hubFreeBalancePoints';
  const PAID_KEY = 'hubPaidBalancePoints';
  const DEFAULT_FREE = 0; // guests see 0 until claim/login; server is source of truth
  const OWNER_FALLBACK = 'زائر هوب';

  const fmt = (n) => Number(n || 0).toLocaleString('en-US');

  const token = () =>
    (window.HubAuth && window.HubAuth.getToken && window.HubAuth.getToken()) ||
    localStorage.getItem('hubToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('hubAuthToken') ||
    '';

  const readLocalFree = () => {
    const raw = localStorage.getItem(FREE_KEY);
    if (raw === null || raw === '') return DEFAULT_FREE;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE;
  };

  const paidBalanceLocal = () => {
    try {
      const user = window.HubAuth?.getUser?.();
      const wallets = window.HubStore?.get?.()?.empire?.wallet?.wallets || [];
      if (user) {
        const owner = user.name || user.email;
        const mine = wallets.find((w) => w.owner === owner);
        if (mine) return Number(mine.balance) || 0;
      }
      const localPaid = Number(localStorage.getItem(PAID_KEY));
      return Number.isFinite(localPaid) && localPaid > 0 ? localPaid : 0;
    } catch {
      return Number(localStorage.getItem(PAID_KEY)) || 0;
    }
  };

  let serverWallet = null;

  const render = () => {
    const freeEl = document.querySelector('[data-hub-free-points]');
    const paidEl = document.querySelector('[data-hub-paid-points]');
    const free = serverWallet ? Number(serverWallet.free) || 0 : readLocalFree();
    const paid = serverWallet ? Number(serverWallet.paid) || 0 : paidBalanceLocal();
    if (freeEl) freeEl.textContent = fmt(free);
    if (paidEl) paidEl.textContent = fmt(paid);
  };

  const syncFromServer = async () => {
    const t = token();
    if (!t) {
      serverWallet = null;
      render();
      return;
    }
    try {
      const res = await fetch('/api/hub/packages/me', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + t, 'X-Hub-Token': t },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.wallet) {
        serverWallet = data.wallet;
        localStorage.setItem(FREE_KEY, String(Number(data.wallet.free) || 0));
        localStorage.setItem(PAID_KEY, String(Number(data.wallet.paid) || 0));
      }
    } catch {
      /* keep local */
    }
    render();
  };

  const openModal = () => {
    // Real packages page — no local fake top-up
    window.location.href = 'packages.html';
  };

  const closeModal = () => {
    const modal = document.getElementById('hub-charge-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  const bind = () => {
    document.querySelectorAll('[data-hub-charge-open]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    const chargeLink = document.querySelector('.hub-balance-charge');
    if (chargeLink) chargeLink.setAttribute('href', 'packages.html');

    document.getElementById('hub-charge-modal-close')?.addEventListener('click', closeModal);
    document.querySelector('.hub-charge-modal__backdrop')?.addEventListener('click', closeModal);

    // Redirect modal submit to packages if someone opens modal somehow
    document.getElementById('hub-charge-submit')?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    syncFromServer();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.HubHeroBalance = { render, openModal, syncFromServer, readFree: readLocalFree, paidBalance: paidBalanceLocal };
})();
