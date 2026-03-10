/**
 * AffiliateHunter — Click Tracker
 * =================================
 * GET /c/:slug
 *
 * This is the core affiliate revenue engine.
 * Every outbound affiliate link goes through here:
 *
 *   Your website → /c/product-slug → (log) → affiliate URL
 *
 * What happens on each click:
 *   1. Lookup the tracking link by slug
 *   2. Parse IP, country, device, referrer
 *   3. Log to clicks table
 *   4. Emit real-time event via WebSocket to dashboard
 *   5. 302 redirect to affiliate destination
 *
 * The "click back" from your website means:
 *   - Put /c/slug links on your website
 *   - When visitor clicks, they hit this endpoint
 *   - We log it and forward them to the affiliate
 *   - You earn commission if they buy
 */

import { Router } from 'express'
import { query } from '../db/database.js'
import { io } from '../index.js'
import geoip from 'geoip-lite'

const router = Router()

// ── Main click redirect ───────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    // Lookup tracking link
    const { rows } = await query(`
      SELECT tl.*, p.name as program_name, p.commission_rate, p.commission_type
      FROM tracking_links tl
      JOIN programs p ON p.id = tl.program_id
      WHERE tl.slug = $1 AND tl.is_active = true
    `, [slug])

    if (!rows.length) {
      return res.status(404).send('Link not found')
    }

    const link = rows[0]

    // Parse visitor info
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.socket.remoteAddress
               || ''
    const realIP = ip.replace('::ffff:', '')
    const geo = geoip.lookup(realIP)
    const country = geo?.country || 'XX'
    const ua = req.headers['user-agent'] || ''
    const referrer = req.headers.referer || req.headers.referrer || ''
    const device = detectDevice(ua)

    // Log click
    const clickResult = await query(`
      INSERT INTO clicks (link_id, program_id, slug, ip, country, referrer, user_agent, device_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      link.id,
      link.program_id,
      slug,
      realIP.slice(0, 45),
      country,
      referrer.slice(0, 500),
      ua.slice(0, 500),
      device,
    ])

    // Real-time dashboard update
    io.emit('click', {
      slug,
      program_name: link.program_name,
      country,
      device,
      referrer: referrer ? new URL(referrer).hostname : 'direct',
      timestamp: new Date().toISOString(),
    })

    // Build destination URL (append UTM params if set)
    let destination = link.destination_url
    if (link.utm_source || link.utm_medium || link.utm_campaign) {
      try {
        const url = new URL(destination)
        if (link.utm_source)   url.searchParams.set('utm_source',   link.utm_source)
        if (link.utm_medium)   url.searchParams.set('utm_medium',   link.utm_medium)
        if (link.utm_campaign) url.searchParams.set('utm_campaign', link.utm_campaign)
        destination = url.toString()
      } catch {}
    }

    // 302 redirect (not 301 so it doesn't get cached)
    res.redirect(302, destination)

  } catch (err) {
    console.error('Click tracking error:', err)
    res.redirect(302, '/')
  }
})

// ── Postback (conversion notification) ───────────────────────────────────
// Affiliate networks call this URL when a conversion happens
// Format: /c/postback?program_id=xxx&transaction_id=yyy&amount=99.00&commission=29.70
router.get('/postback', async (req, res) => {
  const { program_id, transaction_id, amount, commission, click_id } = req.query

  try {
    await query(`
      INSERT INTO conversions (program_id, click_id, transaction_id, amount, commission, status)
      VALUES ($1, $2, $3, $4, $5, 'confirmed')
      ON CONFLICT DO NOTHING
    `, [program_id, click_id || null, transaction_id, amount || 0, commission || 0])

    io.emit('conversion', {
      program_id,
      transaction_id,
      amount: parseFloat(amount || 0),
      commission: parseFloat(commission || 0),
      timestamp: new Date().toISOString(),
    })

    res.json({ received: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function detectDevice(ua) {
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) return 'mobile'
  if (/tablet|ipad/i.test(ua)) return 'tablet'
  return 'desktop'
}

export default router
