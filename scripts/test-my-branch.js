/**
 * Node checks: sidebar فرعي → my-branch.html (user branch only)
 * Header الفروع stays branches.html (full catalog)
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(k),
};

const window = {
  localStorage,
  dispatchEvent() {},
};

const context = vm.createContext({ window, localStorage, console });
const load = (rel) => {
  vm.runInContext(fs.readFileSync(path.join('/workspace', rel), 'utf8'), context, { filename: rel });
};

load('js/hub-branches-data.js');
load('js/hub-client-branches.js');

const CB = window.HubClientBranches;
assert(CB, 'HubClientBranches missing');

const emailA = 'branch-a@test.com';
const emailB = 'branch-b@test.com';
const sa = 'br-sa';
const eg = 'br-eg';

const grantA = CB.grantFromBooking({
  email: emailA,
  branch: sa,
  branchLabel: 'السعودية',
  source: 'booking',
});
assert(grantA.ok, grantA.error);
assert.strictEqual(grantA.branches.length, 1);
assert.strictEqual(grantA.branches[0].branch, sa);

const grantB = CB.grantFromBooking({
  email: emailB,
  branch: eg,
  branchLabel: 'مصر',
  source: 'register',
});
assert(grantB.ok, grantB.error);

assert.strictEqual(CB.listForEmail(emailA).length, 1);
assert.strictEqual(CB.listForEmail(emailB).length, 1);
assert.strictEqual(CB.listForEmail(emailA)[0].branch, sa);
assert.strictEqual(CB.listForEmail(emailB)[0].branch, eg);
assert.strictEqual(CB.listForEmail('nobody@test.com').length, 0);

const again = CB.grantFromBooking({ email: emailA, branch: sa, branchLabel: 'السعودية' });
assert(again.ok);
assert.strictEqual(CB.listForEmail(emailA).length, 1, 'same branch must not duplicate');

localStorage.setItem(
  'naiosh-hub-bookings',
  JSON.stringify([{ email: 'from-booking@test.com', branch: 'br-jo', branchLabel: 'الأردن' }])
);
assert.strictEqual(CB.listForEmail('from-booking@test.com').length, 1);
assert.strictEqual(CB.listForEmail('from-booking@test.com')[0].branch, 'br-jo');
assert.strictEqual(CB.listForEmail(emailA)[0].branch, sa, 'email A still isolated after other booking');

const sidebar = fs.readFileSync('/workspace/js/hero-sidebar-nav.js', 'utf8');
assert(sidebar.includes("ensure('فرعي', 'my-branch.html'"), 'sidebar ensure فرعي missing');
assert(sidebar.includes("href: 'my-branch.html'"), 'sidebar my-branch href missing');
assert(sidebar.includes("label === 'فرعي'"), 'sidebar remap for فرعي missing');
assert(
  !sidebar.includes("{ label: 'فرعي', href: 'branches.html'"),
  'sidebar fallback still points فرعي to all branches'
);

const index = fs.readFileSync('/workspace/index.html', 'utf8');
const header = index.match(/<header class="top-nav"[\s\S]*?<\/header>/);
assert(header, 'homepage header missing');
assert(header[0].includes('href="branches.html">الفروع'), 'header الفروع must stay on branches.html');
assert(!header[0].includes('my-branch.html'), 'header must not replace الفروع with فرعي');
assert(index.includes('hero-sidebar-nav.js?v=12'), 'sidebar cache-bust missing');

const mine = fs.readFileSync('/workspace/my-branch.html', 'utf8');
assert(mine.includes('فرع حسابك فقط') || mine.includes('فرع المستخدم فقط'), 'my-branch copy missing');
assert(mine.includes('hub-client-branches.js'), 'my-branch script missing');
assert(mine.includes('href="branches.html">الفروع'), 'my-branch still links full catalog');

const office = fs.readFileSync('/workspace/js/hub-office.js', 'utf8');
assert(office.includes("href: 'my-branch.html'"), 'office shortcut فرعي missing');
assert(!office.includes("href: 'branches.html', icon: 'fa-code-branch', label: 'فرعي'"), 'office still opens all branches');

const pathFile = fs.readFileSync('/workspace/js/hub-user-path.js', 'utf8');
assert(pathFile.includes("{ href: 'my-branch.html', label: 'فرعي' }"), 'user-path فرعي missing');

console.log('PASS my-branch isolation + sidebar فرعي vs header الفروع');
console.log(`  A=${sa} B=${eg}`);
