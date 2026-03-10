/**
 * AffiliateHunter — Search & Discovery Engine
 * =============================================
 * Uses Google Search (SerpAPI) + Gemini AI to:
 *   1. Find affiliate programs for a given niche/keyword
 *   2. Scrape their details (commission, cookie, EPC)
 *   3. Score and rank them
 *   4. Store in DB
 */

import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import { query } from '../db/database.js'
import { io } from '../index.js'
import { scoreProgram } from './scorer.js'

// ── Search affiliate programs via SerpAPI ──────────────────────────────────
export async function searchAffiliatePrograms(keyword, niche = 'general') {
  const programs = []
  const serpKey = process.env.SERPAPI_KEY

  // Build search queries
  const queries = [
    `"${keyword}" affiliate program site:shareasale.com OR site:cj.com OR site:impact.com`,
    `"${keyword}" affiliate program commission signup`,
    `best "${keyword}" affiliate programs 2024 high commission`,
    `${niche} affiliate programs high EPC recurring commission`,
  ]

  for (const q of queries) {
    try {
      let results = []

      if (serpKey) {
        // Use SerpAPI for clean structured results
        const url = `https://serpapi.com/search?api_key=${serpKey}&q=${encodeURIComponent(q)}&num=10&hl=en&gl=us`
        const res = await fetch(url)
        const data = await res.json()
        results = data.organic_results || []
      } else {
        // Fallback: scrape DuckDuckGo HTML (no API key needed)
        results = await scrapeDDG(q)
      }

      for (const result of results.slice(0, 5)) {
        const program = await extractProgramFromResult(result, niche)
        if (program) programs.push(program)
      }

      // Throttle between queries
      await sleep(1000)
    } catch (err) {
      console.error('Search error:', err.message)
    }
  }

  // Deduplicate by domain
  const seen = new Set()
  const unique = programs.filter(p => {
    try {
      const domain = new URL(p.url).hostname
      if (seen.has(domain)) return false
      seen.add(domain)
      return true
    } catch { return false }
  })

  return unique
}

// ── Extract affiliate program details from a search result ────────────────
async function extractProgramFromResult(result, niche) {
  const url  = result.link || result.url || ''
  const title = result.title || ''
  const snippet = result.snippet || result.description || ''

  if (!url || !isAffiliateResult(title, snippet)) return null

  try {
    // Try to scrape the actual page for commission details
    const details = await scrapeAffiliatePageDetails(url)

    const program = {
      name: cleanName(title),
      url: url,
      niche: niche,
      network: detectNetwork(url, title),
      commission_type: details.commission_type || 'percent',
      commission_rate: details.commission_rate || guessCommissionFromSnippet(snippet),
      commission_flat: details.commission_flat || 0,
      cookie_days: details.cookie_days || 30,
      epc: details.epc || 0,
      join_url: details.join_url || url,
      notes: snippet.slice(0, 300),
      raw_data: { title, snippet, details },
    }

    program.score = scoreProgram(program)
    return program
  } catch {
    return {
      name: cleanName(title),
      url,
      niche,
      network: detectNetwork(url, title),
      commission_type: 'percent',
      commission_rate: guessCommissionFromSnippet(snippet),
      commission_flat: 0,
      cookie_days: 30,
      epc: 0,
      join_url: url,
      notes: snippet.slice(0, 300),
      score: 20,
      raw_data: { title, snippet },
    }
  }
}

// ── Scrape affiliate program page for details ─────────────────────────────
async function scrapeAffiliatePageDetails(url) {
  const details = {
    commission_rate: 0,
    commission_flat: 0,
    commission_type: 'percent',
    cookie_days: 30,
    epc: 0,
    join_url: url,
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 8000,
      redirect: 'follow',
    })
    if (!res.ok) return details
    const html = await res.text()
    const $ = cheerio.load(html)
    const text = $('body').text().toLowerCase()

    // Extract commission percentage
    const pctMatch = text.match(/(\d{1,3})%\s*(commission|per\s*sale|per\s*referral|revenue\s*share)/)
    if (pctMatch) {
      details.commission_rate = parseFloat(pctMatch[1]) / 100
      details.commission_type = 'percent'
    }

    // Extract flat commission
    const flatMatch = text.match(/\$(\d+(?:\.\d+)?)\s*(per\s*sale|per\s*lead|per\s*referral|per\s*signup|commission|flat)/)
    if (flatMatch && !pctMatch) {
      details.commission_flat = parseFloat(flatMatch[1])
      details.commission_type = 'flat'
    }

    // Extract cookie duration
    const cookieMatch = text.match(/(\d+)\s*[- ]?day\s*(cookie|tracking|attribution)/)
    if (cookieMatch) details.cookie_days = parseInt(cookieMatch[1])

    // Look for EPC
    const epcMatch = text.match(/epc[:\s]+\$?(\d+(?:\.\d+)?)/)
    if (epcMatch) details.epc = parseFloat(epcMatch[1])

    // Find signup/join link
    const signupLink = $('a').filter((_, el) => {
      const href = $(el).attr('href') || ''
      const txt = $(el).text().toLowerCase()
      return /join|apply|sign.?up|register|become.*affiliate|get.*link/i.test(txt) ||
             /join|apply|signup|register/i.test(href)
    }).first().attr('href')

    if (signupLink) {
      try {
        details.join_url = new URL(signupLink, url).toString()
      } catch {}
    }

    // Detect recurring
    if (/recurring|lifetime|subscription|monthly/i.test(text)) {
      details.commission_type = 'recurring'
    }

  } catch (err) {
    console.error('Scrape error for', url, err.message)
  }

  return details
}

