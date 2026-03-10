/**
 * AffiliateHunter — Auto-Join Service
 * =====================================
 * Uses Puppeteer to automatically fill and submit affiliate program
 * signup forms on major networks and direct program pages.
 *
 * Supported networks:
 *   - ShareASale (auto-fills publisher signup)
 *   - CJ (Commission Junction)
 *   - Impact
 *   - ClickBank
 *   - Direct programs (generic form fill)
 *
 * For networks that require manual approval, we:
 *   1. Fill the form with user's details
 *   2. Submit it
 *   3. Record the application date
 *   4. Mark status as 'applied'
 */

import puppeteer from 'puppeteer'
import { query } from '../db/database.js'
import { io } from '../index.js'

export async function joinProgram(programId, userDetails) {
  const { rows } = await query('SELECT * FROM programs WHERE id = $1', [programId])
  if (!rows.length) throw new Error('Program not found')
  const program = rows[0]

  const result = {
    success: false,
    method: 'manual',
    message: '',
    affiliate_link: '',
    affiliate_id: '',
  }

  io.emit('join_started', { programId, name: program.name })

  try {
    const network = program.network?.toLowerCase() || ''

    if (network.includes('shareasale')) {
      Object.assign(result, await joinShareASale(program, userDetails))
    } else if (network.includes('clickbank')) {
      Object.assign(result, await joinClickBank(program, userDetails))
    } else if (network.includes('impact')) {
      Object.assign(result, await joinImpact(program, userDetails))
    } else {
      // Generic direct program form fill
      Object.assign(result, await joinDirectProgram(program, userDetails))
    }

    // Update DB
    await query(`
      UPDATE programs SET
        status = $1, affiliate_id = $2, affiliate_link = $3,
        signup_email = $4, updated_at = NOW()
      WHERE id = $5
    `, [
      result.success ? 'applied' : 'join_failed',
      result.affiliate_id || '',
      result.affiliate_link || '',
      userDetails.email,
      programId,
    ])

    // Create tracking link if we got an affiliate link
    if (result.affiliate_link) {
      const slug = generateSlug(program.name)
      await query(`
        INSERT INTO tracking_links (program_id, slug, destination_url, label)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug) DO UPDATE SET destination_url = $3
      `, [programId, slug, result.affiliate_link, program.name])
      result.slug = slug
    }

    io.emit('join_complete', { programId, name: program.name, success: result.success })

  } catch (err) {
    result.message = err.message
    io.emit('join_error', { programId, name: program.name, error: err.message })
    await query(`UPDATE programs SET status = 'join_failed' WHERE id = $1`, [programId])
  }

  return result
}

// ── ShareASale signup ─────────────────────────────────────────────────────
async function joinShareASale(program, user) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto('https://account.shareasale.com/shareasale.cfm?merchantID=&type=new', {
      waitUntil: 'networkidle2', timeout: 30000,
    })

    // Fill basic publisher info
    await fillIfExists(page, '#userName', user.username || user.email.split('@')[0])
    await fillIfExists(page, '#emailAddress', user.email)
    await fillIfExists(page, '#password', user.password || generateTempPassword())
    await fillIfExists(page, '#website', user.website)
    await fillIfExists(page, '#fname', user.first_name)
    await fillIfExists(page, '#lname', user.last_name)

    // Take screenshot for records
    const screenshot = await page.screenshot({ encoding: 'base64' })

    // Submit
    await page.click('input[type="submit"], button[type="submit"]').catch(() => {})
    await page.waitForTimeout(3000)

    const currentUrl = page.url()
    const success = currentUrl.includes('thank') || currentUrl.includes('success') ||
                    currentUrl.includes('confirm') || currentUrl.includes('dashboard')

    await browser.close()
    return {
      success,
      method: 'auto',
      message: success ? 'Application submitted to ShareASale' : 'May need manual completion',
      screenshot,
    }
  } catch (err) {
    await browser.close()
    return { success: false, method: 'auto', message: err.message }
  }
}

