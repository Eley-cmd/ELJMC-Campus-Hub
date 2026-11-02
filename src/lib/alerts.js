// Sound and vibration for live notifications. No audio file needed: the beep is generated.
const get = (k, d = true) => { const v = localStorage.getItem('eljmc.' + k); return v === null ? d : v === '1' }
export const prefs = { sound: () => get('sound'), vibrate: () => get('vibrate'), set: (k, v) => localStorage.setItem('eljmc.' + k, v ? '1' : '0') }
export function alertUser() {
  try {
    if (prefs.vibrate() && navigator.vibrate) navigator.vibrate([120, 60, 120])
    if (prefs.sound()) {
      const A = window.AudioContext || window.webkitAudioContext; const c = new A(); const o = c.createOscillator(); const g = c.createGain()
      o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.4)
      setTimeout(() => c.close(), 600)
    }
  } catch { /* autoplay blocked, ignore */ }
}
