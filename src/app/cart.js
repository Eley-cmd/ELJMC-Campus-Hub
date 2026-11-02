// Shopping cart (like Shopee): kept on the device so it survives page changes. One order is placed per shop.
import { useSyncExternalStore } from 'react'
const KEY = 'eljmc.cart'
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
let state = load()
const subs = new Set()
const commit = (next) => { state = next; try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ } subs.forEach((f) => f()) }
const snap = (p) => ({ id: p.id, name: p.name, price_php: p.price_php, price_points: p.price_points, image_url: p.image_url, stock: p.stock, merchant_id: p.merchant_id, shop_name: p.shop_name || p.merchants?.shop_name || 'Shop' })
export const cart = {
  add(p, qty = 1) { const s = snap(p); commit({ ...state, [s.id]: { p: s, qty: Math.max(1, Math.min(s.stock, (state[s.id]?.qty || 0) + qty)) } }) },
  set(id, qty) { const n = { ...state }; const cur = n[id]; if (!cur) return; if (qty <= 0) delete n[id]; else n[id] = { ...cur, qty: Math.min(cur.p.stock, qty) }; commit(n) },
  remove(id) { const n = { ...state }; delete n[id]; commit(n) },
  clearShop(merchantId) { commit(Object.fromEntries(Object.entries(state).filter(([, v]) => v.p.merchant_id !== merchantId))) },
  clear() { commit({}) },
}
export function useCart() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
  const items = Object.values(s)
  return { items, count: items.reduce((a, i) => a + i.qty, 0) }
}
