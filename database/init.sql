-- AffiliateHunter Database Schema
-- Run: psql $DATABASE_URL < database/init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  url             TEXT NOT NULL,
  network         VARCHAR(100),
  niche           VARCHAR(100),
  commission_type VARCHAR(50),
  commission_rate DECIMAL(10,4),
  commission_flat DECIMAL(10,2),
  cookie_days     INTEGER DEFAULT 30,
  epc             DECIMAL(10,4),
  score           INTEGER DEFAULT 0,
  status          VARCHAR(50) DEFAULT 'discovered',
  join_url        TEXT,
  signup_email    TEXT,
  affiliate_id    TEXT,
  affiliate_link  TEXT,
  notes           TEXT,
  tags            JSONB DEFAULT '[]',
  raw_data        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracking_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id      UUID REFERENCES programs(id) ON DELETE CASCADE,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  label           TEXT,
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(100),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clicks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id     UUID REFERENCES tracking_links(id) ON DELETE SET NULL,
  program_id  UUID REFERENCES programs(id) ON DELETE SET NULL,
  slug        VARCHAR(100),
  ip          VARCHAR(45),
  country     VARCHAR(10),
  referrer    TEXT,
  user_agent  TEXT,
  device_type VARCHAR(20),
  clicked_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id     UUID REFERENCES programs(id) ON DELETE SET NULL,
  click_id       UUID REFERENCES clicks(id) ON DELETE SET NULL,
  transaction_id TEXT,
  amount         DECIMAL(10,2),
  commission     DECIMAL(10,2),
  status         VARCHAR(50) DEFAULT 'pending',
  reported_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_jobs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query        TEXT NOT NULL,
  status       VARCHAR(50) DEFAULT 'pending',
  results_count INTEGER DEFAULT 0,
  error        TEXT,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clicks_link    ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_at      ON clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_programs_score ON programs(score DESC);
CREATE INDEX IF NOT EXISTS idx_links_slug     ON tracking_links(slug);

INSERT INTO settings(key, value) VALUES
  ('my_website_url', 'https://yourwebsite.com'),
  ('my_niche', 'general'),
  ('auto_apply', 'false'),
  ('signup_email', ''),
  ('signup_name', ''),
  ('gemini_key', ''),
  ('serpapi_key', '')
ON CONFLICT (key) DO NOTHING;
