/**
 * عملة واجهة العملاء — موحّدة بالدولار الأمريكي فقط.
 * لاحقًا يمكن ربط اختيار العملة بالفرع دون تغيير شاشات العرض.
 */
(() => {
  'use strict';

  const CUSTOMER = Object.freeze({
    code: 'USD',
    symbol: '$',
    labelAr: 'دولار',
  });

  /** @param {number|string} amount — مثال العرض: 400$ */
  const format = (amount) => {
    const n = Number(amount) || 0;
    return `${n.toLocaleString('en-US')}${CUSTOMER.symbol}`;
  };

  window.HubCurrency = {
    CUSTOMER,
    code: () => CUSTOMER.code,
    symbol: () => CUSTOMER.symbol,
    format,
  };
})();
