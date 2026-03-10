import { Router } from 'express'
import { query } from '../db/database.js'

const router = Router()

router.get('/', async (req, res) => {
  const { rows } = await query('SELECT key, value FROM settings')
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]))
  // Never expose raw API keys to client
  if (settings.gemini_key) settings.gemini_key = settings.gemini_key ? '***set***' : ''
  if (settings.serpapi_key) settings.serpapi_key = settings.serpapi_key ? '***set***' : ''
  res.json(settings)
})

router.patch('/', async (req, res) => {
  const allowed = ['my_website_url', 'my_niche', 'auto_apply',
                   'signup_email', 'signup_name', 'gemini_key', 'serpapi_key']
  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      )
    }
  }
  res.json({ saved: true })
})

// Generate embeddable JavaScript snippet for user's website
router.get('/snippet', async (req, res) => {
  const { rows } = await query('SELECT key, value FROM settings')
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'

  // Get all active tracking links
  const { rows: links } = await query(`
    SELECT tl.slug, tl.label, p.name, tl.destination_url
    FROM tracking_links tl
    JOIN programs p ON p.id = tl.program_id
    WHERE tl.is_active = true
  `)

  const snippet = `<!-- AffiliateHunter Click Tracker -->
<!-- Add this to your website's <head> or before </body> -->
<script>
(function() {
  var TRACKER = '${backendUrl}/c/';
  // Auto-replace links to known affiliate domains with tracked versions
  var affiliateLinks = ${JSON.stringify(links.map(l => ({
    slug: l.slug,
    label: l.label,
    destination: l.destination_url,
  })))};

  // Replace all matching links on page load
  document.addEventListener('DOMContentLoaded', function() {
    affiliateLinks.forEach(function(link) {
      var dest = link.destination;
      try {
        var domain = new URL(dest).hostname;
        document.querySelectorAll('a[href*="' + domain + '"]').forEach(function(el) {
          el.href = TRACKER + link.slug + '?ref=' + encodeURIComponent(window.location.pathname);
          el.setAttribute('data-affiliate', link.label);
        });
      } catch(e) {}
    });
  });
})();
</script>`

  res.json({
    snippet,
    links: links.map(l => ({
      slug: l.slug,
      label: l.label,
      tracking_url: `${backendUrl}/c/${l.slug}`,
      destination: l.destination_url,
    })),
  })
})

export default router
