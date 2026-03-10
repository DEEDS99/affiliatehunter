import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { programsApi, joinApi } from '../services/api'
import toast from 'react-hot-toast'
import { ListChecks, Filter, Zap, ExternalLink, Loader2, ChevronRight, Star } from 'lucide-react'

const STATUS_COLORS = {
  discovered: 'bg-gray-500/20 text-gray-400',
  applied:    'bg-blue-500/20 text-blue-400',
  approved:   'bg-purple-500/20 text-purple-400',
  active:     'bg-emerald-500/20 text-emerald-400',
  rejected:   'bg-red-500/20 text-red-400',
  paused:     'bg-yellow-500/20 text-yellow-400',
  join_failed:'bg-orange-500/20 text-orange-400',
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-blue-400' : score >= 30 ? 'text-yellow-400' : 'text-gray-500'
  return <span className={`font-bold mono text-sm ${color}`}>{score}</span>
}

function CommissionBadge({ type, rate, flat }) {
  if (type === 'flat' && flat > 0) return <span className="text-yellow-400 text-xs font-medium mono">${flat}/sale</span>
  if (rate > 0) return (
    <span className={`text-xs font-medium mono ${type === 'recurring' ? 'text-purple-400' : 'text-emerald-400'}`}>
      {(rate * 100).toFixed(0)}%{type === 'recurring' ? ' rec.' : ''}
    </span>
  )
  return <span className="text-white/20 text-xs">unknown</span>
}

export default function ProgramsPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [joiningId, setJoiningId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['programs', status],
    queryFn: () => programsApi.list({ status: status || undefined, limit: 200 }).then(r => r.data),
    refetchInterval: 8000,
  })

  const joinMutation = useMutation({
    mutationFn: (id) => joinApi.join(id, {}).then(r => r.data),
    onMutate: (id) => setJoiningId(id),
    onSuccess: (_, id) => {
      setJoiningId(null)
      toast.success('Auto-join started! Watch the sidebar for updates.')
      qc.invalidateQueries(['programs'])
    },
    onError: (e) => { setJoiningId(null); toast.error(e.response?.data?.error || 'Join failed') },
  })

  const bulkJoin = useMutation({
    mutationFn: () => joinApi.bulk([...selected]).then(r => r.data),
    onSuccess: (d) => { toast.success(`Queued ${d.count} programs for auto-join!`); setSelected(new Set()) },
    onError: (e) => toast.error(e.response?.data?.error || 'Bulk join failed'),
  })

  const toggleSelect = (id) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const programs = data?.programs || []

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ListChecks size={18} className="text-purple-400" /> Programs
            </h1>
            <p className="text-xs text-white/30 mt-0.5">{data?.total || 0} programs found</p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button onClick={() => bulkJoin.mutate()} disabled={bulkJoin.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold disabled:opacity-50">
                {bulkJoin.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Auto-Join {selected.size} Selected
              </button>
            )}
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none">
              <option value="" className="bg-[#0d1223]">All status</option>
              {Object.keys(STATUS_COLORS).map(s => (
                <option key={s} value={s} className="bg-[#0d1223] capitalize">{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(programs.map(p=>p.id)) : new Set())}
                      className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Commission</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Network</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Cookie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Clicks</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading && (
                  <tr><td colSpan={9} className="text-center py-12 text-white/20">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    Loading programs...
                  </td></tr>
                )}
                {!isLoading && programs.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-white/20 text-sm">
                    No programs yet — go to Discover to find some
                  </td></tr>
                )}
                {programs.map(p => (
                  <tr key={p.id} className={`hover:bg-white/3 transition-colors cursor-pointer ${selected.has(p.id) ? 'bg-white/5' : ''}`}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3" onClick={() => nav(`/programs/${p.id}`)}>
                      <ScoreBadge score={p.score} />
                    </td>
                    <td className="px-4 py-3 max-w-48" onClick={() => nav(`/programs/${p.id}`)}>
                      <p className="text-sm text-white/80 font-medium truncate">{p.name}</p>
                      <p className="text-xs text-white/30 truncate">{p.niche}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CommissionBadge type={p.commission_type} rate={p.commission_rate} flat={p.commission_flat} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-white/50">{p.network || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-white/50 mono">{p.cookie_days}d</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-emerald-400 mono">{p.click_count || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-white/10 text-white/40'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'discovered' && (
                          <button onClick={() => joinMutation.mutate(p.id)} disabled={joiningId === p.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-1">
                            {joiningId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                            Join
                          </button>
                        )}
                        {p.join_url && (
                          <a href={p.join_url} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <button onClick={() => nav(`/programs/${p.id}`)}
                          className="p-1 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60">
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
