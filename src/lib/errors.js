// Turn Supabase / Postgres / network errors into short, human messages.
export function explain(e) {
  if (!e) return new Error('Something went wrong.')
  const raw = e.message || String(e)
  let m = raw
  if (/failed to fetch|networkerror|load failed|network request failed|aborted|timeout/i.test(raw)) m = 'Network problem. Check your connection and try again.'
  else if (/jwt|refresh token|not authenticated/i.test(raw) || e.code === 'PGRST301') m = 'Your session expired. Please log in again.'
  else if (e.code === '42501' && /row-level security|permission denied/i.test(raw)) m = 'You are not allowed to do that. Your account may be suspended.'
  else if (e.code === '23505' && /duplicate key/i.test(raw)) m = 'That already exists.'
  else if (e.code === '23514' && /violates check constraint/i.test(raw)) m = 'That value is not allowed.'
  else if (e.code === '23503') { // foreign key: saving points at something missing, or deleting something still used
    const name = (raw.match(/constraint "([^"]+)"/) || [])[1]
    m = /insert or update/i.test(raw) ? `Could not save because it points to something that does not exist${name ? ` (${name})` : ''}.` : 'That item is still in use, so it cannot be removed.'
  }
  const err = new Error(m); err.code = e.code; err.raw = e; return err
}
export const errText = (e) => (e && e.message) || 'Something went wrong.'
// Edge Function errors hide the JSON body inside error.context
export async function functionError(error) {
  try { const j = await error.context.json(); if (j?.message) return new Error(j.message) } catch { /* ignore */ }
  return explain(error)
}
