-- Seed baseline rows for Naiosh Hub (idempotent)
-- Branches synced from NaioshERP public.branches (excl. test + empty)

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
  ('HQ', 'المقر الرئيسي', 'Head Office', 1, 'active'),
  ('IQ', 'العراق', 'Iraq', 1, 'active'),
  ('EG', 'مصر', 'Egypt', 1, 'active'),
  ('JO', 'الأردن', 'Jordan', 1, 'active'),
  ('SA', 'السعودية', 'Saudi Arabia', 1, 'active'),
  ('GB', 'إنجلترا', 'England', 1, 'active'),
  ('DZ', 'الجزائر', 'Algeria', 1, 'active'),
  ('SE', 'السويد', 'Sweden', 1, 'active'),
  ('MY', 'ماليزيا', 'Malaysia', 1, 'active'),
  ('QA', 'قطر', 'Qatar', 1, 'active'),
  ('TN', 'تونس', 'Tunisia', 1, 'active'),
  ('MA', 'المغرب', 'Morocco', 1, 'active'),
  ('LY', 'ليبيا', 'Libya', 1, 'active'),
  ('BH', 'البحرين', 'Bahrain', 1, 'active'),
  ('YE', 'اليمن', 'Yemen', 1, 'active'),
  ('SD', 'السودان', 'Sudan', 1, 'active'),
  ('PS', 'فلسطين', 'Palestine', 1, 'active'),
  ('TR', 'تركيا', 'Turkey', 1, 'active'),
  ('OM', 'عُمان', 'Oman', 1, 'active'),
  ('DE', 'ألمانيا', 'Germany', 1, 'active'),
  ('KW', 'الكويت', 'Kuwait', 1, 'active'),
  ('SY', 'سوريا', 'Syria', 1, 'active'),
  ('AE', 'الإمارات', 'Emirates', 1, 'active'),
  ('US', 'أمريكا', 'America', 1, 'active'),
  ('CA', 'كندا', 'Canada', 1, 'active'),
  ('LB', 'لبنان', 'Lebanon', 1, 'active')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  branches_count = EXCLUDED.branches_count,
  status = EXCLUDED.status;

INSERT INTO hub_branches (code, name_ar, name_en, country_code, branch_type, hours, status)
VALUES
  ('HQ', 'المقر الرئيسي', 'Head Office', 'HQ', 'المقر الرئيسي', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('IQ', 'العراق', 'Iraq', 'IQ', 'حاضنة أعمال', 'من 8:30 صباحًا إلى 5:30 مساءً', 'active'),
  ('EG', 'مصر', 'Egypt', 'EG', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('JO', 'الأردن', 'Jordan', 'JO', 'مكاتب خاصة', 'من 8:00 صباحًا إلى 5:00 مساءً', 'active'),
  ('SA', 'السعودية', 'Saudi Arabia', 'SA', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('GB', 'إنجلترا', 'England', 'GB', 'مسرعة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('DZ', 'الجزائر', 'Algeria', 'DZ', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('SE', 'السويد', 'Sweden', 'SE', 'حاضنة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('MY', 'ماليزيا', 'Malaysia', 'MY', 'مسرعة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('QA', 'قطر', 'Qatar', 'QA', 'مكاتب خاصة', 'من 10:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('TN', 'تونس', 'Tunisia', 'TN', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('MA', 'المغرب', 'Morocco', 'MA', 'حاضنة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('LY', 'ليبيا', 'Libya', 'LY', 'مكاتب خاصة', 'من 8:30 صباحًا إلى 5:30 مساءً', 'active'),
  ('BH', 'البحرين', 'Bahrain', 'BH', 'مكاتب خاصة', 'من 10:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('YE', 'اليمن', 'Yemen', 'YE', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('SD', 'السودان', 'Sudan', 'SD', 'حاضنة أعمال', 'من 8:30 صباحًا إلى 5:30 مساءً', 'active'),
  ('PS', 'فلسطين', 'Palestine', 'PS', 'مكاتب خاصة', 'من 8:00 صباحًا إلى 5:00 مساءً', 'active'),
  ('TR', 'تركيا', 'Turkey', 'TR', 'حاضنة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('OM', 'عُمان', 'Oman', 'OM', 'مكاتب خاصة', 'من 10:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('DE', 'ألمانيا', 'Germany', 'DE', 'مسرعة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('KW', 'الكويت', 'Kuwait', 'KW', 'مكاتب خاصة', 'من 10:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('SY', 'سوريا', 'Syria', 'SY', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('AE', 'الإمارات', 'Emirates', 'AE', 'مسرعة أعمال', 'من 10:00 صباحًا إلى 7:00 مساءً', 'active'),
  ('US', 'أمريكا', 'America', 'US', 'مسرعة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('CA', 'كندا', 'Canada', 'CA', 'حاضنة أعمال', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active'),
  ('LB', 'لبنان', 'Lebanon', 'LB', 'مكاتب خاصة', 'من 9:00 صباحًا إلى 6:00 مساءً', 'active')
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  country_code = EXCLUDED.country_code,
  branch_type = EXCLUDED.branch_type,
  hours = EXCLUDED.hours,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO hub_feed (feed_type, text_ar)
SELECT 'architecture', 'تم تجهيز جداول Postgres لهوب على Railway'
WHERE NOT EXISTS (
  SELECT 1 FROM hub_feed WHERE text_ar = 'تم تجهيز جداول Postgres لهوب على Railway'
);