// ── DuckDuckGo fallback (no API key) ─────────────────────────────────────
async function scrapeDDG(q) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000,
    })
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    $('.result__body').each((_, el) => {
      const title = $(el).find('.result__title').text().trim()
      const link  = $(el).find('.result__url').text().trim()
      const snippet = $(el).find('.result__snippet').text().trim()
      if (title && link) {
        results.push({
          title,
          link: link.startsWith('http') ? link : `https://${link}`,
          snippet,
        })
      }
    })
    return results
  } catch { return [] }
}

// ── Use Gemini to enrich program data ─────────────────────────────────────
export async function enrichWithGemini(program) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return program

  try {
    const prompt = `You are an affiliate marketing expert. Analyze this affiliate program and provide structured data.

Program name: ${program.name}
URL: ${program.url}
Niche: ${program.niche}
Notes: ${program.notes}

Respond ONLY with valid JSON (no markdown), with these fields:
{
  "commission_rate": 0.30,
  "commission_type": "percent|flat|recurring",
  "commission_flat": 0,
  "cookie_days": 30,
  "epc_estimate": 1.50,
  "quality_score": 75,
  "pros": ["high commission", "recurring"],
  "cons": ["low EPC", "narrow niche"],
  "recommended_content": "how to use this product, tutorials, reviews",
  "network": "ShareASale|CJ|Impact|direct|other"
}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        }),
      }
    )

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const enriched = JSON.parse(clean)

    return {
      ...program,
      commission_rate: enriched.commission_rate || program.commission_rate,
      commission_type: enriched.commission_type || program.commission_type,
      commission_flat: enriched.commission_flat || program.commission_flat,
      cookie_days:     enriched.cookie_days || program.cookie_days,
      epc:             enriched.epc_estimate || program.epc,
      network:         enriched.network || program.network,
      score:           enriched.quality_score || program.score,
      raw_data: { ...program.raw_data, gemini: enriched },
    }
  } catch (err) {
    console.error('Gemini enrichment error:', err.message)
    return program
  }
}

// ── Save discovered programs to DB ────────────────────────────────────────
export async function saveProgramsToDB(programs, jobId) {
  let saved = 0
  for (const p of programs) {
    try {
      // Skip if URL already exists
      const existing = await query('SELECT id FROM programs WHERE url = $1', [p.url])
      if (existing.rows.length > 0) continue

      await query(`
        INSERT INTO programs (
          name, url, network, niche, commission_type, commission_rate,
          commission_flat, cookie_days, epc, score, join_url, notes, raw_data
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        p.name, p.url, p.network || 'unknown', p.niche,
        p.commission_type, p.commission_rate || 0,
        p.commission_flat || 0, p.cookie_days || 30,
        p.epc || 0, p.score || 0,
        p.join_url || p.url, p.notes || '',
        JSON.stringify(p.raw_data || {}),
      ])
      saved++
      // Emit real-time update
      io.emit('program_found', { name: p.name, score: p.score, niche: p.niche })
    } catch (err) {
      console.error('DB insert error:', err.message)
    }
  }
  return saved
}

// ── Helpers ───────────────────────────────────────────────────────────────
function isAffiliateResult(title, snippet) {
  const text = (title + ' ' + snippet).toLowerCase()
  return /affiliate|commission|earn|referral|partner|program|monetize/i.test(text)
}

function detectNetwork(url, title) {
  const s = (url + ' ' + title).toLowerCase()
  if (s.includes('shareasale'))    return 'ShareASale'
  if (s.includes('cj.com') || s.includes('commissionjunction')) return 'CJ'
  if (s.includes('impact'))        return 'Impact'
  if (s.includes('clickbank'))     return 'ClickBank'
  if (s.includes('rakuten'))       return 'Rakuten'
  if (s.includes('awin'))          return 'Awin'
  if (s.includes('amazon'))        return 'Amazon Associates'
  if (s.includes('partnerstack'))  return 'PartnerStack'
  return 'direct'
}

function cleanName(title) {
  return title
    .replace(/\s*-\s*affiliate program.*/i, '')
    .replace(/\s*\|\s*.*/i, '')
    .trim()
    .slice(0, 100)
}

function guessCommissionFromSnippet(snippet) {
  const m = snippet.match(/(\d{1,3})%/)
  if (m) return parseFloat(m[1]) / 100
  return 0.10 // default 10% guess
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
