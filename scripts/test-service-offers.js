#!/usr/bin/env node
/**
 * Asserts services page links to نايوش solutions + cost reduction pages,
 * and that those pages contain expected Arabic content.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

const services = fs.readFileSync(path.join(root, "services.html"), "utf8");
assert(services.includes('href="naiosh-solutions.html"'), "services links to naiosh-solutions.html");
assert(services.includes('href="cost-reduction.html"'), "services links to cost-reduction.html");
assert(services.includes("حلول نايوش"), "services shows حلول نايوش");
assert(services.includes("برنامج خفض التكاليف"), "services shows برنامج خفض التكاليف");
assert(services.includes("hub-service-offers.css"), "services loads hub-service-offers.css");
assert(services.includes("so-entry-btn"), "services has entry buttons");

const cost = fs.readFileSync(path.join(root, "cost-reduction.html"), "utf8");
assert(cost.includes("ما هي منصة ساي فاي؟"), "cost page has ساي فاي intro");
assert(cost.includes("كيف تعمل بطاقات ساي فاي؟"), "cost page has cards FAQ");
assert(cost.includes("كيف تساعد منصة ساي فاي في إدارة الميزانية؟"), "cost page has budget FAQ");
assert(cost.includes("كيف يُساعِد ساي فاي في إعداد الميزانية؟"), "cost page has budget setup FAQ");
assert(cost.includes("برنامج خفض التكاليف"), "cost page title copy");

const solutions = fs.readFileSync(path.join(root, "naiosh-solutions.html"), "utf8");
assert(solutions.includes("حلول نايوش"), "solutions page title");
assert(solutions.includes("حلول مالية للشركات الاستشارية"), "solutions includes consulting sector");
assert(solutions.includes("حلول مالية لقطاع الضيافة"), "solutions includes hospitality");
assert(solutions.includes("حلول مالية للجهات الحكومية"), "solutions includes government");
assert(solutions.includes("حلول مالية لشركات الاستثمار"), "solutions includes investment");
assert((solutions.match(/hub-feature-card/g) || []).length >= 20, "solutions has 20+ solution cards");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll service-offers checks passed.");
