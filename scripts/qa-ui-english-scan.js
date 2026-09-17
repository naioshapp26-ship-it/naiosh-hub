/**
 * QA: اكتشاف عبارات إنجليزية ظاهرة محتملة في واجهة المستخدم
 * يفحص سلاسل العرض داخل اقتباسات فقط ويتجنب الكود البرمجي.
 *
 * node scripts/qa-ui-english-scan.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '_ops-docs', 'assets', 'uploads', 'data', 'scripts']);
const EXT = new Set(['.js', '.html']);

const UI_PHRASES = [
  'Require Admin Approval',
  'Request ID Format',
  'Default Status',
  'Auto Assign',
  'Auto Assignment',
  'Default Department',
  'Loading...',
  'No data found',
  'No Data',
  'Access denied',
  'Something went wrong',
  'Please enter',
  'This field is required',
  'Invalid email',
  'Search...',
  'Save Changes',
  'View All',
  'No Results',
  'Store Status',
  'Transaction ID',
  'Created By',
  'Last Updated',
  'Default Currency',
  'Require Product URL',
  'Enable Shipping',
  'Enable Articles',
  'Enable Advertisements',
  'In-App Notifications',
  'Email Notifications',
  'Session Timeout',
  'Password Policy',
  'Manage Site Settings',
  'View Site Settings',
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

const hits = [];
const files = walk(root);
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel === 'js/hub-i18n.js') continue; // dictionary keys
  const text = fs.readFileSync(file, 'utf8');
  for (const phrase of UI_PHRASES) {
    // match as quoted UI string or HTML text node-ish
    const patterns = [
      new RegExp(`['"\`]${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g'),
      new RegExp(`>(\\s*)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*)<`, 'g'),
      new RegExp(`<span[^>]*>${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`, 'g'),
      new RegExp(`<th[^>]*>${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`, 'g'),
      new RegExp(`<b[^>]*>${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:?<`, 'g'),
      new RegExp(`placeholder=["']${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text))) {
        hits.push({ file: rel, phrase, at: m.index });
      }
    }
  }
}

const byFile = {};
hits.forEach((h) => {
  byFile[h.file] = byFile[h.file] || [];
  if (!byFile[h.file].includes(h.phrase)) byFile[h.file].push(h.phrase);
});

const report = {
  scannedFiles: files.length,
  hits: hits.length,
  filesWithHits: Object.keys(byFile).length,
  byFile,
};

fs.writeFileSync(path.join(root, 'scripts', 'qa-ui-english-scan-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(hits.length ? 1 : 0);
