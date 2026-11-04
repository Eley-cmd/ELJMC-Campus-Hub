// "Hide post": removes a post from MY feed only. Saved on this device (no database change), so it is never deleted for anyone else.
import { useSyncExternalStore } from 'react'
const KEY = 'eljmc.hiddenPosts'
const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY)) || []) } catch { return new Set() } }
let state = load()
const subs = new Set()
const commit = (next) => { state = next; try { localStorage.setItem(KEY, JSON.stringify([...state])) } catch { /* private mode */ } subs.forEach((f) => f()) }
export const hidden = {
  hide: (id) => commit(new Set(state).add(id)),
  clear: () => commit(new Set()),
}
export const useHidden = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)