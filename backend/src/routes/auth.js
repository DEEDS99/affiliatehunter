import { Router } from 'express'
const router = Router()

// Simple password auth for single-user dashboard
router.post('/login', (req, res) => {
  const { password } = req.body
  const adminPass = process.env.ADMIN_PASSWORD || 'affiliate2024'
  if (password === adminPass) {
    res.json({ token: Buffer.from(`admin:${Date.now()}`).toString('base64'), role: 'admin' })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
})

router.get('/me', (req, res) => {
  res.json({ role: 'admin', authenticated: true })
})

export default router
