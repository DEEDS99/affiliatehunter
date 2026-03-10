import axios from 'axios'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api',
  timeout: 30000,
})

export default api

export const searchApi = {
  start:   (keyword, niche, enrich) => api.post('/search', { keyword, niche, enrich }),
  jobs:    ()     => api.get('/search/jobs'),
  job:     (id)   => api.get(`/search/jobs/${id}`),
}

export const programsApi = {
  list:    (params) => api.get('/programs', { params }),
  get:     (id)     => api.get(`/programs/${id}`),
  patch:   (id, d)  => api.patch(`/programs/${id}`, d),
  delete:  (id)     => api.delete(`/programs/${id}`),
  stats:   ()       => api.get('/programs/stats/summary'),
  createLink: (id, d) => api.post(`/programs/${id}/tracking-link`, d),
}

export const joinApi = {
  join:    (id, d)  => api.post(`/join/${id}`, d),
  bulk:    (ids)    => api.post('/join/bulk', { programIds: ids }),
}

export const analyticsApi = {
  summary:   ()      => api.get('/analytics/summary'),
  clicks:    (days)  => api.get('/analytics/clicks', { params: { days } }),
  programs:  ()      => api.get('/analytics/programs'),
  geo:       ()      => api.get('/analytics/geo'),
  referrers: ()      => api.get('/analytics/referrers'),
}

export const settingsApi = {
  get:     ()  => api.get('/settings'),
  patch:   (d) => api.patch('/settings', d),
  snippet: ()  => api.get('/settings/snippet'),
}
