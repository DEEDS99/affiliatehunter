/**
 * AffiliateHunter — Main Backend Engine
 * ======================================
 * Searches the web for affiliate programs, scores/prioritises them,
 * auto-applies (form fill via Puppeteer), tracks clicks via redirect
 * links, and forwards traffic from your site to affiliate destinations.
 *
 * Core flow:
 *  1. Search: Gemini AI + SerpAPI scrapes affiliate programs
 *  2. Score:  Each program ranked by EPC, commission %, niche fit
 *  3. Join:   Puppeteer auto-fills signup forms on affiliate networks
 *  4. Track:  Every outbound click goes through /c/:slug → logs → redirects
 *  5. Report: Real-time dashboard of clicks, conversions, estimated revenue
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Routes ────────────────────────────────────────────────────────────────
import searchRoutes    from './routes/search.js'
import programRoutes   from './routes/programs.js'
import clickRoutes     from './routes/clicks.js'
import joinRoutes      from './routes/join.js'
import analyticsRoutes from './routes/analytics.js'
import settingsRoutes  from './routes/settings.js'
import authRoutes      from './routes/auth.js'

// ── DB ────────────────────────────────────────────────────────────────────
import { initDB } from './db/database.js'

const app = express()
const httpServer = createServer(app)

// ── WebSocket (real-time click + scan events) ─────────────────────────────
export const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id)
  socket.on('disconnect', () => console.log('Dashboard disconnected:', socket.id))
})

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    /localhost/,
  ],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(morgan('dev'))

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/search',    searchRoutes)
app.use('/api/programs',  programRoutes)
app.use('/api/join',      joinRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/settings',  settingsRoutes)

// ── Affiliate Click Tracker (/c/:slug → log → redirect) ───────────────────
// This is the CORE revenue engine — every affiliate link goes through here
app.use('/c', clickRoutes)

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  version: '1.0.0',
  uptime: Math.floor(process.uptime()),
}))

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

async function start() {
  try {
    await initDB()
    console.log('✅ Database ready')

    httpServer.listen(PORT, () => {
      console.log(`\n🚀 AffiliateHunter backend running`)
      console.log(`   API:      http://localhost:${PORT}/api`)
      console.log(`   Tracker:  http://localhost:${PORT}/c/:slug`)
      console.log(`   Health:   http://localhost:${PORT}/health\n`)
    })
  } catch (err) {
    console.error('❌ Startup failed:', err)
    process.exit(1)
  }
}

start()
