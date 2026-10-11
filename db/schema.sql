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
  username TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  platform TEXT NOT NULL DEFAULT 'naiosh-hub-360',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  customer_id TEXT,
  customer_uid TEXT,
  status TEXT DEFAULT 'active',
  password_epoch INT DEFAULT 0,
  governorate TEXT,
  city TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_users_role_email_idx ON hub_users (role, email);
CREATE INDEX IF NOT EXISTS hub_users_customer_id_idx ON hub_users (customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS hub_users_username_uidx
  ON hub_users (username)
  WHERE username IS NOT NULL AND length(trim(username)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS hub_users_phone_uidx
  ON hub_users (phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

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
  brand TEXT,
  item_kind TEXT NOT NULL DEFAULT 'منتج',
  sku TEXT,
  marketplaces JSONB NOT NULL DEFAULT '[]'::jsonb,
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

CREATE TABLE IF NOT EXISTS hub_orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  product_id TEXT,
  product_name TEXT,
  qty INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_mode TEXT,
  order_status TEXT NOT NULL DEFAULT 'received',
  invoice_number TEXT,
  source TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_orders_email_idx ON hub_orders (lower(customer_email));
CREATE INDEX IF NOT EXISTS hub_orders_number_idx ON hub_orders (number);

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

CREATE TABLE IF NOT EXISTS hub_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_name TEXT,
  title TEXT NOT NULL,
  body TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'system',
  link TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_system_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  health INT NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'online',
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

CREATE TABLE IF NOT EXISTS hub_ad_submissions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  ad_id TEXT NOT NULL,
  ad_code TEXT,
  owner_type TEXT NOT NULL DEFAULT 'Guest',
  customer_id TEXT,
  guest_contact_id TEXT,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_company TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  source TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_ad_submissions_email_idx ON hub_ad_submissions (lower(owner_email));
CREATE INDEX IF NOT EXISTS hub_ad_submissions_request_idx ON hub_ad_submissions (request_id);
CREATE INDEX IF NOT EXISTS hub_ad_submissions_customer_idx ON hub_ad_submissions (customer_id);

CREATE TABLE IF NOT EXISTS hub_product_submissions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'Guest',
  customer_id TEXT,
  guest_contact_id TEXT,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_company TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  source TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_product_submissions_email_idx ON hub_product_submissions (lower(owner_email));
CREATE INDEX IF NOT EXISTS hub_product_submissions_request_idx ON hub_product_submissions (request_id);
CREATE INDEX IF NOT EXISTS hub_product_submissions_product_idx ON hub_product_submissions (product_id);
CREATE INDEX IF NOT EXISTS hub_product_submissions_customer_idx ON hub_product_submissions (customer_id);
CREATE INDEX IF NOT EXISTS idx_hub_events_date ON hub_events(event_date);
CREATE INDEX IF NOT EXISTS idx_hub_employees_status ON hub_employees(status);
CREATE INDEX IF NOT EXISTS idx_hub_feed_created ON hub_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_wallet_ledger_created ON hub_wallet_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_notifications_created ON hub_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_system_sync_code ON hub_system_sync(code, created_at DESC);

CREATE TABLE IF NOT EXISTS hub_product_categories (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'fa-tag',
  status TEXT NOT NULL DEFAULT 'active',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_product_categories_status ON hub_product_categories(status);

CREATE TABLE IF NOT EXISTS hub_marketing_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_marketing_campaigns_status ON hub_marketing_campaigns(status);

CREATE TABLE IF NOT EXISTS hub_event_records (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hub_article_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_article_records_status ON hub_article_records(status);

-- Unified Profile 360 (identity + personas; auth remains in existing stores)
CREATE TABLE IF NOT EXISTS hub_profiles (
  profile_id TEXT PRIMARY KEY,
  account_no TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  department TEXT,
  org_name TEXT,
  title TEXT,
  active_persona TEXT,
  public_opt_in JSONB NOT NULL DEFAULT '{}'::jsonb,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_profiles_email ON hub_profiles(email);
CREATE INDEX IF NOT EXISTS idx_hub_profiles_account_no ON hub_profiles(account_no);

CREATE TABLE IF NOT EXISTS hub_profile_personas (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES hub_profiles(profile_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  persona_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_by TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, persona_type)
);
CREATE INDEX IF NOT EXISTS idx_hub_profile_personas_email ON hub_profile_personas(email);
CREATE INDEX IF NOT EXISTS idx_hub_profile_personas_type ON hub_profile_personas(persona_type);

CREATE TABLE IF NOT EXISTS hub_profile_audit (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  by_email TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_profile_audit_email ON hub_profile_audit(email);

-- Durable avatar blobs (survive ephemeral container disk / redeploys)
CREATE TABLE IF NOT EXISTS hub_profile_avatars (
  email TEXT PRIMARY KEY,
  account_no TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_profile_avatars_account_no ON hub_profile_avatars(account_no);

-- Durable upload blobs for client attachments / private files (survive ephemeral disk)
CREATE TABLE IF NOT EXISTS hub_upload_blobs (
  storage_ref TEXT PRIMARY KEY,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  original_name TEXT,
  owner_email TEXT,
  bytes BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_upload_blobs_owner ON hub_upload_blobs(owner_email);

-- Idempotent column upgrades for store marketplace linking
ALTER TABLE hub_store_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE hub_store_items ADD COLUMN IF NOT EXISTS item_kind TEXT DEFAULT 'منتج';
ALTER TABLE hub_store_items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE hub_store_items ADD COLUMN IF NOT EXISTS marketplaces JSONB DEFAULT '[]'::jsonb;

-- ─── Normalized customer center (replaces shared hub_meta JSON blobs as SoT) ───
-- Legacy hub_meta keys (client_portal_v1 / profiles-360 / client_attachments_v1)
-- are retained as rollback mirrors until migration is verified.

CREATE TABLE IF NOT EXISTS hub_client_accounts (
  email TEXT PRIMARY KEY,
  customer_id TEXT,
  client_id TEXT NOT NULL,
  account_no TEXT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  lifecycle TEXT NOT NULL DEFAULT 'ONBOARDING',
  account_level TEXT DEFAULT 'أساسي',
  company TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  client_type TEXT DEFAULT '',
  activity_type TEXT DEFAULT '',
  language TEXT DEFAULT 'ar',
  avatar_url TEXT DEFAULT '',
  naiosh_id TEXT DEFAULT '',
  wallet JSONB NOT NULL DEFAULT '{"paid":0,"free":0,"total":0,"ledger":[]}'::jsonb,
  onboarding JSONB NOT NULL DEFAULT '{}'::jsonb,
  systems JSONB NOT NULL DEFAULT '[]'::jsonb,
  notifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  activity JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_via TEXT DEFAULT '',
  created_by_email TEXT DEFAULT '',
  created_by_employee_id TEXT DEFAULT '',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_client_accounts_client_id_uidx ON hub_client_accounts (client_id);
CREATE INDEX IF NOT EXISTS hub_client_accounts_customer_id_idx ON hub_client_accounts (customer_id);
CREATE INDEX IF NOT EXISTS hub_client_accounts_status_idx ON hub_client_accounts (status);

CREATE TABLE IF NOT EXISTS hub_client_tickets (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES hub_client_accounts(email) ON DELETE CASCADE,
  customer_id TEXT,
  client_id TEXT,
  number TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'دعم فني',
  department TEXT NOT NULL DEFAULT 'دعم فني',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'OPEN',
  related_system_id TEXT DEFAULT '',
  assigned_admin_id TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, number)
);
CREATE INDEX IF NOT EXISTS hub_client_tickets_email_idx ON hub_client_tickets (email);
CREATE INDEX IF NOT EXISTS hub_client_tickets_status_idx ON hub_client_tickets (status);
CREATE INDEX IF NOT EXISTS hub_client_tickets_number_idx ON hub_client_tickets (number);

CREATE TABLE IF NOT EXISTS hub_client_service_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES hub_client_accounts(email) ON DELETE CASCADE,
  customer_id TEXT,
  client_id TEXT,
  number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'OTHER',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  related_system TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'NEW',
  assigned_to TEXT,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, number)
);
CREATE INDEX IF NOT EXISTS hub_client_service_requests_email_idx ON hub_client_service_requests (email);
CREATE INDEX IF NOT EXISTS hub_client_service_requests_number_idx ON hub_client_service_requests (number);

CREATE TABLE IF NOT EXISTS hub_client_complaints (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES hub_client_accounts(email) ON DELETE CASCADE,
  customer_id TEXT,
  client_id TEXT,
  number TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  related_system TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_to TEXT,
  resolution TEXT DEFAULT '',
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, number)
);
CREATE INDEX IF NOT EXISTS hub_client_complaints_email_idx ON hub_client_complaints (email);
CREATE INDEX IF NOT EXISTS hub_client_complaints_number_idx ON hub_client_complaints (number);

CREATE TABLE IF NOT EXISTS hub_client_attachment_refs (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'file',
  storage_ref TEXT NOT NULL,
  storage_backend TEXT NOT NULL DEFAULT 'db',
  original_file_name TEXT,
  mime_type TEXT,
  file_size INTEGER NOT NULL DEFAULT 0,
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hub_client_attachment_refs_email_idx ON hub_client_attachment_refs (email);
CREATE INDEX IF NOT EXISTS hub_client_attachment_refs_entity_idx ON hub_client_attachment_refs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS hub_client_attachment_refs_storage_idx ON hub_client_attachment_refs (storage_ref);

CREATE TABLE IF NOT EXISTS hub_revoked_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_revoked_tokens_expires_idx ON hub_revoked_tokens (expires_at);

CREATE TABLE IF NOT EXISTS hub_customer_migrate_checkpoints (
  name TEXT PRIMARY KEY,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extra profile columns used by Profile 360 JSON that were not in hub_profiles yet
ALTER TABLE hub_profiles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE hub_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';
ALTER TABLE hub_profiles ADD COLUMN IF NOT EXISTS personas JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE hub_profiles ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb;
