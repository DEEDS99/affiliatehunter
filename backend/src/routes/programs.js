import { Router } from 'express'
import { query } from '../db/database.js'
import { scoreProgram } from '../services/scorer.js'

const router = Router()

// GET /api/programs — List programs, sorted by score desc
router.get('/', async (req, res) => {
  const { status, niche, limit = 100, offset = 0 } = req.query
  let q = `SELECT p.*, 
    (SELECT COUNT(*) FROM clicks c 
     JOIN tracking_links tl ON tl.id = c.link_id 
     WHERE tl.program_id = p.id) as click_count,
    (SELECT COALESCE(SUM(commission),0) FROM conversions cv WHERE cv.program_id = p.id) as total_earned,
    (SELECT slug FROM tracking_links WHERE program_id = p.id LIMIT 1) as slug
    FROM programs p WHERE 1=1`
  const params = []

  if (status) { params.push(status); q += ` AND p.status = $${params.length}` }
  if (niche)  { params.push(niche);  q += ` AND p.niche = $${params.length}` }

  params.push(parseInt(limit))
  params.push(parseInt(offset))
  q += ` ORDER BY p.score DESC, p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

  const { rows } = await query(q, params)
  const total = await query('SELECT COUNT(*) FROM programs')
  res.json({ programs: rows, total: parseInt(total.rows[0].count) })
})

// GET /api/programs/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM clicks c JOIN tracking_links tl ON tl.id = c.link_id WHERE tl.program_id = p.id) as click_count,
      (SELECT COALESCE(SUM(commission),0) FROM conversions cv WHERE cv.program_id = p.id) as total_earned,
      json_agg(tl.*) FILTER (WHERE tl.id IS NOT NULL) as tracking_links
    FROM programs p
    LEFT JOIN tracking_links tl ON tl.program_id = p.id
    WHERE p.id = $1
    GROUP BY p.id
  `, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// PATCH /api/programs/:id — update program (status, affiliate_link, etc.)
router.patch('/:id', async (req, res) => {
  const allowed = ['status', 'affiliate_link', 'affiliate_id', 'notes', 'commission_rate',
                   'commission_flat', 'cookie_days', 'epc', 'join_url', 'network']
  const updates = []
  const vals = []
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) { vals.push(v); updates.push(`${k} = $${vals.length}`) }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields' })
  vals.push(req.params.id)
  await query(`UPDATE programs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals)
  res.json({ updated: true })
})

// DELETE /api/programs/:id
router.delete('/:id', async (req, res) => {
  await query('DELETE FROM programs WHERE id = $1', [req.params.id])
  res.json({ deleted: true })
})

// POST /api/programs/:id/tracking-link — create tracking link
router.post('/:id/tracking-link', async (req, res) => {
  const { destination_url, label, utm_source, utm_medium, utm_campaign } = req.body
  if (!destination_url) return res.status(400).json({ error: 'destination_url required' })

  const { rows: prog } = await query('SELECT name FROM programs WHERE id = $1', [req.params.id])
  if (!prog.length) return res.status(404).json({ error: 'Program not found' })

  const base = prog[0].name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 25)
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`

  const { rows } = await query(`
    INSERT INTO tracking_links (program_id, slug, destination_url, label, utm_source, utm_medium, utm_campaign)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
  `, [req.params.id, slug, destination_url, label || prog[0].name,
      utm_source || '', utm_medium || 'affiliate', utm_campaign || ''])

  const backendUrl = process.env.BACKEND_URL || `http://localhost:3001`
  res.json({ ...rows[0], tracking_url: `${backendUrl}/c/${slug}` })
})

// GET /api/programs/stats/summary
router.get('/stats/summary', async (req, res) => {
  const stats = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')    as active,
      COUNT(*) FILTER (WHERE status = 'applied')   as applied,
      COUNT(*) FILTER (WHERE status = 'approved')  as approved,
      COUNT(*) FILTER (WHERE status = 'discovered') as discovered,
      COUNT(*) as total,
      COALESCE(AVG(score),0) as avg_score
    FROM programs
  `)
  res.json(stats.rows[0])
})

export default router
