/**
 * AffiliateHunter — Database Layer
 * Uses pg (node-postgres) with connection pooling.
 */

import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
})

export async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.DEBUG === 'true') {
    console.log('query', { text: text.slice(0, 60), duration, rows: res.rowCount })
  }
  return res
}

export async function initDB() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Affiliate programs discovered and scored
      CREATE TABLE IF NOT EXISTS programs (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            VARCHAR(255) NOT NULL,
        url             TEXT NOT NULL,
        network         VARCHAR(100),          -- ShareASale, CJ, Impact, direct, etc.
        niche           VARCHAR(100),          -- tech, finance, health, etc.
        commission_type VARCHAR(50),           -- percent, flat, recurring
        commission_rate DECIMAL(10,4),         -- e.g. 0.30 = 30%
        commission_flat DECIMAL(10,2),         -- e.g. 50.00 = $50/sale
        cookie_days     INTEGER DEFAULT 30,
        epc             DECIMAL(10,4),         -- earnings per click (estimated)
        score           INTEGER DEFAULT 0,     -- our priority score 0-100
        status          VARCHAR(50) DEFAULT 'discovered',
                        -- discovered | applied | approved | active | rejected | paused
        join_url        TEXT,                  -- URL of their affiliate signup page
        signup_email    TEXT,                  -- email we used to sign up
        affiliate_id    TEXT,                  -- their affiliate ID once approved
        affiliate_link  TEXT,                  -- our unique tracking link from them
        notes           TEXT,
        tags            JSONB DEFAULT '[]',
        raw_data        JSONB DEFAULT '{}',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Our click tracking links (one per program)
      CREATE TABLE IF NOT EXISTS tracking_links (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        program_id      UUID REFERENCES programs(id) ON DELETE CASCADE,
        slug            VARCHAR(100) UNIQUE NOT NULL,
        destination_url TEXT NOT NULL,         -- the actual affiliate link
        label           TEXT,                  -- friendly name
        utm_source      VARCHAR(100),
        utm_medium      VARCHAR(100),
        utm_campaign    VARCHAR(100),
        is_active       BOOLEAN DEFAULT true,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Every click through /c/:slug
      CREATE TABLE IF NOT EXISTS clicks (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        link_id         UUID REFERENCES tracking_links(id) ON DELETE SET NULL,
        program_id      UUID REFERENCES programs(id) ON DELETE SET NULL,
        slug            VARCHAR(100),
        ip              VARCHAR(45),
        country         VARCHAR(10),
        referrer        TEXT,
        user_agent      TEXT,
        device_type     VARCHAR(20),           -- desktop | mobile | tablet
        clicked_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Conversions reported back (via postback or API)
      CREATE TABLE IF NOT EXISTS conversions (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        program_id      UUID REFERENCES programs(id) ON DELETE SET NULL,
        click_id        UUID REFERENCES clicks(id) ON DELETE SET NULL,
        transaction_id  TEXT,
        amount          DECIMAL(10,2),
        commission      DECIMAL(10,2),
        status          VARCHAR(50) DEFAULT 'pending',
        reported_at     TIMESTAMPTZ DEFAULT NOW()
      );

      -- Search/scan jobs
      CREATE TABLE IF NOT EXISTS scan_jobs (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        query           TEXT NOT NULL,
        status          VARCHAR(50) DEFAULT 'pending',
                        -- pending | running | done | failed
        results_count   INTEGER DEFAULT 0,
        error           TEXT,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- App settings (key-value)
      CREATE TABLE IF NOT EXISTS settings (
        key             VARCHAR(100) PRIMARY KEY,
        value           TEXT,
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_clicks_link     ON clicks(link_id);
      CREATE INDEX IF NOT EXISTS idx_clicks_program  ON clicks(program_id);
      CREATE INDEX IF NOT EXISTS idx_clicks_at       ON clicks(clicked_at);
      CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
      CREATE INDEX IF NOT EXISTS idx_programs_score  ON programs(score DESC);
      CREATE INDEX IF NOT EXISTS idx_links_slug      ON tracking_links(slug);

      -- Seed default settings
      INSERT INTO settings(key, value) VALUES
        ('my_website_url',  'https://yourwebsite.com'),
        ('my_niche',        'general'),
        ('auto_apply',      'false'),
        ('signup_email',    ''),
        ('signup_name',     ''),
        ('gemini_key',      ''),
        ('serpapi_key',     '')
      ON CONFLICT (key) DO NOTHING;
    `)
    console.log('✅ Schema initialised')
  } finally {
    client.release()
  }
}
