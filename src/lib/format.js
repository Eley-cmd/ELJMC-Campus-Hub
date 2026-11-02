export const ago = (d) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(d)) / 1000))
  if (s < 60) return 'now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m`
  const h = Math.round(m / 60); if (h < 24) return `${h}h`
  const dd = Math.round(h / 24); if (dd < 7) return `${dd}d`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
export const clock = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
export const dateTime = (d) => new Date(d).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export const peso = (n) => '\u20B1' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n || 0))
export const slug = (x = '') => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const titleCase = (x = '') => x.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const countdown = (to) => {
  const ms = new Date(to) - Date.now(); if (ms <= 0) return 'expired'
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return h ? `${h}h ${m}m` : `${m}m ${String(x).padStart(2, '0')}s`
}
// datetime-local <-> ISO
export const toLocalInput = (d) => { const x = new Date(d), p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}` }
