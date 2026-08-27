import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { KycResumeState } from '../types/kycFlow'

/** Legacy OTP route — merges into the phone page. */
export function StarsKycOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as KycResumeState | null

  useEffect(() => {
    navigate('/stars/kyc/phone', {
      replace: true,
      state: state
        ? {
            ...state,
            otpResendSeconds: state.otpResendSeconds ?? 120,
          }
        : null,
    })
  }, [navigate, state])

  return null
}
