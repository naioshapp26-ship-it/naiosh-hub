# Production Hardening Report — NAIOSH HUB 360

## PRODUCTION READINESS: PASS

Local API E2E (`scripts/e2e-production-hardening.js`): **36 PASS / 0 FAIL**.

### Migration summary

| Question | Answer |
|---|---|
| Fate of `leader@naiosh.com`? | **Migrated** — same Employee identity `EMP-0001` / `supreme_leader`. Public login for `leader@naiosh.com` is **blocked** (legacy/disabled) unless `HUB_ALLOW_LEGACY_DEMO=1`. |
| Migration or new account? | **Migration** of EMP-0001 primary email → `naioshhub@example.com` (hashed credential store). |
| Final primary Employee ID | **EMP-0001** |
| Quick Login in Production UI? | **No** |
| Password visible in Frontend/Source? | **No** (bootstrap via env `HUB_SUPER_ADMIN_INITIAL_PASSWORD` only) |
| Customer → Dashboard? | **No** (403) |
| Normal Admin → self Super Admin? | **No** (403) |
| Normal Admin → modify Super Admin? | **No** (403) |
| Super Admin → Add Admin? | **Yes** |
| Super Admin → assign/revoke permissions? | **Yes** (+ epoch invalidates old sessions) |
| Customer password change? | **Yes** |
| Passwords stored plaintext? | **No** (scrypt hashes in `data/staff-credentials.json` / customer store; gitignored) |

### Check table

| Check | Result | Evidence |
|---|---|---|
| Quick Login removed | PASS | `login.html` has no دخول سريع / cards |
| Demo credentials removed from UI | PASS | `js/login.js` has no `DEMO_USERS` / passwords |
| No hardcoded production password | PASS | `11111111` not in frontend; env bootstrap only |
| naioshhub@example.com login | PASS | 200 + token |
| Employee ID | PASS | EMP-0001 |
| Super Admin role | PASS | supreme_leader |
| Super Admin permissions | PASS | 54 keys incl. `permissions.manage` |
| Super Admin password change | PASS | message: تم تغيير كلمة المرور بنجاح |
| Old password rejected | PASS | 401 |
| Old token revoked | PASS | epoch / 401–403 |
| Customer registration | PASS | 201 + no session token |
| Customer ID | PASS | CL-* |
| Customer password change | PASS | + new token |
| Customer dashboard denied | PASS | 403 on `/api/admin/account` |
| Add Admin | PASS | EMP-0100 (example run) |
| New Admin Employee ID | PASS | EMP-* |
| Assign permissions | PASS | clients.view, orders.view only |
| Unauthorized section denied | PASS | no clients.create in session |
| Unauthorized API denied | PASS | 403 |
| Permission revoke | PASS | old admin token 401 |
| Disable Admin | PASS | login 403 + session 403 |
| Audit log | PASS | ADMIN_CREATED / PERMISSIONS / DISABLED… |
| Forgot password | PASS | token path; email service may be unconfigured |
| Rate limiting | PASS | HTTP 429 |
| Secure cookies | PASS | HttpOnly + SameSite on `hub_session` |
| Desktop / Mobile login UI | PASS | screenshots under `/opt/cursor/artifacts/screenshots/` |
| Legacy leader login | PASS | blocked |

### Ops notes for launch

1. Set once on the host: `HUB_SUPER_ADMIN_INITIAL_PASSWORD` (owner-chosen). Server hashes it; unset after bootstrap.
2. Keep `HUB_ALLOW_LEGACY_DEMO` unset in production.
3. Prefer SMTP (`HUB_SMTP_URL` / SendGrid) for forgot-password; without it, staging may use `HUB_EXPOSE_RESET_TOKEN=1` only.
4. Owner should change the weak initial password immediately from **حسابي → الأمان وكلمة المرور** (`mustChangePassword=true` after bootstrap).

### Remaining / follow-ups

- Full Chromium regression of historical issues #1–#12 should use `naioshhub@example.com` + env passwords (not Quick Login / `leader@` demo).
- Email delivery for forgot-password depends on SMTP configuration in the deployment environment.
- `data/staff-credentials.json` must remain gitignored and backed up securely.
