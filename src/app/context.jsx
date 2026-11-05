import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Bell } from 'lucide-react'
import { auth, profile, points, notifications, detectCaps, caps } from '../api'
import { alertUser } from '../lib/alerts'
import { applyTheme, getTheme } from '../lib/theme'
import { clearCache } from '../ui/hooks'
import { cart } from './cart'
import { hidden } from '../lib/hidden'

// If a different account logs in on this device, nothing from the previous account may be shown (cached lists, cart, hidden posts)
let lastUser = null

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ session, children }) {
  const [me, setMe] = useState(null)
  const [meError, setMeError] = useState(null)
  const [suspension, setSuspension] = useState(null)
  const [unread, setUnread] = useState(0)
  const [toasts, setToasts] = useState([])
  const [, setCapsReady] = useState(false)
  const id = session.user.id
  useState(() => { if (lastUser && lastUser !== id) { clearCache(); cart.clear() } lastUser = id; hidden.setUser(id) })

  const toast = useCallback((text, kind = 'ok', ms = 3200) => {
    const k = Math.random().toString(36).slice(2)
    setToasts((t) => [...t.slice(-2), { k, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.k !== k)), ms)
  }, [])

  const reloadMe = useCallback(async () => {
    try { const p = await profile.me(); setMe(p); setMeError(null); return p } catch (e) { setMeError(e) }
  }, [])
  const reloadUnread = useCallback(() => notifications.unread().then(setUnread, () => {}), [])

  useEffect(() => { reloadMe(); reloadUnread(); detectCaps().then(() => { setCapsReady(true); if (caps.cover) reloadMe() }); profile.mySuspension().then(setSuspension, () => {}) }, [reloadMe, reloadUnread])

  // The database lower-cases usernames at signup. Restore the case the person typed (only the case, nothing else).
  useEffect(() => {
    if (!me) return
    let w; try { w = JSON.parse(localStorage.getItem('eljmc.wantedUsername') || 'null') } catch { w = null }
    if (!w) return
    const mine = (session.user.email || '').toLowerCase() === w.email
    if (mine && w.username !== me.username && w.username.toLowerCase() === me.username.toLowerCase()) profile.update({ username: w.username }).then(reloadMe, () => {})
    if (mine) localStorage.removeItem('eljmc.wantedUsername')
  }, [me]) // eslint-disable-line

  // Presence: while the app is open and visible, touch the profile every 2 minutes. Its updated_at is the "last active" time.
  // Choosing Offline in Settings turns this off completely.
  useEffect(() => {
    if (!me) return
    const pref = () => { try { return localStorage.getItem('eljmc.status') || 'online' } catch { return 'online' } }
    const beat = () => { if (document.visibilityState === 'visible' && pref() !== 'offline') profile.update({ active_status: pref() }).catch(() => {}) }
    const vis = () => (document.visibilityState === 'visible' ? beat() : pref() !== 'offline' && profile.update({ active_status: 'away' }).catch(() => {}))
    beat(); const t = setInterval(beat, 120000); document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [me?.id]) // eslint-disable-line

  // Daily login bonus (the server allows one per Manila day and returns 0 when already claimed)
  const claimed = useRef(false)
  useEffect(() => {
    if (claimed.current) return; claimed.current = true
    points.claimDaily().then((n) => { if (n > 0) { toast(`Daily bonus: +${n} points`); reloadMe() } }, () => {})
  }, [toast, reloadMe])

  // Live notifications (notifications is in the realtime publication)
  useEffect(() => notifications.subscribe(id, (n) => { setUnread((x) => x + 1); alertUser(); toast(n.title, 'bell') }), [id, toast])

  // Theme saved in the profile follows the user to a new device (local choice wins if set)
  useEffect(() => { if (me && !localStorage.getItem('eljmc.theme') && ['light', 'dark'].includes(me.theme_setting)) applyTheme(me.theme_setting) }, [me])
  useEffect(() => { applyTheme(getTheme()) }, [])

  const value = useMemo(() => ({ session, me, meError, reloadMe, unread, setUnread, reloadUnread, toast, suspension, caps, isAdmin: me?.role === 'admin',
    signOut: async () => { clearCache(); cart.clear(); await auth.signOut() } }), [session, me, meError, reloadMe, unread, reloadUnread, toast, suspension])
  return <Ctx.Provider value={value}>{children}
    <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.k} className={'toast ' + t.kind}>
      {t.kind === 'err' ? <AlertCircle size={18} /> : t.kind === 'bell' ? <Bell size={18} /> : <CheckCircle2 size={18} />}<span>{t.text}</span></div>)}</div>
  </Ctx.Provider>
}