import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/authStore'

// Auth
import LoginPage from './pages/LoginPage'

// Citizen
import CitizenLayout from './layouts/CitizenLayout'
import CitizenHome from './roles/citizen/CitizenHome'
import ReportForm from './roles/citizen/ReportForm'
import QueryStatus from './roles/citizen/QueryStatus'
import PublicBoard from './roles/citizen/PublicBoard'
import ChatbotWidget from './roles/citizen/ChatbotWidget'
import CitizenPinMap from './roles/citizen/CitizenPinMap'

// Worker
import WorkerLayout from './layouts/WorkerLayout'
import WorkerHome from './roles/worker/WorkerHome'
import VoiceLogger from './roles/worker/VoiceLogger'
import ActivityFeed from './roles/worker/ActivityFeed'
import GeoEvidence from './roles/worker/GeoEvidence'

// Official
import OfficialLayout from './layouts/OfficialLayout'
import OfficialHome from './roles/official/OfficialHome'
import WardMap from './roles/official/WardMap'
import SLATracker from './roles/official/SLATracker'
import EvidenceClosure from './roles/official/EvidenceClosure'
import WeeklyReport from './roles/official/WeeklyReport'

// Public
import PublicWardBoard from './pages/PublicWardBoard'
import LandingPage from './pages/LandingPage'
import SettingsPage from './pages/SettingsPage'

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (allowedRole && user.role !== allowedRole) return <Navigate to={`/${user.role}`} replace />
  return children
}

function App() {
  const { initAuth } = useAuthStore()
  useEffect(() => { initAuth() }, [initAuth])

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{
        duration: 3500,
        style: { fontFamily: 'Noto Sans, sans-serif', fontSize: '0.9rem', maxWidth: '340px' }
      }} />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/public/board/:wardId" element={<PublicWardBoard />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Citizen */}
        <Route path="/citizen" element={
          <ProtectedRoute allowedRole="citizen"><CitizenLayout /></ProtectedRoute>
        }>
          <Route index element={<CitizenHome />} />
          <Route path="report" element={<ReportForm />} />
          <Route path="status/:queryId" element={<QueryStatus />} />
          <Route path="board" element={<PublicBoard />} />
          <Route path="map" element={<CitizenPinMap />} />
          <Route path="chat" element={<ChatbotWidget />} />
        </Route>

        {/* Worker */}
        <Route path="/worker" element={
          <ProtectedRoute allowedRole="worker"><WorkerLayout /></ProtectedRoute>
        }>
          <Route index element={<WorkerHome />} />
          <Route path="log" element={<VoiceLogger />} />
          <Route path="activities" element={<ActivityFeed />} />
          <Route path="evidence" element={<GeoEvidence />} />
        </Route>

        {/* Official */}
        <Route path="/official" element={
          <ProtectedRoute allowedRole="official"><OfficialLayout /></ProtectedRoute>
        }>
          <Route index element={<OfficialHome />} />
          <Route path="map" element={<WardMap />} />
          <Route path="sla" element={<SLATracker />} />
          <Route path="close/:reportId" element={<EvidenceClosure />} />
          <Route path="weekly" element={<WeeklyReport />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
