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

  /** @param {number|string} amount */
  const format = (amount) => {
    const n = Number(amount) || 0;
    return `${CUSTOMER.symbol}${n.toLocaleString('en-US')}`;
  };

  window.HubCurrency = {
    CUSTOMER,
    code: () => CUSTOMER.code,
    symbol: () => CUSTOMER.symbol,
    format,
  };
})();
