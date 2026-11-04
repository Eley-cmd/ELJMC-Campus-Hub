const KEY = 'eljmc.theme'
export const getTheme = () => localStorage.getItem(KEY) || 'system'
export const getAccent = () => '' // accent colours were removed: the app always uses the violet theme
export function applyTheme(mode = getTheme()) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.removeProperty('--brand')
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#4c1d95')
}
export function saveTheme(mode) { localStorage.setItem(KEY, mode); try { localStorage.removeItem('eljmc.accent') } catch { /* ignore */ } applyTheme(mode) }