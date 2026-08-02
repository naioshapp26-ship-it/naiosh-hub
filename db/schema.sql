-- Naiosh Hub 360 — Postgres schema (Railway)
-- Idempotent: safe to re-run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  platform TEXT NOT NULL DEFAULT 'naiosh-hub-360',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  branches_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  country_code TEXT REFERENCES hub_countries(code) ON UPDATE CASCADE,
  branch_type TEXT NOT NULL DEFAULT 'مكاتب خاصة',
  hours TEXT,
  flag_svg TEXT,
  manager TEXT,
  incubators_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  assignee TEXT,
  assign_note TEXT,
  assigned_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_incubators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'عام',
  platforms_count INT NOT NULL DEFAULT 0,
  offices_count INT NOT NULL DEFAULT 0,
  members_count INT NOT NULL DEFAULT 0,
  health INT NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'active',
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  role_ar TEXT,
  icon TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  offices_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'system',
  category TEXT,
  url TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  health INT NOT NULL DEFAULT 90,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  brand TEXT,
  platform TEXT,
  category TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  sold INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'متوفر',
  movement TEXT DEFAULT 'متوسط',
  icon TEXT,
  assignee TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  category TEXT,
  platform_code TEXT,
  stock INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  badge TEXT,
  assignee TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES hub_store_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  buyer TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'مكتمل',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category TEXT,
  platform_code TEXT,
  product_id TEXT,
  views INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  level TEXT,
  ad_type TEXT,
  assignee TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TEXT,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'قادمة',
  event_type TEXT,
  speaker TEXT,
  duration TEXT,
  department TEXT,
  assignee TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  role_ar TEXT NOT NULL DEFAULT 'تشغيل',
  hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  productivity INT NOT NULL DEFAULT 70,
  score INT NOT NULL DEFAULT 70,
  status TEXT NOT NULL DEFAULT 'active',
  warned BOOLEAN NOT NULL DEFAULT FALSE,
  assignee TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_employee_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  assignee TEXT,
  priority TEXT NOT NULL DEFAULT 'عادي',
  status TEXT NOT NULL DEFAULT 'todo',
  quality INT NOT NULL DEFAULT 0,
  project TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scope TEXT,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_wallet_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  burn_30d NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL,
  party TEXT,
  amount NUMERIC(14, 2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_type TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_env_checks (
  id SERIAL PRIMARY KEY,
  check_name TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_branches_country ON hub_branches(country_code);
CREATE INDEX IF NOT EXISTS idx_hub_products_category ON hub_products(category);
CREATE INDEX IF NOT EXISTS idx_hub_store_items_category ON hub_store_items(category);
CREATE INDEX IF NOT EXISTS idx_hub_ads_status ON hub_ads(status);
CREATE INDEX IF NOT EXISTS idx_hub_events_date ON hub_events(event_date);
CREATE INDEX IF NOT EXISTS idx_hub_employees_status ON hub_employees(status);
CREATE INDEX IF NOT EXISTS idx_hub_feed_created ON hub_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_wallet_ledger_created ON hub_wallet_ledger(created_at DESC);
