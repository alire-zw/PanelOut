import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  readThemeMode,
  resolveColorScheme,
  setAutoThemeRefreshHandler,
  writeThemeMode,
  type ColorScheme,
  type ThemeMode,
} from '../lib/theme'
import { applyAppTheme } from '../lib/telegramTheme'

type ThemeContextValue = {
  themeMode: ThemeMode
  colorScheme: ColorScheme
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readThemeMode())
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() =>
    resolveColorScheme(readThemeMode()),
  )

  const applyTheme = useCallback((mode: ThemeMode) => {
    const scheme = resolveColorScheme(mode)
    setColorScheme(scheme)
    applyAppTheme(scheme)
  }, [])

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      writeThemeMode(mode)
      setThemeModeState(mode)
      applyTheme(mode)
    },
    [applyTheme],
  )

  useEffect(() => {
    applyTheme(themeMode)
  }, [themeMode, applyTheme])

  useEffect(() => {
    if (themeMode !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [themeMode, applyTheme])

  useEffect(() => {
    setAutoThemeRefreshHandler(() => {
      if (readThemeMode() !== 'auto') return
      applyTheme('auto')
    })
    return () => setAutoThemeRefreshHandler(null)
  }, [applyTheme])

  const value = useMemo(
    () => ({
      themeMode,
      colorScheme,
      setThemeMode,
    }),
    [themeMode, colorScheme, setThemeMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
