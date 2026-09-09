# POSHA Company OS — Final Delivery

## A. SYSTEM MAP

```
NAIOSH HUB 360
├── Identity / Auth / SSO tokens (hub360.*)
├── Systems Registry / Imperial Dashboard
├── Permissions (hub-session lanes + permission keys)
│
├── POSHA (Company Operating System) — posha.html + /api/admin/posha/*
│   ├── Command Center
│   ├── CRM / العملاء + Customer 360 (dashboard عملاء بوشا)
│   ├── Store / Catalog (PRODUCT · SERVICE · SYSTEM · BUNDLE)
│   ├── Orders → Payments → Invoices → Subscriptions → Activation
│   ├── Support + Unified Inbox
│   ├── Service Requests + Complaints
│   ├── Tasks + SLA sweep
│   ├── Issues + Events + Notifications
│   ├── Reports + Global Search
│   └── Onboarding / Lifecycle / Health
│
└── Client Portal — client.html + /api/client/*
    (own data only; not admin dashboard)
```

## B. IMPLEMENTED MODULES

| Module | Status |
|--------|--------|
| Auth / RBAC / Permissions | WORKING |
| HUB vs POSHA separation | WORKING |
| Client Portal | WORKING |
| Client Home | WORKING |
| CRM + Customer 360 | WORKING |
| Customer Timeline | WORKING |
| Store / Catalog | WORKING (BUNDLE added) |
| Orders / Payments / Invoices | WORKING (wallet gateway) |
| Subscriptions + Activation | WORKING |
| Support chat two-way | WORKING |
| Unified Inbox | WORKING |
| Service Requests | WORKING |
| Complaints | WORKING |
| Wallet ledger | WORKING |
| Tasks assign/complete | WORKING |
| Onboarding checklist | WORKING |
| Lifecycle + Health | WORKING (computed + persisted on mutations) |
| Notification Engine | WORKING |
| Event Engine | WORKING |
| Issues Center | WORKING |
| Subscription expiry scheduler | WORKING |
| SLA sweep (urgent tickets) | WORKING |
| Reports (real aggregates) | WORKING |
| Global Search | WORKING |
| Command Center | WORKING |
| Internal Notes | WORKING |
| Contracts | NOT_IMPLEMENTED |
| HR / Employees / Teams | NOT_IMPLEMENTED |
| Projects | NOT_IMPLEMENTED |
| Automation Rules UI | MOCK / hardcoded hooks |
| Status Incident public page | NOT_IMPLEMENTED |
| Dedicated Audit UI | PARTIAL |
| WebSocket | NOT_IMPLEMENTED (polling) |

## C. CODE CHANGES (this iteration)

**Modified:** `lib/hub-posha-os.js`, `lib/hub-posha-ops.js`, `lib/hub-client-portal.js`, `js/hub-posha-os.js`, `js/hub-client-portal.js`, `server.js`, `docs/posha-company-os-qa.md`  
**Created:** `docs/posha-system-delivery.md`

## D. DATABASE

JSON single source: `data/client-portal.json` (gitignored runtime). Extended entities in-place: `inbox`, `tasks`, `catalog`, `onboarding`, subscription `EXPIRING`/`EXPIRED`, complaints, serviceRequests. No SQL migration required.

## E. APIs (new / extended)

| Endpoint | Method | Permission | Purpose |
|----------|--------|------------|---------|
| `/api/admin/posha/os/complaints/:id/status` | POST | staff + edit | Resolve complaints |
| `/api/admin/posha/os/tasks/:id/assign` | POST | staff | Assign task |
| `/api/admin/posha/os/tasks/:id/status` | POST | staff | Complete task |
| `/api/admin/posha/os/inbox/:id/status` | POST | staff | Resolve inbox item |
| `/api/admin/posha/os/search` | GET | staff | Global search |
| `/api/admin/posha/os/reports` | GET | staff | Real reports |
| `/api/admin/posha/os/sweep` | POST | staff | Run expiry+SLA |
| `/api/client/subscriptions/renew` | POST | client | Renew via wallet |
| `/api/admin/clients/:email/status` | POST | staff | Approve/suspend (+ CLIENT_APPROVED) |

## F. EVENTS (added)

CLIENT_APPROVED, SUBSCRIPTION_EXPIRED, COMPLAINT_STATUS_CHANGED, TASK_ASSIGNED, TASK_COMPLETED, TASK_OVERDUE, SLA_BREACHED, ONBOARDING_UPDATED — wired through EVENT_POLICY → activity / notifications / issues.

## G. PERMISSIONS

SUPER_ADMIN (supreme_leader): full. ADMIN staff: permission keys (`clients.view`, `clients.edit`, `clients.suspend`, `support.reply`, `orders.update`, …). CLIENT: `/api/client/*` only; ownership from token.

## H. TEST RESULTS

See `docs/posha-company-os-qa.md` — Journeys A–E **PASS** (24/24 automated API checks in this run).

## I. REMAINING ISSUES

1. No Contracts/HR/Projects product modules yet (deferred intentionally).
2. Payments are wallet-ledger only (no card gateway / secrets by design).
3. Automation is scheduler + code hooks, not a visual rules builder.
4. Real-time is polling, not WebSocket/SSE.
5. Existing runtime `client-portal.json` may need seed refresh for BUNDLE if an old catalog array was cached (ensureOsArrays merges missing SKUs).
