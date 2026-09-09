# POSHA Company OS — QA Test Matrix

| Test ID | Module | Role | Preconditions | Steps | Expected API | Expected DB | Expected Event | Security | Actual | PASS/FAIL |
|---------|--------|------|---------------|-------|--------------|-------------|----------------|----------|--------|-----------|
| POSHA-A1 | Register→Pending | CLIENT | New email | POST `/api/auth/register` then GET `/api/client/home` | 201 + home.status=pending | client.status=pending + inbox REGISTRATION | CLIENT_REGISTERED | — | pending | PASS |
| POSHA-A2 | Pending blocks commerce | CLIENT | Pending account | POST `/api/client/checkout` | 403 | unchanged | — | Transaction blocked | 403 | PASS |
| POSHA-A3 | Admin approve | SUPER_ADMIN | Pending client | POST `/api/admin/clients/:email/status` `{status:active}` | 200 active | status=active + welcome credit | CLIENT_APPROVED, WALLET_CREDITED | clients.edit/suspend | active | PASS |
| POSHA-B1 | Store→Order→Pay→Activate | CLIENT | Wallet ≥ price | Checkout SYSTEM with `payWithWallet:true` | 201 order COMPLETED | Order+Invoice+Subscription+System | ORDER_CREATED, PAYMENT_SUCCEEDED, SYSTEM_ASSIGNED, SUBSCRIPTION_CREATED, ORDER_COMPLETED | Session ownership | COMPLETED | PASS |
| POSHA-B2 | Invoice pay later | CLIENT | Unpaid invoice | Checkout without wallet then `/api/client/invoices/pay` | 200 paid + fulfill | Ledger debit + COMPLETED | PAYMENT_SUCCEEDED | Session email | PASS (prior) |
| POSHA-C1 | Support two-way | CLIENT+ADMIN | Logged in | Create ticket → admin reply | Client sees reply notif | Messages persisted | TICKET_CREATED, TICKET_MESSAGE_CREATED | Client cannot hit admin OS | PASS |
| POSHA-D1 | Subscription expiring sweep | SYSTEM | Sub renewsAt within 14d | POST `/api/admin/posha/os/sweep` (or hourly scheduler) | 200 changed≥1 | sub.status=EXPIRING + expiryNotifiedAt | SUBSCRIPTION_EXPIRING + Issue | Staff only | PASS |
| POSHA-D2 | Renew subscription | CLIENT | EXPIRING sub + wallet | POST `/api/client/subscriptions/renew` | 200 ok | renewsAt+365d, status=active | SUBSCRIPTION_RENEWED, INVOICE, PAYMENT | Ownership | PASS |
| POSHA-E1 | Payment failure | CLIENT | Insufficient wallet | Checkout expensive with wallet | payment.ok=false, not COMPLETED | Issue PAYMENT_FAILED | PAYMENT_FAILED | No false activation | PASS |
| POSHA-R1 | Service request | CLIENT | Active | POST `/api/client/requests` | 201 | request+inbox+task | REQUEST_CREATED | Staff sees inbox | PASS |
| POSHA-R2 | Complaint create+resolve | CLIENT+ADMIN | Active | POST complaint → admin status RESOLVED | 201 then 200 | complaint RESOLVED | COMPLAINT_CREATED, COMPLAINT_STATUS_CHANGED | — | PASS |
| POSHA-T1 | Task assign/done | ADMIN | Task exists | POST tasks/:id/assign + status DONE | 200 | assigned_to + DONE | TASK_ASSIGNED, TASK_COMPLETED | Staff | PASS |
| POSHA-S1 | Admin OS gate | CLIENT | Client token | GET `/api/admin/posha/os/command` | 403 | unchanged | — | DENIED | PASS |
| POSHA-OS1 | Command center | SUPER_ADMIN | Staff | GET `/api/admin/posha/os/command` | 200 | — | — | Staff | PASS |
| POSHA-OS2 | Reports real data | SUPER_ADMIN | Staff | GET `/api/admin/posha/os/reports` | 200 reports.clients | — | — | Staff | PASS |
| POSHA-OS3 | Global search | SUPER_ADMIN | Staff | GET `/api/admin/posha/os/search?q=email` | 200 results.clients | — | — | Staff | PASS |
| POSHA-OS4 | Catalog BUNDLE | SUPER_ADMIN | Staff | GET catalog | BUNDLE item present | — | — | Staff | PASS |
| POSHA-UI1 | posha.html | STAFF | — | Open `/posha.html` | 200 | — | — | Staff gate | PASS (prior) |

## Journeys (summary)

- **A** Register→Approve→Portal: **PASS**
- **B** Store buy system → activation: **PASS**
- **C** Support ticket ↔ admin: **PASS**
- **D** Subscription expiring → notify → renew: **PASS**
- **E** Payment failure no activation: **PASS**

## Security spot checks

| Check | Result |
|-------|--------|
| Client → `/api/admin/posha/os/*` | DENIED 403 |
| Pending client → checkout | DENIED 403 |
| Client APIs bind to session email (no body client_id trust) | WORKING |

## Remaining (not blocking journeys A–E)

- Contracts / HR / Projects modules: NOT_IMPLEMENTED (architecture deferred)
- Full Automation Rules UI: MOCK (hardcoded hooks + schedulers)
- Public Status/Incident page: PARTIAL (Issues only)
- WebSocket real-time: PARTIAL (polling)
- Dedicated immutable Audit Log UI: PARTIAL (activity feed)
