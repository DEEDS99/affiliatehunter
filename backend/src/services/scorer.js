/**
 * AffiliateHunter — Program Scoring Engine
 * ==========================================
 * Scores each affiliate program 0–100 based on:
 *   - Commission rate (higher = better)
 *   - Commission type (recurring > percent > flat)
 *   - Cookie duration (longer = better)
 *   - EPC estimate (higher = better)
 *   - Network trust (known networks score higher)
 *   - Niche fit (based on user's website niche)
 */

const NETWORK_TRUST = {
  'ShareASale':       15,
  'CJ':               15,
  'Impact':           15,
  'PartnerStack':     14,
  'Rakuten':          13,
  'Awin':             13,
  'ClickBank':        10,
  'Amazon Associates': 8,
  'direct':            5,
  'unknown':           3,
}

const COMMISSION_TYPE_BONUS = {
  recurring: 20,  // SaaS/subscription — pay forever
  percent:   10,
  flat:       5,
}

export function scoreProgram(program) {
  let score = 0

  // ── Commission rate score (0–30 points) ──────────────────────
  const rate = program.commission_rate || 0
  const flat = program.commission_flat || 0

  if (program.commission_type === 'flat') {
    // Flat: $1 = 1 point, capped at 30
    score += Math.min(flat, 30)
  } else {
    // Percent: 100% = 30pts, 30% = 9pts, 10% = 3pts
    score += Math.min(Math.round(rate * 30), 30)
  }

  // ── Cookie duration (0–15 points) ────────────────────────────
  const days = program.cookie_days || 30
  if (days >= 365) score += 15
  else if (days >= 90)  score += 12
  else if (days >= 60)  score += 10
  else if (days >= 30)  score += 7
  else if (days >= 14)  score += 4
  else score += 1

  // ── Commission type bonus (0–20 points) ──────────────────────
  score += COMMISSION_TYPE_BONUS[program.commission_type] || 5

  // ── Network trust (0–15 points) ──────────────────────────────
  score += NETWORK_TRUST[program.network] || 3

  // ── EPC score (0–10 points) ───────────────────────────────────
  const epc = program.epc || 0
  if (epc >= 5)      score += 10
  else if (epc >= 3) score += 7
  else if (epc >= 1) score += 4
  else if (epc > 0)  score += 2

  // ── Bonus points ──────────────────────────────────────────────
  // High commission rate bonus
  if (rate >= 0.50) score += 5   // 50%+ commission
  if (rate >= 0.30) score += 3   // 30%+ commission

  // High flat commission
  if (flat >= 100) score += 5    // $100+ per sale

  // Cap at 100
  return Math.min(Math.round(score), 100)
}

// Prioritise a list of programs
export function prioritisePrograms(programs) {
  return [...programs].sort((a, b) => (b.score || 0) - (a.score || 0))
}

// Classify by tier
export function getTier(score) {
  if (score >= 70) return { tier: 'A', label: 'Top Priority', color: 'emerald' }
  if (score >= 50) return { tier: 'B', label: 'Good',         color: 'blue' }
  if (score >= 30) return { tier: 'C', label: 'Average',      color: 'yellow' }
  return               { tier: 'D', label: 'Low Priority',  color: 'gray' }
}
