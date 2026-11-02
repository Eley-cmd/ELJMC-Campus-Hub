const KEY = 'eljmc.theme', ACC = 'eljmc.accent'
export const getTheme = () => localStorage.getItem(KEY) || 'system'
export const getAccent = () => localStorage.getItem(ACC) || ''
export function applyTheme(mode = getTheme(), accent = getAccent()) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  if (accent) document.documentElement.style.setProperty('--brand', accent); else document.documentElement.style.removeProperty('--brand')
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', accent || '#1677ff')
}
export function saveTheme(mode, accent) { localStorage.setItem(KEY, mode); if (accent !== undefined) localStorage.setItem(ACC, accent || ''); applyTheme(mode, accent ?? getAccent()) }
