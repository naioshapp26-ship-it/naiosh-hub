#!/usr/bin/env node
/**
 * Asserts services page links to نايوش solutions + cost reduction pages,
 * and that those pages contain expected Arabic content + transactional catalog.
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
assert(!/ساي\s*فاي/i.test(cost), "cost page must not mention ساي فاي");
assert(!/scifi/i.test(cost), "cost page must not keep scifi ids or copy");
assert(cost.includes("برنامج خفض التكاليف"), "cost page title copy");
assert(cost.includes("لماذا تُعد عملية إدارة المصروفات مهمة؟"), "cost page keeps expense-management FAQ");
assert(cost.includes("ابدأ طلب خفض التكاليف"), "cost page has start assessment CTA");
assert(cost.includes("hub-solutions-data.js"), "cost page loads solutions data");
assert(cost.includes("openWizard"), "cost page wires cost wizard");

const solutions = fs.readFileSync(path.join(root, "naiosh-solutions.html"), "utf8");
assert(solutions.includes("حلول نايوش"), "solutions page title");
assert(solutions.includes("حلول مالية للشركات الاستشارية"), "solutions includes consulting sector");
assert(solutions.includes("حلول مالية لقطاع الضيافة"), "solutions includes hospitality");
assert(solutions.includes("حلول مالية للجهات الحكومية"), "solutions includes government");
assert(solutions.includes("حلول مالية لشركات الاستثمار"), "solutions includes investment");
assert((solutions.match(/hub-feature-card/g) || []).length >= 20, "solutions has 20+ solution cards");
assert(solutions.includes('id="so-app"'), "solutions mounts so-app");
assert(solutions.includes("hub-solutions-ui.js"), "solutions loads UI module");
assert(solutions.includes("طلباتي"), "solutions has my-requests entry");

const css = fs.readFileSync(path.join(root, "css/hub-service-offers.css"), "utf8");
assert(css.includes("repeat(6, minmax(0, 1fr))"), "desktop grid is 6 columns");
assert(css.includes("so-page-wide"), "wide page container class exists");

const data = fs.readFileSync(path.join(root, "js/hub-solutions-data.js"), "utf8");
assert(data.includes("createRequest"), "data module can create requests");
assert(data.includes("SOL-REQ"), "solution request id prefix");
assert(data.includes("'COST'") || data.includes('"COST"'), "cost reduction id prefix");

const ui = fs.readFileSync(path.join(root, "js/hub-solutions-ui.js"), "utf8");
assert(ui.includes("اختيار الحل"), "UI has choose solution CTA");
assert(ui.includes("wiz-submit"), "UI has request submit");
assert(ui.includes("طلباتي"), "UI has my requests view");

// runtime smoke
const vm = require("vm");
const mem = {};
const localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => {
    mem[k] = String(v);
  },
  removeItem: (k) => {
    delete mem[k];
  },
};
const ctx = { console, Date, Math, JSON, String, Number, Array, Object, localStorage, window: {} };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/hub-solutions-data.js"), "utf8"), ctx);
const sols = ctx.HubSolutions.listSolutions();
assert(sols.length >= 20, "runtime seed has 20+ solutions");
const req = ctx.HubSolutions.createRequest(
  {
    solutionId: sols[0].id,
    customer: { name: "أحمد", company: "XYZ", email: "a@x.com", phone: "05", branch: "الرياض" },
    need: "تحسين الإنفاق",
    priority: "مرتفع",
    scopeType: "فرع",
  },
  "أحمد"
);
assert(String(req.id).startsWith("SOL-REQ-"), "creates SOL-REQ id");
assert(req.status === "New", "new request status");
assert(ctx.HubSolutions.listAudit().length >= 1, "audit log written");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll service-offers checks passed.");
