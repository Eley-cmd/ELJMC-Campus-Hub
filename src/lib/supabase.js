import { createClient } from '@supabase/supabase-js'
// A request that hangs on a poor connection must end, so the UI can show a Retry button
const fetchWithTimeout = (input, init = {}) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000)
  if (init.signal) init.signal.addEventListener('abort', () => ctl.abort())
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t))
}
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: fetchWithTimeout } }
)
