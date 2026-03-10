import { Router } from 'express'
import { query } from '../db/database.js'
import { searchAffiliatePrograms, enrichWithGemini, saveProgramsToDB } from '../services/search.js'
import { io } from '../index.js'

const router = Router()

// POST /api/search — Start a new affiliate program search
router.post('/', async (req, res) => {
  const { keyword, niche = 'general', enrich = true } = req.body
  if (!keyword) return res.status(400).json({ error: 'keyword required' })

  // Create scan job
  const jobResult = await query(
    `INSERT INTO scan_jobs (query, status, started_at) VALUES ($1, 'running', NOW()) RETURNING id`,
    [`${keyword} | niche: ${niche}`]
  )
  const jobId = jobResult.rows[0].id

  res.json({ job_id: jobId, message: 'Search started', status: 'running' })

  // Run search in background
  setImmediate(async () => {
    try {
      io.emit('scan_started', { jobId, keyword, niche })

      let programs = await searchAffiliatePrograms(keyword, niche)
      io.emit('scan_progress', { jobId, count: programs.length, stage: 'found' })

      // Enrich with Gemini if enabled
      if (enrich && process.env.GEMINI_API_KEY) {
        const enriched = []
        for (const p of programs) {
          const e = await enrichWithGemini(p)
          enriched.push(e)
          io.emit('scan_progress', { jobId, stage: 'enriching', name: e.name })
        }
        programs = enriched
      }

      const saved = await saveProgramsToDB(programs, jobId)

      await query(`
        UPDATE scan_jobs SET status = 'done', results_count = $1, completed_at = NOW() WHERE id = $2
      `, [saved, jobId])

      io.emit('scan_complete', { jobId, found: programs.length, saved, keyword })

    } catch (err) {
      await query(`UPDATE scan_jobs SET status = 'failed', error = $1 WHERE id = $2`, [err.message, jobId])
      io.emit('scan_error', { jobId, error: err.message })
    }
  })
})

// GET /api/search/jobs — List recent scan jobs
router.get('/jobs', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT 20`
  )
  res.json({ jobs: rows })
})

// GET /api/search/jobs/:id — Get job status
router.get('/jobs/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM scan_jobs WHERE id = $1`, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Job not found' })
  res.json(rows[0])
})

export default router
