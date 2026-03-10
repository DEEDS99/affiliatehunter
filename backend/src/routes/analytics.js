import { Router } from 'express'
import { query } from '../db/database.js'

const router = Router()

// GET /api/analytics/summary
router.get('/summary', async (req, res) => {
  const [clicks, conversions, programs, topLinks] = await Promise.all([
    query(`SELECT 
      COUNT(*) as total_clicks,
      COUNT(*) FILTER (WHERE clicked_at > NOW() - INTERVAL '24 hours') as clicks_today,
      COUNT(*) FILTER (WHERE clicked_at > NOW() - INTERVAL '7 days') as clicks_week,
      COUNT(DISTINCT ip) as unique_visitors
      FROM clicks`),
    query(`SELECT 
      COUNT(*) as total_conversions,
      COALESCE(SUM(amount), 0) as total_revenue,
      COALESCE(SUM(commission), 0) as total_earned
      FROM conversions WHERE status = 'confirmed'`),
    query(`SELECT COUNT(*) FILTER (WHERE status = 'active') as active,
                  COUNT(*) FILTER (WHERE status = 'applied') as applied,
                  COUNT(*) as total FROM programs`),
    query(`SELECT tl.slug, tl.label, p.name as program_name,
      COUNT(c.id) as clicks, p.commission_rate, p.commission_type, p.score
      FROM tracking_links tl
      JOIN programs p ON p.id = tl.program_id
      LEFT JOIN clicks c ON c.link_id = tl.id
      GROUP BY tl.id, p.name, p.commission_rate, p.commission_type, p.score
      ORDER BY clicks DESC LIMIT 10`),
  ])

  res.json({
    clicks: clicks.rows[0],
    conversions: conversions.rows[0],
    programs: programs.rows[0],
    top_links: topLinks.rows,
  })
})

// GET /api/analytics/clicks — Clicks over time
router.get('/clicks', async (req, res) => {
  const { days = 30 } = req.query
  const { rows } = await query(`
    SELECT 
      DATE_TRUNC('day', clicked_at) as date,
      COUNT(*) as clicks,
      COUNT(DISTINCT ip) as unique_clicks,
      COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile,
      COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop
    FROM clicks
    WHERE clicked_at > NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY 1 ORDER BY 1
  `)
  res.json({ data: rows })
})

// GET /api/analytics/programs — Per-program stats
router.get('/programs', async (req, res) => {
  const { rows } = await query(`
    SELECT p.id, p.name, p.score, p.status, p.commission_rate, p.commission_type,
      p.network, p.niche,
      COUNT(DISTINCT c.id) as clicks,
      COUNT(DISTINCT cv.id) as conversions,
      COALESCE(SUM(cv.commission), 0) as earned,
      CASE WHEN COUNT(c.id) > 0 
        THEN ROUND((COUNT(cv.id)::decimal / COUNT(c.id)) * 100, 2)
        ELSE 0 END as conversion_rate
    FROM programs p
    LEFT JOIN tracking_links tl ON tl.program_id = p.id
    LEFT JOIN clicks c ON c.link_id = tl.id
    LEFT JOIN conversions cv ON cv.program_id = p.id
    GROUP BY p.id
    ORDER BY clicks DESC, earned DESC
  `)
  res.json({ programs: rows })
})

// GET /api/analytics/geo — Clicks by country
router.get('/geo', async (req, res) => {
  const { rows } = await query(`
    SELECT country, COUNT(*) as clicks
    FROM clicks
    WHERE clicked_at > NOW() - INTERVAL '30 days'
    GROUP BY country ORDER BY clicks DESC LIMIT 20
  `)
  res.json({ data: rows })
})

// GET /api/analytics/referrers
router.get('/referrers', async (req, res) => {
  const { rows } = await query(`
    SELECT 
      CASE WHEN referrer = '' OR referrer IS NULL THEN 'Direct' 
           ELSE referrer END as referrer,
      COUNT(*) as clicks
    FROM clicks
    WHERE clicked_at > NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY clicks DESC LIMIT 15
  `)
  res.json({ data: rows })
})

export default router
