import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { searchApi } from '../services/api'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { Search, Loader2, Zap, CheckCircle2, AlertCircle, Play } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const NICHES = ['general','tech','finance','health','fitness','travel','education',
                'software','crypto','e-commerce','marketing','lifestyle','gaming','beauty']

const QUICK_SEARCHES = [
  'SaaS tools', 'web hosting', 'VPN services', 'online courses',
  'credit cards', 'fitness supplements', 'email marketing', 'project management',
  'antivirus software', 'stock trading', 'language learning', 'cloud storage',
]

export default function DiscoverPage() {
  const [keyword, setKeyword]   = useState('')
  const [niche, setNiche]       = useState('tech')
  const [enrich, setEnrich]     = useState(true)
  const [activeJob, setActiveJob] = useState(null)
  const [logs, setLogs]         = useState([])

  const { data: jobs, refetch: refetchJobs } = useQuery({
    queryKey: ['scan-jobs'],
    queryFn: () => searchApi.jobs().then(r => r.data.jobs),
    refetchInterval: 3000,
  })

  const searchMutation = useMutation({
    mutationFn: () => searchApi.start(keyword, niche, enrich).then(r => r.data),
    onSuccess: (data) => {
      setActiveJob(data.job_id)
      setLogs([`🔍 Search started for "${keyword}" in ${niche}...`])
      refetchJobs()
      toast.success('Search started!')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Search failed'),
  })

  useEffect(() => {
    const socket = io(API_URL)
    socket.on('scan_started',  (d) => addLog(`🚀 Scanning for "${d.keyword}" in ${d.niche}...`))
    socket.on('scan_progress', (d) => {
      if (d.stage === 'found')      addLog(`📋 Found ${d.count} programs, analysing...`)
      if (d.stage === 'enriching')  addLog(`🤖 AI enriching: ${d.name}`)
    })
    socket.on('program_found', (d) => addLog(`✅ Saved: ${d.name} (score: ${d.score}/100)`))
    socket.on('scan_complete', (d) => {
      addLog(`🎉 Done! Found ${d.found}, saved ${d.saved} new programs`)
      setActiveJob(null)
      refetchJobs()
      toast.success(`Found ${d.saved} programs!`)
    })
    socket.on('scan_error', (d) => {
      addLog(`❌ Error: ${d.error}`)
      setActiveJob(null)
    })
    return () => socket.disconnect()
  }, [])

  const addLog = (msg) => setLogs(p => [`${new Date().toLocaleTimeString()} — ${msg}`, ...p].slice(0, 40))

  const runSearch = () => {
    if (!keyword.trim()) return toast.error('Enter a keyword')
    setLogs([])
    searchMutation.mutate()
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Search size={18} className="text-blue-400" /> Discover Programs
          </h1>
          <p className="text-xs text-white/30 mt-0.5">
            AI-powered search finds, scores, and organises affiliate programs for your niche
          </p>
        </div>

        {/* Search box */}
        <div className="rounded-2xl bg-white/4 border border-white/8 p-5 mb-4">
          <div className="flex gap-3 mb-4">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="e.g. web hosting, VPN, fitness supplements..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/8"
            />
            <select value={niche} onChange={e => setNiche(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none capitalize">
              {NICHES.map(n => <option key={n} value={n} className="bg-[#0d1223]">{n}</option>)}
            </select>
            <button onClick={runSearch} disabled={searchMutation.isPending || !!activeJob}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
              {searchMutation.isPending || activeJob
                ? <><Loader2 size={15} className="animate-spin" /> Scanning...</>
                : <><Zap size={15} /> Search</>}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer">
              <input type="checkbox" checked={enrich} onChange={e => setEnrich(e.target.checked)}
                className="rounded" />
              AI-enrich results (Gemini)
            </label>
          </div>
        </div>

        {/* Quick searches */}
        <div className="mb-5">
          <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Quick searches</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map(q => (
              <button key={q} onClick={() => { setKeyword(q); setNiche('tech') }}
                className="px-3 py-1 rounded-lg bg-white/5 border border-white/8 text-xs text-white/50 hover:text-white/80 hover:bg-white/8 transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Live log */}
        {logs.length > 0 && (
          <div className="rounded-xl bg-[#0a0e1a] border border-white/8 p-4 mb-4 font-mono">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/40 uppercase tracking-wider">Scan log</span>
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {logs.map((l, i) => (
                <p key={i} className={`text-xs ${i === 0 ? 'text-white/80' : 'text-white/35'}`}>{l}</p>
              ))}
            </div>
          </div>
        )}

        {/* Scan history */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/8">
            <h3 className="text-sm font-semibold text-white/70">Scan History</h3>
          </div>
          <div className="divide-y divide-white/5">
            {(!jobs || jobs.length === 0) && (
              <div className="px-5 py-8 text-center text-white/20 text-sm">
                No scans yet — run your first search above
              </div>
            )}
            {(jobs || []).map(job => (
              <div key={job.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{job.query}</p>
                  <p className="text-xs text-white/30">{new Date(job.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white/60 mono">{job.results_count}</p>
                  <p className="text-xs text-white/30">found</p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  job.status === 'done'    ? 'bg-emerald-500/20 text-emerald-400' :
                  job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                  job.status === 'failed'  ? 'bg-red-500/20 text-red-400' :
                  'bg-white/10 text-white/40'
                }`}>
                  {job.status === 'done'    && <CheckCircle2 size={11} />}
                  {job.status === 'running' && <Loader2 size={11} className="animate-spin" />}
                  {job.status === 'failed'  && <AlertCircle size={11} />}
                  {job.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
