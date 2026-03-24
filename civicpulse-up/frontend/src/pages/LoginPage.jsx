import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'

const ROLES = [
  { id: 'citizen', emoji: '🏙️', label: 'नागरिक', sub: 'Citizen' },
  { id: 'worker', emoji: '🧹', label: 'कर्मचारी', sub: 'Field Worker' },
  { id: 'official', emoji: '🏛️', label: 'अधिकारी', sub: 'Official' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { sendOtp, verifyOtp, loading, error } = useAuthStore()

  const [step, setStep] = useState('role') // role | phone | otp
  const [selectedRole, setSelectedRole] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')

  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setStep('phone')
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('सही मोबाइल नंबर दर्ज करें')
      return
    }
    const ok = await sendOtp(phone)
    if (ok) {
      toast.success('OTP भेजा गया (Demo: 123456)')
      setStep('otp')
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const user = await verifyOtp(phone, otp, selectedRole)
    if (user) {
      toast.success(`स्वागत है! / Welcome!`)
      navigate(`/${user.role}`)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #1A73E8 0%, #1557B0 50%, #0D3A7A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
          <h1 style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 700 }}>CivicPulse UP</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>नगरीय स्वास्थ्य मंच</p>
        </div>

        {/* Step: Role Selection */}
        {step === 'role' && (
          <div>
            <p style={{ fontWeight: 600, marginBottom: '1rem', textAlign: 'center' }}>आप कौन हैं? / Select your role</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ROLES.map(r => (
                <button key={r.id} className="pictogram-btn" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: '1rem', padding: '1rem 1.25rem', minHeight: 'auto' }}
                  onClick={() => handleRoleSelect(r.id)}>
                  <span style={{ fontSize: '1.75rem' }}>{r.emoji}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>{r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Phone */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp}>
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('role')}>← वापस</button>
            </div>
            <div className="form-group">
              <label className="form-label">{t('enter_phone')}</label>
              <input className="form-input" type="tel" placeholder="10-digit mobile number"
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0,10))}
                autoFocus maxLength={10} />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading || phone.length !== 10}>
              {loading ? '...' : t('send_otp')}
            </button>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>
              Demo: Any 10-digit number, OTP = <strong>123456</strong>
            </p>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('phone')}>← वापस</button>
            </div>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              {phone} पर OTP भेजा गया
            </p>
            <div className="form-group">
              <label className="form-label">{t('enter_otp')}</label>
              <input className="form-input" type="number" placeholder="123456"
                value={otp} onChange={e => setOtp(e.target.value.slice(0,6))}
                autoFocus maxLength={6} style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.3em' }} />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="btn btn-success btn-full" disabled={loading || otp.length < 4}>
              {loading ? '...' : t('verify_otp')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
