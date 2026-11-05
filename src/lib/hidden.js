// "Hide post": removes a post from MY feed only. Saved on this device for the logged-in account (no database change),
// so it is never deleted for anyone else and another account on the same phone does not inherit it.
import { useSyncExternalStore } from 'react'
let user = ''
let state = new Set()
const subs = new Set()
const key = () => 'eljmc.hiddenPosts.' + user
const load = () => { try { return new Set(JSON.parse(localStorage.getItem(key())) || []) } catch { return new Set() } }
const commit = (next) => { state = next; try { localStorage.setItem(key(), JSON.stringify([...state])) } catch { /* private mode */ } subs.forEach((f) => f()) }
export const hidden = {
  setUser: (id) => { if (id === user) return; user = id; state = id ? load() : new Set(); subs.forEach((f) => f()) },
  hide: (id) => commit(new Set(state).add(id)),
  clear: () => commit(new Set()),
}
export const useHidden = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)