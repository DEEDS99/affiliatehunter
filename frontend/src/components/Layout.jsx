import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Search, ListChecks, Link2,
  BarChart3, Settings, Code2, Zap, Radio, Circle
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const nav = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  live: true },
  { to: '/discover',   icon: Search,          label: 'Discover' },
  { to: '/programs',   icon: ListChecks,      label: 'Programs' },
  { to: '/links',      icon: Link2,           label: 'Links & Tracking' },
  { to: '/analytics',  icon: BarChart3,       label: 'Analytics' },
  { to: '/snippet',    icon: Code2,           label: 'Website Snippet' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
]

export default function Layout() {
  const [liveEvents, setLiveEvents] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket', 'polling'] })
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('click', (data) => {
      setLiveEvents(prev => [data, ...prev].slice(0, 20))
      toast.success(`💰 Click: ${data.program_name} (${data.country})`, { duration: 2500, position: 'bottom-right' })
    })

    socket.on('conversion', (data) => {
      toast.success(`🎉 Conversion! +$${data.commission?.toFixed(2)}`, {
        duration: 5000, position: 'bottom-right',
        style: { background: '#16a34a', color: '#fff' },
      })
    })

    socket.on('program_found', (data) => {
      toast(`🔍 Found: ${data.name} (score: ${data.score})`, { duration: 2000, position: 'bottom-left' })
    })

    socket.on('join_complete', (data) => {
      toast(data.success ? `✅ Applied: ${data.name}` : `⚠️ Manual needed: ${data.name}`, {
        duration: 4000, position: 'bottom-right',
      })
    })

    return () => socket.disconnect()
  }, [])

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-white overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .glow-green { box-shadow: 0 0 20px rgba(16,185,129,0.15); }
        .glow-blue  { box-shadow: 0 0 20px rgba(99,102,241,0.15); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* Sidebar */}
      <aside className="w-56 bg-[#0d1223] border-r border-white/5 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <Zap size={15} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white">AffiliateHunter</h1>
              <p className="text-xs text-white/30">Auto-earn engine</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, live }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`
            }>
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {live && <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />}
            </NavLink>
          ))}
        </nav>

        {/* Live feed preview */}
        {liveEvents.length > 0 && (
          <div className="p-2 border-t border-white/5">
            <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
              <Radio size={11} className="text-emerald-400" />
              <span className="text-xs text-white/30 uppercase tracking-wider">Live</span>
            </div>
            <div className="space-y-1">
              {liveEvents.slice(0, 3).map((e, i) => (
                <div key={i} className={`px-2 py-1 rounded-md ${i === 0 ? 'bg-emerald-500/10' : ''}`}>
                  <p className="text-xs text-white/70 truncate">{e.program_name}</p>
                  <p className="text-xs text-white/30">{e.country} · {e.device}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connection status */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Circle size={6} className={connected ? 'fill-emerald-400 text-emerald-400' : 'fill-gray-600 text-gray-600'} />
            <span className="text-xs text-white/30">{connected ? 'Real-time connected' : 'Connecting...'}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>

      <Toaster />
    </div>
  )
}
