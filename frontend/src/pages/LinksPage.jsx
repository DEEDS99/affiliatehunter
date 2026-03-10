import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../services/api'
import toast from 'react-hot-toast'
import { Link2, Copy, MousePointerClick, ExternalLink } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function LinksPage() {
  const { data } = useQuery({
    queryKey: ['analytics-programs'],
    queryFn: () => analyticsApi.programs().then(r => r.data),
    refetchInterval: 10000,
  })

  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.summary().then(r => r.data),
  })

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  const topLinks = summary?.top_links || []

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 size={18} className="text-blue-400" /> Links & Tracking
          </h1>
          <p className="text-xs text-white/30 mt-0.5">
            All your /c/:slug redirect links — put these on your website
          </p>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 mb-5 text-xs text-blue-300/70 space-y-1">
          <p className="font-semibold text-blue-300">How click-back tracking works:</p>
          <p>1. Get a tracking link: <span className="mono bg-white/10 px-1.5 py-0.5 rounded">{API_URL}/c/your-slug</span></p>
          <p>2. Put that link on your website (anywhere you'd normally link to the affiliate)</p>
          <p>3. When a visitor clicks it → we log the click → redirect them to the affiliate</p>
          <p>4. If they buy → you earn commission → shows up in your dashboard</p>
        </div>

        {/* Top links table */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/70">Active Tracking Links</h3>
            <span className="text-xs text-white/30">{topLinks.length} links</span>
          </div>
          <div className="divide-y divide-white/5">
            {topLinks.length === 0 ? (
              <div className="px-5 py-10 text-center text-white/20 text-sm">
                No active links yet — join programs first, then create tracking links
              </div>
            ) : topLinks.map((link, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium">{link.label || link.program_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-emerald-400 mono">{API_URL}/c/{link.slug}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-400 mono">{link.clicks}</p>
                  <p className="text-xs text-white/30">clicks</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/40">{((link.commission_rate||0)*100).toFixed(0)}%</p>
                  <p className="text-xs text-white/30">{link.commission_type}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copy(`${API_URL}/c/${link.slug}`)}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60" title="Copy link">
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HTML snippet for each link */}
        {topLinks.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white/4 border border-white/8 p-5">
            <h3 className="text-sm font-semibold text-white/70 mb-3">HTML Link Examples</h3>
            <div className="space-y-2">
              {topLinks.slice(0, 5).map((link, i) => {
                const html = `<a href="${API_URL}/c/${link.slug}">${link.label || link.program_name}</a>`
                return (
                  <div key={i} className="flex items-center gap-2">
                    <code className="flex-1 bg-[#0a0e1a] rounded-lg px-3 py-2 text-xs text-emerald-300 mono truncate">
                      {html}
                    </code>
                    <button onClick={() => copy(html)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60">
                      <Copy size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
