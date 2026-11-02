import { useCallback, useEffect, useRef, useState } from 'react'
export { ago } from '../lib/format'

// Stale-while-revalidate cache: a screen you opened before shows its last data instantly (even offline)
// and refreshes in the background. Skeletons appear only the first time.
const cache = new Map()
export const clearCache = () => cache.clear()
export function useQuery(key, fn) {
  const fnRef = useRef(fn); fnRef.current = fn
  const [st, set] = useState(() => ({ data: cache.get(key) ?? null, loading: !cache.has(key), error: null }))
  const alive = useRef(true); useEffect(() => () => { alive.current = false }, [])
  const keyRef = useRef(key); keyRef.current = key
  const run = useCallback(() => {
    const k = keyRef.current
    set((p) => ({ ...p, loading: p.data == null, error: null }))
    return fnRef.current().then(
      (data) => { cache.set(k, data); if (alive.current && keyRef.current === k) set({ data, loading: false, error: null }) },
      (error) => { if (alive.current && keyRef.current === k) set((p) => ({ ...p, loading: false, error })) })
  }, [])
  useEffect(() => { set({ data: cache.get(key) ?? null, loading: !cache.has(key), error: null }); run() }, [key, run])
  const setData = useCallback((u) => set((p) => { const data = typeof u === 'function' ? u(p.data) : u; cache.set(keyRef.current, data); return { ...p, data } }), [])
  return { ...st, reload: run, setData }
}
// Back-compat with the first scaffold: useAsync(fn, deps)
export const useAsync = (fn, deps = []) => useQuery('async:' + fn.toString().length + ':' + JSON.stringify(deps), fn)

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false)
    addEventListener('online', a); addEventListener('offline', b)
    return () => { removeEventListener('online', a); removeEventListener('offline', b) }
  }, [])
  return on
}

// Calls fn every `ms` while the tab is visible and enabled
export function usePoll(fn, ms, enabled = true) {
  const ref = useRef(fn); ref.current = fn
  useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') ref.current() }, ms)
    return () => clearInterval(t)
  }, [ms, enabled])
}

export function useInView(onSeen, enabled = true) {
  const ref = useRef(null); const cb = useRef(onSeen); cb.current = onSeen
  useEffect(() => {
    if (!enabled || !ref.current) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && cb.current(), { rootMargin: '400px' })
    io.observe(ref.current); return () => io.disconnect()
  }, [enabled])
  return ref
}

export function useTick(ms = 1000) {
  const [, set] = useState(0)
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t) }, [ms])
}
