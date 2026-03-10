import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../services/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { BarChart3, Globe, Monitor, Smartphone } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const COLORS = ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)

  const { data: summary } = useQuery({ queryKey: ['analytics-summary'], queryFn: () => analyticsApi.summary().then(r => r.data) })
  const { data: clicks }  = useQuery({ queryKey: ['analytics-clicks', days], queryFn: () => analyticsApi.clicks(days).then(r => r.data) })
  const { data: geo }     = useQuery({ queryKey: ['analytics-geo'], queryFn: () => analyticsApi.geo().then(r => r.data) })
  const { data: refs }    = useQuery({ queryKey: ['analytics-refs'], queryFn: () => analyticsApi.referrers().then(r => r.data) })
  const { data: progs }   = useQuery({ queryKey: ['analytics-programs'], queryFn: () => analyticsApi.programs().then(r => r.data) })

  const chartData = (clicks?.data || []).map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    clicks: parseInt(d.clicks),
    unique: parseInt(d.unique_clicks),
    mobile: parseInt(d.mobile),
    desktop: parseInt(d.desktop),
  }))

  const geoData  = (geo?.data  || []).slice(0, 8)
  const refData  = (refs?.data || []).slice(0, 8)
  const progData = (progs?.programs || []).filter(p => p.clicks > 0).slice(0, 10)

  const c  = summary?.clicks      || {}
  const cv = summary?.conversions || {}

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 size={18} className="text-yellow-400" /> Analytics
            </h1>
            <p className="text-xs text-white/30 mt-0.5">Clicks, conversions & earnings</p>
          </div>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none">
            {[7, 14, 30, 60, 90].map(d => (
              <option key={d} value={d} className="bg-[#0d1223]">Last {d} days</option>
            ))}
          </select>
        </div>

        {/* Click trend */}
        <div className="rounded-2xl bg-white/4 border border-white/8 p-5 mb-4">
          <h3 className="text-sm font-semibold text-white/70 mb-4">Clicks Over Time</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1223', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="clicks" stroke="#10b981" fill="url(#g1)" strokeWidth={2} name="All Clicks" />
                <Area type="monotone" dataKey="unique" stroke="#6366f1" fill="url(#g2)" strokeWidth={2} name="Unique" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-white/20 text-sm">No click data yet</div>
          )}
        </div>

        {/* Geo + Referrers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
              <Globe size={13} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-white/70">Top Countries</h3>
            </div>
            <div className="p-4">
              {geoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={geoData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="country" type="category" tick={{ fontSize: 11, fill: '#ffffff60' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ background: '#0d1223', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="clicks" fill="#6366f1" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-36 flex items-center justify-center text-white/20 text-xs">No geo data</div>}
            </div>
          </div>

          <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8">
              <h3 className="text-sm font-semibold text-white/70">Top Referrers</h3>
            </div>
            <div className="divide-y divide-white/5">
              {refData.length === 0 && (
                <div className="py-8 text-center text-white/20 text-xs">No referrer data</div>
              )}
              {refData.map((r, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{ background: COLORS[i % COLORS.length] + '33', color: COLORS[i % COLORS.length] }}>
                    {i + 1}
                  </div>
                  <p className="flex-1 text-xs text-white/70 truncate">{r.referrer}</p>
                  <p className="text-xs font-semibold text-white/60 mono">{r.clicks}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Per-program table */}
        <div className="rounded-2xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/8">
            <h3 className="text-sm font-semibold text-white/70">Program Performance</h3>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-white/8">
              {['Program','Network','Clicks','Conversions','Conv. Rate','Earned'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-white/30 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {progData.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-white/20 text-sm">No data yet</td></tr>
              )}
              {progData.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm text-white/70">{p.name}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{p.network}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 mono font-semibold">{p.clicks}</td>
                  <td className="px-4 py-3 text-sm text-blue-400 mono">{p.conversions}</td>
                  <td className="px-4 py-3 text-sm text-white/60 mono">{p.conversion_rate}%</td>
                  <td className="px-4 py-3 text-sm text-yellow-400 mono font-semibold">${parseFloat(p.earned||0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
