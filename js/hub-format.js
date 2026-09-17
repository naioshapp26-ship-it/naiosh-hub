/**
 * منسّق مركزي — أرقام إنجليزية 0-9 وتواريخ/أوقات موحّدة
 * الواجهة تبقى عربية RTL؛ الأرقام لاتينية دائمًا.
 */
(() => {
  'use strict';

  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  const toLatinDigits = (input) => {
    let s = String(input ?? '');
    s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
    s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
    return s;
  };

  const formatNumber = (value, opts = {}) => {
    if (value == null || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return toLatinDigits(value);
    try {
      return toLatinDigits(
        new Intl.NumberFormat('en-US', {
          useGrouping: opts.grouping !== false,
          maximumFractionDigits: opts.maxFractionDigits ?? 2,
          minimumFractionDigits: opts.minFractionDigits ?? 0,
        }).format(n)
      );
    } catch {
      return toLatinDigits(String(n));
    }
  };

  const pad2 = (n) => String(Math.trunc(Math.abs(Number(n) || 0))).padStart(2, '0');

  const formatDate = (input, opts = {}) => {
    if (!input) return '—';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return toLatinDigits(input);
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = String(d.getFullYear());
    if (opts.style === 'iso') return `${yyyy}-${mm}-${dd}`;
    // سياسة المنصة: YYYY/MM/DD بأرقام لاتينية
    return `${yyyy}/${mm}/${dd}`;
  };

  const formatTime = (input, opts = {}) => {
    if (!input) return '—';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return toLatinDigits(input);
    if (opts.hour12 === false) {
      const hh = pad2(d.getHours());
      const mi = pad2(d.getMinutes());
      if (opts.withSeconds) return `${hh}:${mi}:${pad2(d.getSeconds())}`;
      return `${hh}:${mi}`;
    }
    let h = d.getHours();
    const mi = pad2(d.getMinutes());
    const isPm = h >= 12;
    h = h % 12 || 12;
    const hh = pad2(h);
    const period = isPm ? 'م' : 'ص';
    if (opts.withSeconds) return `${hh}:${mi}:${pad2(d.getSeconds())} ${period}`;
    return `${hh}:${mi} ${period}`;
  };

  const formatDateTime = (input) => {
    if (!input) return '—';
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return toLatinDigits(input);
    return `${formatDate(d)} - ${formatTime(d)}`;
  };

  /** يمرّ على نص/HTML بسيط ويحوّل الأرقام العربية إلى لاتينية */
  const forceLatinInText = (text) => toLatinDigits(text);

  const walkTextNodes = (root, fn) => {
    if (!root || !fn) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(fn);
  };

  /** يطبّق تحويل الأرقام على DOM الحالي ويراقب الإضافات */
  const installDomGuard = (root = document.body) => {
    if (!root || typeof MutationObserver === 'undefined') return;
    const fix = (node) => {
      if (!node || !node.nodeValue) return;
      if (node.parentElement && /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/i.test(node.parentElement.tagName)) return;
      const next = toLatinDigits(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    };
    walkTextNodes(root, fix);
    if (root.__hubFormatObs) return;
    const obs = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'characterData') fix(m.target);
        m.addedNodes &&
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 3) fix(n);
            else if (n.nodeType === 1) walkTextNodes(n, fix);
          });
      });
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    root.__hubFormatObs = obs;
  };

  window.HubFormat = {
    toLatinDigits,
    formatNumber,
    formatDate,
    formatTime,
    formatDateTime,
    forceLatinInText,
    installDomGuard,
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => installDomGuard(document.body));
    } else {
      try {
        installDomGuard(document.body);
      } catch (_) {}
    }
  }
})();
