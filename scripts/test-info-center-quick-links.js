#!/usr/bin/env node
/**
 * Info-center quick links must appear near the top (after hero), not only at the bottom.
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "info-center.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/hub-knowledge-center.css"), "utf8");

const heroEnd = html.indexOf("</section>", html.indexOf('class="kol-hero"'));
assert(heroEnd > 0, "hero section missing");

const quick = html.indexOf('class="kol-quick-links"');
assert(quick > heroEnd, "quick links must follow hero");

const knowledgePanel = html.indexOf('data-kol-panel="knowledge"');
assert(knowledgePanel > quick, "quick links must appear before knowledge panel");

[
  "engine-specs.html",
  "policies.html",
  "ops-manuals.html",
  "review-methodology.html",
  "hub-checklist.html",
  "directives.html",
  "job-roles.html",
].forEach((href) => {
  assert(html.includes(`href="${href}"`), `missing link ${href}`);
});

assert(!/kol-page[\s\S]*<p style="margin:18px 0 0;text-align:center/.test(html), "bottom inline link row should be removed");
assert(css.includes(".kol-quick-links"), "kol-quick-links styles present");

console.log("PASS info-center quick links are at the top");
