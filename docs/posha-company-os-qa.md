# POSHA Company OS — QA Test Matrix

| Test ID | Module | Role | Preconditions | Steps | Expected API | Expected DB | Expected Event | Security | Actual | PASS/FAIL |
|---------|--------|------|---------------|-------|--------------|-------------|----------------|----------|--------|-----------|
| POSHA-B1 | Store→Order→Pay→Activate | CLIENT | Demo client wallet ≥ price | Checkout CRM with `payWithWallet:true` | 201 `/api/client/checkout` order COMPLETED, invoice paid | Order+Invoice+Subscription+System | ORDER_CREATED, PAYMENT_SUCCEEDED, SYSTEM_ASSIGNED/ACTIVATED, SUBSCRIPTION_CREATED, ORDER_COMPLETED | Ownership from session | CRM activated | PASS |
| POSHA-B2 | Invoice pay later | CLIENT | Unpaid invoice linked to order | Checkout without wallet then `/api/client/invoices/pay` | 200 invoice paid + fulfill | Wallet debit ledger + order COMPLETED | PAYMENT_SUCCEEDED, WALLET_DEBITED | Session email only | Kit order paid | PASS |
| POSHA-E1 | Payment failure | CLIENT | Insufficient wallet | Checkout ERP qty=5 with wallet | payment.ok=false, order not COMPLETED | Issue PAYMENT_FAILED | PAYMENT_FAILED | No false activation | No system activate | PASS |
| POSHA-C1 | Support two-way | CLIENT+ADMIN | Logged in | Create ticket → admin reply | Client notifications show reply | Ticket messages persisted | TICKET_CREATED, TICKET_MESSAGE_CREATED | Client cannot hit admin OS | Reply visible | PASS |
| POSHA-R1 | Service request | CLIENT | Logged in | POST `/api/client/requests` | 201 request NEW | Client.serviceRequests + inbox + task | REQUEST_CREATED | Staff sees inbox | Inbox shows REQ | PASS |
| POSHA-R2 | Complaint | CLIENT | Logged in | POST `/api/client/complaints` | 201 | complaints + inbox | COMPLAINT_CREATED | — | Created | PASS |
| POSHA-S1 | Admin OS gate | CLIENT | Client token | GET `/api/admin/posha/os/command` | 403 | unchanged | — | DENIED | 403 | PASS |
| POSHA-OS1 | Command center | SUPER_ADMIN | Staff token | GET `/api/admin/posha/os/command` | 200 pending/inbox/issues | — | — | Staff only | OK | PASS |
| POSHA-OS2 | Inbox assign | ADMIN | Inbox item | POST inbox/:id/assign | 200 ASSIGNED | inbox.assigned_to | — | clients.view | OK | PASS |
| POSHA-UI1 | posha.html | STAFF | — | Open `/posha.html` | 200 HTML | — | — | Staff gate script | 200 | PASS |

## Journeys (summary)

- **A** Register→Approve→Portal: PARTIAL (existing auth/portal; approval path pre-existing)
- **B** Store buy system → activation: **PASS**
- **C** Support ticket ↔ admin: **PASS**
- **D** Subscription expiring scheduler: NOT_IMPLEMENTED (events policy ready; no cron yet)
- **E** Payment failure no activation: **PASS**
