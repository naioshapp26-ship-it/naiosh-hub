/**
 * Job-roles copy control: red background, white text.
 */
const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('/workspace/css/hub-job-roles.css', 'utf8');
const js = fs.readFileSync('/workspace/js/hub-job-roles.js', 'utf8');
const html = fs.readFileSync('/workspace/job-roles.html', 'utf8');

const copyBlock = css.slice(css.indexOf('.jr-copy {'), css.indexOf('.jr-empty'));
assert(copyBlock.includes('background: #dc2626'), 'copy button is not red');
assert(/color:\s*#ffffff/.test(copyBlock), 'copy button text is not white');
assert(!copyBlock.includes('#047857'), 'copy button still uses green');

const toastBlock = css.slice(css.indexOf('.jr-toast {'));
assert(toastBlock.includes('background: #dc2626'), 'copied toast is not red');
assert(/color:\s*#ffffff/.test(toastBlock), 'copied toast text is not white');
assert(!toastBlock.includes('#047857'), 'copied toast still uses green');

assert(js.includes('تم النسخ'), 'copied button label missing');
assert(js.includes('markCopied'), 'copied state helper missing');
assert(html.includes('hub-job-roles.css?v=3'), 'css cache bump missing');
assert(!/#047857|#059669|#064e3b|#d1fae5|#ecfdf5/.test(css), 'job-roles CSS still has green');
assert(css.includes('.jr-hero') && css.includes('#dc2626'), 'hero is not red');
assert(css.includes('.jr-cats button.is-active') && css.includes('color: #ffffff !important'), 'active category is not red/white');

console.log('PASS job-roles copy control is red with white text');
