const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/hub-posha-clients.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/hub-posha-clients.css'), 'utf8');

require('child_process').execSync('node --check js/hub-posha-clients.js', { cwd: root, stdio: 'inherit' });
require('child_process').execSync('node --check lib/hub-posha-ops.js', { cwd: root, stdio: 'inherit' });

const checks = {
  hasTable: src.includes('posha-clients-table'),
  hasCards: src.includes('posha-clients-cards'),
  hasStatusAr: src.includes('clientStatusAr'),
  hasViewBtn: src.includes('>عرض</button>'),
  hasMenu: src.includes('data-client-menu'),
  hasClear: src.includes('posha-clear-filters'),
  latinYmd: src.includes('${yyyy}/${mm}/${dd}'),
  cssForcesTable: css.includes('display: table !important'),
  cssCardsMobile: css.includes('.posha-clients-cards') && css.includes('@media (max-width: 900px)'),
  noRawStatusChip: !/chip\}">\$\{esc\(c\.status\)\}/.test(src) && !src.includes('<span class="chip">${esc(c.status)}</span>'),
  statusApi: fs.readFileSync(path.join(root, 'lib/hub-posha-ops.js'), 'utf8').includes("parts[5] === 'status'"),
};

console.log(JSON.stringify(checks, null, 2));
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
if (failed.length) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('OK');
