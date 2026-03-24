import { create } from 'zustand'
import api from '../utils/api'
import { getDB } from '../db/localDB'

const useReportStore = create((set, get) => ({
  reports: [],
  currentReport: null,
  loading: false,
  error: null,
  submitting: false,

  submitReport: async (reportData) => {
    set({ submitting: true, error: null })
    try {
      if (!navigator.onLine) {
        // Queue offline
        const db = await getDB()
        const offlineId = `offline-${Date.now()}`
        await db.put('sync_queue', {
          id: offlineId, type: 'report', data: reportData, createdAt: new Date().toISOString()
        })
        set({ submitting: false })
        return { queryId: offlineId, offline: true }
      }
      const { data } = await api.post('/reports', reportData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      set({ submitting: false })
      return data
    } catch (e) {
      set({ submitting: false, error: e.response?.data?.error || 'Submit failed' })
      return null
    }
  },

  fetchByQueryId: async (queryId) => {
    set({ loading: true, currentReport: null })
    try {
      const { data } = await api.get(`/reports/${queryId}`)
      set({ currentReport: data, loading: false })
      return data
    } catch (e) {
      set({ loading: false, error: 'Report not found' })
      return null
    }
  },

  fetchWardReports: async (wardId) => {
    set({ loading: true })
    try {
      const { data } = await api.get(`/reports/public/ward/${wardId}`)
      set({ reports: data.reports || [], loading: false })
      return data
    } catch (e) {
      set({ loading: false })
      return { reports: [] }
    }
  },

  rateReport: async (reportId, rating) => {
    try {
      await api.post(`/reports/${reportId}/rating`, { rating })
      return true
    } catch { return false }
  },
}))

export default useReportStore
