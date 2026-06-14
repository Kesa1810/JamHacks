import { useEffect, useState } from 'react'

// Minimal typing — Wake Lock API isn't in older TS DOM libs and is missing on
// iOS Safari entirely. We feature-detect and degrade silently.
type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

/**
 * Keep the screen awake while `active` is true. Returns whether a wake lock is
 * currently held (false on unsupported browsers like iOS Safari — caller can
 * hide its indicator in that case).
 *
 * Wake locks are auto-released when the page is hidden (phone locks / tab
 * switch), so we re-acquire on `visibilitychange`.
 */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!active) return

    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock) return // unsupported (e.g. iOS Safari) — stay silent

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen')
        if (cancelled) {
          await lock.release().catch(() => {})
          return
        }
        sentinel = lock
        setHeld(true)
        lock.addEventListener?.('release', () => setHeld(false))
      } catch {
        // Permission denied / not allowed — continue without crashing.
        setHeld(false)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release().catch(() => {})
      sentinel = null
      setHeld(false)
    }
  }, [active])

  return held
}
