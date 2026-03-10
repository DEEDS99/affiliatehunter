import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, programsApi } from '../services/api'
import { io } from 'socket.io-client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, MousePointerClick, DollarSign, Target, Activity, Zap, ArrowUpRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function StatCard({ icon: Icon, label, value, sub, color = 'emerald', flash }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/4 border border-white/8 p-5 transition-all duration-300 ${flash ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3`}
        style={{ background: color === 'emerald' ? '#10b98122' : color === 'blue' ? '#6366f122' : '#f59e0b22' }}>
        <Icon size={18} style={{ color: color === 'emerald' ? '#10b981' : color === 'blue' ? '#818cf8' : '#fbbf24' }} />
      </div>
      <p className="text-2xl font-bold text-white mono">{value ?? '—'}</p>
      <p className="text-xs text-white/40 mt-1 font-medium uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-emerald-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [liveClicks, setLiveClicks] = useState([])
  const [flashStats, setFlashStats] = useState(false)

  const { data: summary, refetch } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.summary().then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: clicksData } = useQuery({
    queryKey: ['analytics-clicks'],
    queryFn: () => analyticsApi.clicks(14).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: topPrograms } = useQuery({
    queryKey: ['programs-analytics'],
    queryFn: () => analyticsApi.programs().then(r => r.data),
  })

  useEffect(() => {
    const socket = io(API_URL)
    socket.on('click', (data) => {
      setLiveClicks(p => [{ ...data, id: Date.now() }, ...p].slice(0, 30))
      setFlashStats(true)
      setTimeout(() => setFlashStats(false), 800)
      refetch()
    })
    return () => socket.disconnect()
  }, [])

  const chartData = (clicksData?.data || []).map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    clicks: parseInt(d.clicks),
    unique: parseInt(d.unique_clicks),
  }))

  const c = summary?.clicks || {}
  const cv = summary?.conversions || {}
  const p = summary?.programs || {}

  const epc = c.total_clicks > 0 && cv.total_earned > 0
    ? (cv.total_earned / c.total_clicks).toFixed(3)
    : '0.000'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap size={18} className="text-emerald-400" /> Dashboard
            </h1>
            <p className="text-xs text-white/30 mt-0.5">Real-time affiliate performance</p>
          </div>
          {flashStats && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 animate-bounce">
              <Activity size={12} /> Live click!
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={MousePointerClick} label="Clicks Today"
            value={parseInt(c.clicks_today || 0).toLocaleString()}
            sub={`${parseInt(c.clicks_week || 0).toLocaleString()} this week`}
            color="emerald" flash={flashStats} />
          <StatCard icon={DollarSign} label="Total Earned"
            value={`$${parseFloat(cv.total_earned || 0).toFixed(2)}`}
            sub={`${cv.total_conversions || 0} conversions`}
            color="yellow" />
          <StatCard icon={Target} label="Active Programs"
            value={p.active || 0}
            sub={`${p.applied || 0} pending approval`}
            color="blue" />
          <StatCard icon={TrendingUp} label="EPC"
            value={`$${epc}`}
            sub="Earnings per click"
            color="emerald" />
        </div>

        {/* Chart + Live feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 rounded-2xl bg-white/4 border border-white/8 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Clicks — Last 14 Days</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1223', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#10b981" fill="url(#clickGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-white/20 text-sm">
                No clicks yet — add tracking links to your website
              </div>
            )}
          </div>

          {/* Live click feed */}
          <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
              <Activity size={13} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white/80">Live Clicks</span>
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="divide-y divide-white/5 max-h-52 overflow-y-auto">
              {liveClicks.length === 0 ? (
                <div className="p-4 text-center text-white/20 text-xs">Waiting for clicks...</div>
              ) : liveClicks.map((e, i) => (
                <div key={e.id} className={`px-4 py-2.5 ${i === 0 ? 'bg-emerald-500/5' : ''}`}>
                  <p className="text-xs font-medium text-white/80 truncate">{e.program_name}</p>
                  <p className="text-xs text-white/30">{e.country} · {e.device} · {e.referrer || 'direct'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top programs by clicks */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/80">Top Programs</h3>
            <span className="text-xs text-white/30">by clicks</span>
          </div>
          <div className="divide-y divide-white/5">
            {(topPrograms?.programs || []).slice(0, 8).map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium truncate">{p.name}</p>
                  <p className="text-xs text-white/30">{p.network} · {p.niche}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-400 mono">{p.clicks}</p>
                  <p className="text-xs text-white/30">clicks</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-yellow-400 mono">${parseFloat(p.earned || 0).toFixed(2)}</p>
                  <p className="text-xs text-white/30">earned</p>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  p.status === 'applied' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-white/10 text-white/40'
                }`}>{p.status}</div>
              </div>
            ))}
            {(!topPrograms?.programs?.length) && (
              <div className="px-5 py-8 text-center text-white/20 text-sm">
                No programs yet — go to Discover to find affiliate programs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
