// @deno-lint-ignore no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, 
      Deno.env.get('SUPABASE_ANON_KEY')!, 
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ message: 'Log in first.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = 'eljmc'
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY')!
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!

    if (!apiSecret || !apiKey || !cloudName) {
      return new Response(JSON.stringify({ message: 'Missing Cloudinary environment secrets.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

const stringToSign = `folder=${folder}&timestamp=${timestamp}`

const digest = await crypto.subtle.digest(
  'SHA-1',
  new TextEncoder().encode(stringToSign + apiSecret),
)
const signature = Array.from(new Uint8Array(digest))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')

    return new Response(
      JSON.stringify({ signature, timestamp, folder, api_key: apiKey, cloud_name: cloudName }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})