/**
 * k6 load test — register → login → me → logout-ish (token drop)
 *
 * Usage:
 *   k6 run -e BASE=http://127.0.0.1:8795 -e VUS=50 -e DURATION=60s scripts/k6-customer-auth.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://127.0.0.1:8795';
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '60s';

const errRate = new Rate('auth_errors');
const regTrend = new Trend('register_ms');
const loginTrend = new Trend('login_ms');
const meTrend = new Trend('me_ms');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    auth_errors: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
    register_ms: ['p(95)<5000'],
    login_ms: ['p(95)<3000'],
  },
};

function uid() {
  return `${__VU}_${__ITER}_${Date.now().toString(36)}`;
}

export default function () {
  const id = uid();
  const email = `k6_${id}@scale-test.naiosh.local`;
  const password = `K6pw${__VU}${__ITER}x!`;
  const phone = `057${String(10000000 + ((__VU * 100000 + __ITER) % 89999999)).padStart(8, '0')}`;

  const regPayload = JSON.stringify({
    fullName: `K6 User ${__VU}`,
    email,
    phone,
    password,
    confirmPassword: password,
    termsAccepted: true,
  });

  const reg = http.post(`${BASE}/api/auth/register`, regPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  regTrend.add(reg.timings.duration);
  const regOk = check(reg, {
    'register 2xx': (r) => r.status >= 200 && r.status < 300,
    'register ok': (r) => {
      try {
        return !!r.json('ok');
      } catch {
        return false;
      }
    },
  });
  errRate.add(!regOk);

  const login = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  loginTrend.add(login.timings.duration);
  let token = '';
  const loginOk = check(login, {
    'login 200': (r) => r.status === 200,
    'login token': (r) => {
      try {
        token = r.json('token') || '';
        return !!token;
      } catch {
        return false;
      }
    },
  });
  errRate.add(!loginOk);

  if (token) {
    const me = http.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    meTrend.add(me.timings.duration);
    const meOk = check(me, { 'me ok': (r) => r.status === 200 });
    errRate.add(!meOk);
  }

  sleep(0.2);
}
