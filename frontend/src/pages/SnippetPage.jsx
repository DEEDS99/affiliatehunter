import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../services/api'
import toast from 'react-hot-toast'
import { Code2, Copy, CheckCircle2 } from 'lucide-react'

export default function SnippetPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['snippet'],
    queryFn: () => settingsApi.snippet().then(r => r.data),
    refetchInterval: 30000,
  })

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard!') }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Code2 size={18} className="text-emerald-400" /> Website Snippet
          </h1>
          <p className="text-xs text-white/30 mt-0.5">
            Paste this on your website to automatically track all affiliate link clicks
          </p>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-5">
          <p className="text-sm font-semibold text-emerald-300 mb-2">How click-back works</p>
          <div className="space-y-1.5 text-xs text-emerald-300/60">
            {[
              'Add the snippet to your website\'s <head> or before </body>',
              'It automatically finds all links to your affiliate destinations',
              'Rewrites them to go through your tracker (/c/slug)',
              'Every click is logged with country, device, referrer',
              'Visitor is instantly forwarded to the affiliate — they never notice',
              'Conversions reported back via postback URL',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Snippet */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/70">Auto-Replace Snippet</h3>
            <button onClick={() => data?.snippet && copy(data.snippet)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/8 text-white/60 hover:bg-white/12">
              <Copy size={12} /> Copy
            </button>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="text-white/20 text-xs">Loading...</div>
            ) : (
              <pre className="text-xs text-emerald-300/80 mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {data?.snippet || '<!-- No tracking links yet — create some first -->'}
              </pre>
            )}
          </div>
        </div>

        {/* Manual links table */}
        {data?.links?.length > 0 && (
          <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8">
              <h3 className="text-sm font-semibold text-white/70">Manual Link List</h3>
            </div>
            <div className="divide-y divide-white/5">
              {data.links.map((link, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 font-medium">{link.label}</p>
                    <p className="text-xs text-emerald-400 mono truncate">{link.tracking_url}</p>
                  </div>
                  <button onClick={() => copy(link.tracking_url)}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60">
                    <Copy size={13} />
                  </button>
                  <button onClick={() => copy(`<a href="${link.tracking_url}">${link.label}</a>`)}
                    className="text-xs px-2 py-1 rounded-lg bg-white/8 text-white/40 hover:text-white/60">
                    HTML
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Postback URL */}
        <div className="mt-4 rounded-2xl bg-white/4 border border-white/8 p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-2">Postback URL (Conversion Tracking)</h3>
          <p className="text-xs text-white/40 mb-3">
            Add this postback URL in your affiliate network's settings to track conversions:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[#0a0e1a] rounded-lg px-3 py-2 text-xs text-yellow-300 mono break-all">
              {(import.meta.env.VITE_API_URL || 'http://localhost:3001')}/c/postback?program_id=PROGRAM_ID&transaction_id=TRANSACTION_ID&amount=AMOUNT&commission=COMMISSION
            </code>
            <button onClick={() => copy(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/c/postback?program_id=PROGRAM_ID&transaction_id=TRANSACTION_ID&amount=AMOUNT&commission=COMMISSION`)}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60">
              <Copy size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