// ── ClickBank signup ──────────────────────────────────────────────────────
async function joinClickBank(program, user) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto('https://accounts.clickbank.com/signup/', {
      waitUntil: 'networkidle2', timeout: 30000,
    })

    await fillIfExists(page, '#email', user.email)
    await fillIfExists(page, '#first_name', user.first_name)
    await fillIfExists(page, '#last_name', user.last_name)
    await fillIfExists(page, '#country', 'US')

    await page.click('button[type="submit"], input[type="submit"]').catch(() => {})
    await page.waitForTimeout(3000)

    await browser.close()
    return {
      success: true,
      method: 'auto',
      message: 'ClickBank signup submitted — check email to complete',
    }
  } catch (err) {
    await browser.close()
    return { success: false, method: 'auto', message: err.message }
  }
}

// ── Impact signup ─────────────────────────────────────────────────────────
async function joinImpact(program, user) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto('https://app.impact.com/signup/', {
      waitUntil: 'networkidle2', timeout: 30000,
    })

    await fillIfExists(page, 'input[name="email"]', user.email)
    await fillIfExists(page, 'input[name="firstName"]', user.first_name)
    await fillIfExists(page, 'input[name="lastName"]', user.last_name)
    await fillIfExists(page, 'input[name="website"]', user.website)

    await page.click('button[type="submit"]').catch(() => {})
    await page.waitForTimeout(3000)

    await browser.close()
    return {
      success: true,
      method: 'auto',
      message: 'Impact signup submitted',
    }
  } catch (err) {
    await browser.close()
    return { success: false, method: 'auto', message: err.message }
  }
}

// ── Generic direct program form fill ─────────────────────────────────────
async function joinDirectProgram(program, user) {
  if (!program.join_url) {
    return { success: false, method: 'manual', message: 'No signup URL found — visit manually' }
  }

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto(program.join_url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Try common field selectors
    const filled = []
    const fieldMap = {
      email:     ['input[name="email"]', '#email', 'input[type="email"]'],
      firstName: ['input[name="first_name"]', '#firstName', 'input[name="fname"]', '#fname'],
      lastName:  ['input[name="last_name"]',  '#lastName',  'input[name="lname"]', '#lname'],
      website:   ['input[name="website"]', '#website', 'input[name="url"]'],
      name:      ['input[name="name"]', '#name', 'input[name="full_name"]'],
    }

    const fieldValues = {
      email:     user.email,
      firstName: user.first_name,
      lastName:  user.last_name,
      website:   user.website,
      name:      `${user.first_name} ${user.last_name}`,
    }

    for (const [field, selectors] of Object.entries(fieldMap)) {
      for (const sel of selectors) {
        try {
          await page.type(sel, fieldValues[field] || '', { delay: 30 })
          filled.push(field)
          break
        } catch {}
      }
    }

    const screenshot = await page.screenshot({ encoding: 'base64' })

    // Try to submit
    await page.click('button[type="submit"], input[type="submit"], .submit-btn, #submit').catch(() => {})
    await page.waitForTimeout(3000)

    await browser.close()

    return {
      success: filled.length >= 2,
      method: 'auto',
      message: filled.length >= 2
        ? `Form filled (${filled.join(', ')}) — may need manual review`
        : 'Could not auto-fill — please join manually',
      screenshot,
    }
  } catch (err) {
    await browser.close()
    return {
      success: false,
      method: 'manual',
      message: `Auto-join failed: ${err.message}. Visit ${program.join_url} manually.`,
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  })
}

async function fillIfExists(page, selector, value) {
  if (!value) return
  try {
    await page.waitForSelector(selector, { timeout: 3000 })
    await page.click(selector)
    await page.keyboard.selectAll()
    await page.type(selector, String(value), { delay: 20 })
  } catch {}
}

function generateSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${base}-${rand}`
}

function generateTempPassword() {
  return 'Aff' + Math.random().toString(36).slice(2, 10) + '!1'
}
