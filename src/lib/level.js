// Level is derived from lifetime points earned (positive transactions). No DB change needed.
export function levelInfo(earned = 0) {
  const level = Math.floor(Math.sqrt(earned / 100)) + 1
  const from = 100 * (level - 1) ** 2, to = 100 * level ** 2
  return { level, earned, from, to, pct: Math.min(100, Math.round(((earned - from) / (to - from)) * 100)) }
}
