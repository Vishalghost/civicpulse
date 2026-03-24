import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      initAuth: () => {
        const token = localStorage.getItem('cp_token')
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            set({ token, user: payload })
          } catch { set({ token: null, user: null }) }
        }
      },

      sendOtp: async (phone) => {
        set({ loading: true, error: null })
        try {
          await api.post('/auth/otp-send', { phone })
          set({ loading: false })
          return true
        } catch (e) {
          set({ loading: false, error: e.response?.data?.error || 'OTP send failed' })
          return false
        }
      },

      verifyOtp: async (phone, otp, role) => {
        set({ loading: true, error: null })
        try {
          const { data } = await api.post('/auth/otp-verify', { phone, otp, role })
          localStorage.setItem('cp_token', data.token)
          set({ token: data.token, user: data.user, loading: false })
          return data.user
        } catch (e) {
          set({ loading: false, error: e.response?.data?.error || 'OTP verify failed' })
          return null
        }
      },

      logout: () => {
        localStorage.removeItem('cp_token')
        set({ user: null, token: null })
      },
    }),
    { name: 'cp-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)

export default useAuthStore
