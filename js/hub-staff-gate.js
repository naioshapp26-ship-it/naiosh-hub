/**
 * Hard gate for staff-only HTML pages.
 * Include in <head> of admin pages: <script src="js/hub-staff-gate.js?v=1"></script>
 */
(function () {
  try {
    var raw = localStorage.getItem('hubUser') || sessionStorage.getItem('hubUser');
    if (!raw) {
      location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html'));
      return;
    }
    var u = JSON.parse(raw);
    var r = String((u && u.role) || '').toLowerCase();
    if (r === 'customer' || r === 'client' || r === 'client_user') {
      location.replace('client.html');
    }
  } catch (e) {
    /* ignore */
  }
})();
