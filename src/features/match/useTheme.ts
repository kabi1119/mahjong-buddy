import { useEffect, useSyncExternalStore } from 'react'
import type { ThemePreference } from './rules'
const query = '(prefers-color-scheme: dark)'
const subscribe = (notify: () => void) => { const media = window.matchMedia?.(query); media?.addEventListener?.('change', notify); return () => media?.removeEventListener?.('change', notify) }
const snapshot = () => window.matchMedia?.(query).matches ?? false
export function useTheme(preference: ThemePreference = 'system', ready = true) {
  const systemDark = useSyncExternalStore(subscribe, snapshot, () => false)
  const theme = preference === 'system' ? systemDark ? 'dark' : 'light' : preference
  useEffect(() => {
    if (!ready) return
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14261f' : '#e6e9e3')
    try { localStorage.setItem('mahjong-buddy:theme', preference) } catch { /* IndexedDB remains authoritative; this is only a pre-paint hint. */ }
  }, [theme, preference, ready])
  return theme
}
