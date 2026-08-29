import { useEffect, useState } from 'react'
import { checkPanelUsername } from '../lib/panelApi'

const USERNAME_PATTERN = /^[a-z]+$/

export type UsernameCheckState = {
  status: 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'
  text: string | null
  isAvailable: boolean
  isChecking: boolean
}

export function usePanelUsernameCheck(rawUsername: string): UsernameCheckState {
  const [state, setState] = useState<UsernameCheckState>({
    status: 'idle',
    text: null,
    isAvailable: false,
    isChecking: false,
  })

  useEffect(() => {
    const username = rawUsername.trim().toLowerCase()

    if (!username) {
      setState({
        status: 'idle',
        text: null,
        isAvailable: false,
        isChecking: false,
      })
      return
    }

    if (!USERNAME_PATTERN.test(username)) {
      setState({
        status: 'invalid',
        text: 'فقط حروف انگلیسی کوچک (a-z)',
        isAvailable: false,
        isChecking: false,
      })
      return
    }

    if (username.length < 3) {
      setState({
        status: 'invalid',
        text: 'حداقل ۳ کاراکتر',
        isAvailable: false,
        isChecking: false,
      })
      return
    }

    if (username.length > 32) {
      setState({
        status: 'invalid',
        text: 'حداکثر ۳۲ کاراکتر',
        isAvailable: false,
        isChecking: false,
      })
      return
    }

    setState({
      status: 'checking',
      text: 'در حال بررسی…',
      isAvailable: false,
      isChecking: true,
    })

    let active = true
    const timer = setTimeout(async () => {
      try {
        const res = await checkPanelUsername(username)
        if (!active) return

        if (res.available) {
          setState({
            status: 'available',
            text: res.message || 'این یوزرنیم قابل ثبت است',
            isAvailable: true,
            isChecking: false,
          })
        } else {
          setState({
            status: 'unavailable',
            text: res.reason || 'این یوزرنیم قبلاً انتخاب شده، نام دیگری ثبت کنید',
            isAvailable: false,
            isChecking: false,
          })
        }
      } catch {
        if (!active) return
        setState({
          status: 'unavailable',
          text: 'خطا در استعلام یوزرنیم',
          isAvailable: false,
          isChecking: false,
        })
      }
    }, 200)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [rawUsername])

  return state
}
