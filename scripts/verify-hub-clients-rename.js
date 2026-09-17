const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = [];
function walk(d) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    if (n.name === 'node_modules' || n.name === '_ops-docs' || n.name.startsWith('.')) continue;
    const p = path.join(d, n.name);
    if (n.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(n.name) && !n.name.startsWith('_')) files.push(p);
  }
}
walk(root);
const bad = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  if (t.includes('عملاء بوشا')) bad.push(['عملاء بوشا', path.relative(root, f)]);
  if (t.includes('نظام بوشا OS')) bad.push(['نظام بوشا OS', path.relative(root, f)]);
}
const dash = fs.readFileSync(path.join(root, 'js/dashboard.js'), 'utf8');
const nav = dash.match(/const NAV = \[([\s\S]*?)\];/)[1];
const labels = [...nav.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
console.log('NAV head:', labels.slice(0, 7).join(' | '));
console.log('عملاء هوب:', labels.includes('عملاء هوب'));
console.log('عملاء بوشا in NAV:', labels.includes('عملاء بوشا'));
console.log('نظام بوشا OS in NAV:', labels.includes('نظام بوشا OS'));
console.log('posha-os key:', /key:\s*'posha-os'/.test(dash));
const visible = bad.filter((x) => {
  const f = String(x[1]).replace(/\\/g, '/');
  if (f.startsWith('scripts/_')) return false;
  if (f.includes('e2e-site-settings')) return false;
  if (f.includes('verify-hub-clients-rename')) return false;
  // alias intentionally maps old label → new for legacy records
  if (f === 'js/hub-posha-clients.js' && x[0] === 'عملاء بوشا') {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    return !src.includes("if (s === 'عملاء بوشا'");
  }
  return true;
});
console.log('remaining hits:', visible.length);
visible.forEach((x) => console.log(x.join(' -> ')));
const ws = fs.readFileSync(path.join(root, 'js/hub-clients-workspaces.js'), 'utf8');
console.log('page H1:', /posha-ws-title">عملاء هوب</.test(ws));
if (visible.length) process.exit(1);
console.log('OK');
