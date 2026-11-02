// supabase functions deploy login-with-student-id
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { student_id, password } = await req.json()
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: email } = await admin.rpc('auth_email_for_student_id', { p_student_id: student_id })
    if (!email) throw new Error('Student ID not found or not verified yet.')
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    if (error) throw new Error('Wrong student ID or password.')
    return new Response(JSON.stringify({ session: data.session }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ message: (e as Error).message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
