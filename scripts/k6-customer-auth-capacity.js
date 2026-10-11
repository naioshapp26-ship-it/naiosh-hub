/**
 * Capacity k6 with explicit targets (do NOT claim PASS if thresholds fail).
 *
 * Targets (isolated single Node process + local Postgres):
 *   - http_req_failed < 1%
 *   - auth_errors < 1%
 *   - register_ms p95 < 2000ms (50 VUs), < 3000ms (100), relaxed for 500/1000
 *   - login_ms p95 < 1500ms (50), < 2500ms (100)
 *
 * Usage:
 *   UV_THREADPOOL_SIZE=32 k6 run -e BASE=http://127.0.0.1:8795 -e VUS=50 -e DURATION=45s \
 *     -e PROFILE=50 scripts/k6-customer-auth-capacity.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://127.0.0.1:8795';
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '45s';
const PROFILE = String(__ENV.PROFILE || VUS);

const errRate = new Rate('auth_errors');
const regTrend = new Trend('register_ms');
const loginTrend = new Trend('login_ms');

function thresholdsFor(profile) {
  const p = String(profile);
  if (p === '50') {
    return {
      auth_errors: ['rate<0.01'],
      http_req_failed: ['rate<0.01'],
      register_ms: ['p(95)<2000'],
      login_ms: ['p(95)<1500'],
    };
  }
  if (p === '100') {
    return {
      auth_errors: ['rate<0.02'],
      http_req_failed: ['rate<0.02'],
      register_ms: ['p(95)<3000'],
      login_ms: ['p(95)<2500'],
    };
  }
  if (p === '500') {
    return {
      auth_errors: ['rate<0.05'],
      http_req_failed: ['rate<0.05'],
      register_ms: ['p(95)<5000'],
      login_ms: ['p(95)<4000'],
    };
  }
  // 1000 — capacity discovery; thresholds document stretch goal
  return {
    auth_errors: ['rate<0.10'],
    http_req_failed: ['rate<0.10'],
    register_ms: ['p(95)<8000'],
    login_ms: ['p(95)<6000'],
  };
}

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: thresholdsFor(PROFILE),
};

function uid() {
  return `${__VU}_${__ITER}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

export default function () {
  const id = uid();
  const email = `k6cap_${id}@scale-test.naiosh.local`;
  const password = `K6cap${__VU}${__ITER}x!`;
  // Globally unique mobile for dense re-runs against a shared test DB
  const phone = `05${String(
    (__VU * 1_000_003 + __ITER * 97 + Date.now() % 1_000_000 + Math.floor(Math.random() * 1e6)) % 10_000_000_000
  ).padStart(10, '0')}`;

  const reg = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({
      fullName: `K6 Cap ${__VU}`,
      email,
      phone,
      password,
      confirmPassword: password,
      termsAccepted: true,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  regTrend.add(reg.timings.duration);
  const regOk = check(reg, {
    'register ok': (r) => {
      try {
        return r.status < 300 && !!r.json('ok');
      } catch {
        return false;
      }
    },
  });
  errRate.add(!regOk);

  const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  loginTrend.add(login.timings.duration);
  const loginOk = check(login, {
    'login ok': (r) => {
      try {
        return r.status === 200 && !!r.json('token');
      } catch {
        return false;
      }
    },
  });
  errRate.add(!loginOk);
  sleep(0.15);
}
