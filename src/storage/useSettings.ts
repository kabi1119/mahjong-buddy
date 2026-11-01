import { useEffect, useRef, useState } from 'react'
import { defaultSettings, loadSettings, saveSettings } from './settings'
import type { Settings } from './settings'

type StorageStatus = 'loading' | 'saved' | 'saving' | 'unavailable' | 'error'

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings)
  const [status, setStatus] = useState<StorageStatus>('loading')
  const current = useRef(settings)
  const ready = useRef(false)
  const writable = useRef(false)
  const mounted = useRef(false)
  const queue = useRef(Promise.resolve())
  const revision = useRef(0)

  useEffect(() => {
    let cancelled = false
    mounted.current = true
    loadSettings().then((restored) => {
      if (cancelled) return
      current.current = restored
      setSettings(restored)
      writable.current = true
      ready.current = true
      setStatus('saved')
    }).catch(() => {
      if (cancelled) return
      // A failed read must never be followed by writes over unknown saved data.
      ready.current = true
      setStatus('unavailable')
    })
    return () => { cancelled = true; mounted.current = false }
  }, [])

  function updateSettings(update: (previous: Settings) => Settings) {
    if (!ready.current) return
    const next = update(current.current)
    current.current = next
    setSettings(next)
    if (!writable.current) return
    const latest = ++revision.current
    setStatus('saving')
    // Serialize writes so rapid edits/mode changes cannot finish out of order.
    queue.current = queue.current.then(() => saveSettings(next)).then(() => {
      if (mounted.current && revision.current === latest) setStatus('saved')
    }).catch(() => {
      if (mounted.current && revision.current === latest) setStatus('error')
    })
  }

  return { settings, status, updateSettings }
}
