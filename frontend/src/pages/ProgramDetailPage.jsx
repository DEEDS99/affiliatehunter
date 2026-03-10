import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { programsApi, joinApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Zap, ExternalLink, Link2, Copy, Loader2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function ProgramDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [affLink, setAffLink] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)

  const { data: program, isLoading } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.get(id).then(r => r.data),
  })

  const joinMut = useMutation({
    mutationFn: () => joinApi.join(id, {}).then(r => r.data),
    onSuccess: () => { toast.success('Auto-join started!'); qc.invalidateQueries(['program', id]) },
    onError: e => toast.error(e.response?.data?.error || 'Join failed'),
  })

  const createLinkMut = useMutation({
    mutationFn: (dest) => programsApi.createLink(id, { destination_url: dest, label: program.name }).then(r => r.data),
    onSuccess: (d) => {
      toast.success('Tracking link created!')
      setShowLinkForm(false)
      navigator.clipboard.writeText(d.tracking_url).catch(() => {})
      qc.invalidateQueries(['program', id])
    },
    onError: e => toast.error(e.message),
  })

  const copyText = (t) => { navigator.clipboard.writeText(t); toast.success('Copied!') }

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-white/40" />
    </div>
  )

  if (!program) return (
    <div className="flex-1 flex items-center justify-center text-white/30">Program not found</div>
  )

  const trackingLinks = program.tracking_links?.filter(Boolean) || []

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-5 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="rounded-2xl bg-white/4 border border-white/8 p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-lg font-bold text-white">{program.name}</h1>
              <p className="text-sm text-white/40 mt-0.5">{program.url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {program.status === 'discovered' && (
                <button onClick={() => joinMut.mutate()} disabled={joinMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold disabled:opacity-50">
                  {joinMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  Auto-Join
                </button>
              )}
              <a href={program.join_url || program.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12">
                <ExternalLink size={13} /> Visit
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Score',      value: `${program.score}/100` },
              { label: 'Commission', value: program.commission_type === 'flat' ? `$${program.commission_flat}` : `${((program.commission_rate||0)*100).toFixed(0)}%` },
              { label: 'Type',       value: program.commission_type || '—' },
              { label: 'Cookie',     value: `${program.cookie_days} days` },
              { label: 'Network',    value: program.network || 'direct' },
              { label: 'Niche',      value: program.niche || '—' },
              { label: 'Clicks',     value: program.click_count || 0 },
              { label: 'Earned',     value: `$${parseFloat(program.total_earned||0).toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/4 rounded-xl p-3">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-semibold text-white mono">{value}</p>
              </div>
            ))}
          </div>

          {program.notes && (
            <div className="mt-4 p-3 rounded-xl bg-white/4 text-xs text-white/50 leading-relaxed">
              {program.notes}
            </div>
          )}
        </div>

        {/* Tracking links */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <Link2 size={14} /> Tracking Links
            </h3>
            <button onClick={() => setShowLinkForm(!showLinkForm)}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
              + New Link
            </button>
          </div>

          {showLinkForm && (
            <div className="px-5 py-3 border-b border-white/8 bg-white/3">
              <p className="text-xs text-white/40 mb-2">Paste your affiliate link from {program.name}:</p>
              <div className="flex gap-2">
                <input value={affLink} onChange={e => setAffLink(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none" />
                <button onClick={() => createLinkMut.mutate(affLink)} disabled={!affLink || createLinkMut.isPending}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/30 disabled:opacity-50">
                  {createLinkMut.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Create'}
                </button>
              </div>
            </div>
          )}

          {trackingLinks.length === 0 && (
            <div className="px-5 py-6 text-center text-white/20 text-xs">
              No tracking links yet — create one above after joining the program
            </div>
          )}
          {trackingLinks.map(link => (
            <div key={link.id} className="px-5 py-3 flex items-center gap-3 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70 font-medium">{link.label}</p>
                <p className="text-xs text-emerald-400 mono truncate">{API_URL}/c/{link.slug}</p>
              </div>
              <button onClick={() => copyText(`${API_URL}/c/${link.slug}`)}
                className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60">
                <Copy size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
