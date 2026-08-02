-- Seed baseline rows for Naiosh Hub (idempotent)

INSERT INTO hub_meta (key, value)
VALUES
  ('app', '{"name":"naiosh-hub","version":"1.0.0","blueprint":"empire-v1"}'::jsonb),
  ('phase', '{"current":1,"label":"التأسيس"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO hub_users (email, password_hash, name_ar, role)
VALUES
  ('leader@naiosh.com', crypt('Hub@360', gen_salt('bf')), 'القائد الأعلى', 'supreme_leader'),
  ('malika@naiosh.com', crypt('Hub@360', gen_salt('bf')), 'المهندسة مليكة', 'chief_engineer')
ON CONFLICT (email) DO NOTHING;

INSERT INTO hub_countries (code, name_ar, name_en, branches_count, status)
VALUES
  ('EG', 'مصر', 'Egypt', 1, 'active'),
  ('IQ', 'العراق', 'Iraq', 1, 'active'),
  ('SA', 'السعودية', 'Saudi Arabia', 1, 'active'),
  ('AE', 'الإمارات', 'UAE', 1, 'active'),
  ('TR', 'تركيا', 'Turkey', 1, 'active'),
  ('JO', 'الأردن', 'Jordan', 1, 'active')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  branches_count = EXCLUDED.branches_count,
  status = EXCLUDED.status;

INSERT INTO hub_branches (code, name_ar, name_en, country_code, branch_type, hours, status)
VALUES
  ('EG', 'مصر', 'Egypt', 'EG', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('IQ', 'العراق', 'Iraq', 'IQ', 'حاضنة أعمال', 'من 8:30 صباحًا إلى 5:30 مساءً', 'active'),
  ('SA', 'السعودية', 'Saudi Arabia', 'SA', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('AE', 'الإمارات', 'UAE', 'AE', 'مسرعة أعمال', 'من 10:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('TR', 'تركيا', 'Turkey', 'TR', 'حاضنة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('JO', 'الأردن', 'Jordan', 'JO', 'مكاتب خاصة', 'من 8:00 صباحًا إلى 5:00 مساءً', 'active')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  branch_type = EXCLUDED.branch_type,
  hours = EXCLUDED.hours,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO hub_feed (feed_type, text_ar)
SELECT 'architecture', 'تم تجهيز جداول Postgres لهوب على Railway'
WHERE NOT EXISTS (
  SELECT 1 FROM hub_feed WHERE text_ar = 'تم تجهيز جداول Postgres لهوب على Railway'
);
