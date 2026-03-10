import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { settingsApi } from '../services/api'
import toast from 'react-hot-toast'
import { Settings, Save, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [form, setForm] = useState({})
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then(r => r.data),
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const saveMut = useMutation({
    mutationFn: () => settingsApi.patch(form).then(r => r.data),
    onSuccess: () => toast.success('Settings saved!'),
    onError: e => toast.error(e.message),
  })

  const field = (key, label, placeholder, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40" />
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-white/60" /> Settings
          </h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-white/4 border border-white/8 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white/70">Your Website</h3>
              {field('my_website_url', 'Website URL', 'https://yourwebsite.com')}
              {field('my_niche', 'Primary Niche', 'tech, finance, health...')}
            </div>

            <div className="rounded-2xl bg-white/4 border border-white/8 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white/70">Signup Details (for Auto-Join)</h3>
              {field('signup_email', 'Email Address', 'your@email.com', 'email')}
              {field('signup_name', 'Full Name', 'John Doe')}
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Auto-Join New Programs</label>
                <select value={form.auto_apply || 'false'} onChange={e => setForm(p => ({...p, auto_apply: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none">
                  <option value="false" className="bg-[#0d1223]">Manual only</option>
                  <option value="true"  className="bg-[#0d1223]">Auto-join all discovered programs</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-white/4 border border-white/8 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white/70">API Keys</h3>
              {field('gemini_key', 'Gemini API Key (AI enrichment)', 'AIza...')}
              {field('serpapi_key', 'SerpAPI Key (web search)', 'your-serpapi-key')}
              <p className="text-xs text-white/30">
                Without SerpAPI, the app falls back to DuckDuckGo (slower, fewer results).
                Without Gemini, programs are scored by basic rules only.
              </p>
            </div>

            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity">
              {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
