import { Router } from 'express'
import { joinProgram } from '../services/joiner.js'
import { query } from '../db/database.js'

const router = Router()

// POST /api/join/:programId
router.post('/:programId', async (req, res) => {
  const { programId } = req.params

  // Get user details from settings or request body
  const { rows: settings } = await query(`SELECT key, value FROM settings`)
  const s = Object.fromEntries(settings.map(r => [r.key, r.value]))

  const userDetails = {
    email:      req.body.email     || s.signup_email || '',
    first_name: req.body.firstName || s.signup_name?.split(' ')[0] || '',
    last_name:  req.body.lastName  || s.signup_name?.split(' ').slice(1).join(' ') || '',
    website:    req.body.website   || s.my_website_url || '',
    username:   req.body.username  || s.signup_email?.split('@')[0] || '',
    password:   req.body.password  || undefined,
  }

  if (!userDetails.email) {
    return res.status(400).json({
      error: 'Email required. Set it in Settings or pass in request body.'
    })
  }

  try {
    // Return immediately, join runs async — client tracks via WebSocket
    res.json({ status: 'joining', programId, message: 'Auto-join started — watch dashboard for updates' })

    const result = await joinProgram(programId, userDetails)
    console.log('Join result:', result)

  } catch (err) {
    console.error('Join error:', err)
  }
})

// POST /api/join/bulk — join multiple programs
router.post('/bulk', async (req, res) => {
  const { programIds, max = 5 } = req.body
  if (!Array.isArray(programIds) || !programIds.length) {
    return res.status(400).json({ error: 'programIds array required' })
  }

  const limited = programIds.slice(0, parseInt(max))
  res.json({
    status: 'queued',
    count: limited.length,
    message: `Queued ${limited.length} programs for auto-join`,
  })

  // Get settings
  const { rows: settings } = await query(`SELECT key, value FROM settings`)
  const s = Object.fromEntries(settings.map(r => [r.key, r.value]))
  const userDetails = {
    email: s.signup_email || '',
    first_name: s.signup_name?.split(' ')[0] || '',
    last_name: s.signup_name?.split(' ').slice(1).join(' ') || '',
    website: s.my_website_url || '',
  }

  // Join one by one with delay
  setImmediate(async () => {
    for (const id of limited) {
      try {
        await joinProgram(id, userDetails)
        await new Promise(r => setTimeout(r, 5000)) // 5s between joins
      } catch (err) {
        console.error('Bulk join error:', id, err.message)
      }
    }
  })
})

export default router
