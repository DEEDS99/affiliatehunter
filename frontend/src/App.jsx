import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import DiscoverPage from './pages/DiscoverPage'
import ProgramsPage from './pages/ProgramsPage'
import ProgramDetailPage from './pages/ProgramDetailPage'
import LinksPage from './pages/LinksPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import SnippetPage from './pages/SnippetPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<DashboardPage />} />
        <Route path="discover"       element={<DiscoverPage />} />
        <Route path="programs"       element={<ProgramsPage />} />
        <Route path="programs/:id"   element={<ProgramDetailPage />} />
        <Route path="links"          element={<LinksPage />} />
        <Route path="analytics"      element={<AnalyticsPage />} />
        <Route path="snippet"        element={<SnippetPage />} />
        <Route path="settings"       element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
