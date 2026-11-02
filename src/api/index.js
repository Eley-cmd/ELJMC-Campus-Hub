// Single backend layer. Everything goes straight to Supabase (masked views, tables the grants allow, RPCs).
// Components never import the Supabase client; they only use this file.
// Rules this file follows (from the V2 SQL patch):
//   - posts/comments are READ from feed_posts / feed_comments (anonymous authors masked)
//   - money, points, stock, matching, friends, admin actions go through RPCs
//   - only granted columns are written (see section 9 of the SQL)
import { supabase as sb } from '../lib/supabase'
import { explain, functionError } from '../lib/errors'
import { TERMS_VERSION, VERIFY_REASON, SHOP_DELETE_REASON } from '../config'

const ok = ({ data, error }) => { if (error) throw explain(error); return data }
let _uid = null
sb.auth.onAuthStateChange((_e, s) => { _uid = s?.user?.id ?? null })
export const uid = async () => _uid ?? (_uid = (await sb.auth.getSession()).data.session?.user.id ?? null)
const esc = (x) => String(x).replace(/[\\%_]/g, '\\$&') // escape LIKE wildcards
const PUB = 'id,username,display_name,avatar_url,role,verified_badge,active_status'

// Features that exist only in later migrations are detected once, never assumed.
export const caps = { replies: false, ready: false }
export async function detectCaps() {
  const r = await sb.from('feed_comments').select('parent_id').limit(1)
  caps.replies = !r.error; caps.ready = true
  return caps
}

/* ------------------------------ auth ------------------------------ */
export const auth = {
  google: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }).then(ok),
  facebook: () => sb.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: location.origin } }).then(ok),
  email: (email, password) => sb.auth.signInWithPassword({ email, password }).then(ok),
  // returns { needsConfirm } when the project requires email confirmation
  signUp: async (email, password, username, full_name) => {
    const d = ok(await sb.auth.signUp({ email, password, options: { data: { username, full_name } } }))
    return { needsConfirm: !d.session }
  },
  forgot: (email) => sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }).then(ok),
  // Student-ID login: the Edge Function resolves the verified ID to an email (service role only)
  studentId: async (student_id, password) => {
    const { data, error } = await sb.functions.invoke('login-with-student-id', { body: { student_id, password } })
    if (error) throw await functionError(error)
    return sb.auth.setSession(data.session).then(ok)
  },
  signOut: () => sb.auth.signOut(),
  onChange: (cb) => sb.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription,
  session: () => sb.auth.getSession().then((r) => r.data.session),
}

/* ---------------------------- profiles ---------------------------- */
export const profile = {
  me: async () => sb.from('profiles').select(PUB + ',points_balance,theme_setting,created_at').eq('id', await uid()).single().then(ok),
  byUsername: async (u) => ok(await sb.from('profiles').select(PUB + ',points_balance,created_at').ilike('username', esc(u)).limit(1))[0] || null,
  usernameTaken: async (u) => ok(await sb.from('profiles').select('id').ilike('username', esc(u)).neq('id', await uid()).limit(1)).length > 0,
  private: async () => { const r = ok(await sb.rpc('get_my_private_profile')); return Array.isArray(r) ? r[0] : r },
  update: async (patch) => sb.from('profiles').update(patch).eq('id', await uid()).then(ok), // display_name, username, avatar_url, active_status, theme_setting
  requestVerification: async (id) => {
    ok(await sb.rpc('request_student_verification', { p_student_id: id }))
    await feed.report('user', await uid(), VERIFY_REASON, `Student ID: ${id}`).catch(() => {}) // best effort: puts it in the admin queue
  },
  pairRfid: (serial) => sb.rpc('pair_rfid_card', { p_serial: serial }).then(ok),
  regenQr: () => sb.rpc('regenerate_qr_code').then(ok),
  mySuspension: async () => {
    const rows = ok(await sb.from('suspensions').select('reason,expires_at,lifted_at').eq('user_id', await uid()).is('lifted_at', null))
    return rows.find((r) => !r.expires_at || new Date(r.expires_at) > new Date()) || null
  },
  byIds: async (ids) => {
    ids = [...new Set((ids || []).filter(Boolean))]
    if (!ids.length) return {}
    return Object.fromEntries(ok(await sb.from('profiles').select(PUB).in('id', ids)).map((r) => [r.id, r]))
  },
  search: (q) => sb.from('profiles').select(PUB).or(`username.ilike.%${q.replace(/[%,]/g, '')}%,display_name.ilike.%${q.replace(/[%,]/g, '')}%`).limit(12).then(ok),
}

// Web NFC: scan a physical RFID/NFC card with the phone, then pair it
export async function scanAndPairRfid() {
  if (!('NDEFReader' in window)) throw new Error('This browser does not support NFC scanning. Use a USB reader or type the serial.')
  const reader = new window.NDEFReader(); await reader.scan()
  return new Promise((res, rej) => {
    reader.onreading = (e) => profile.pairRfid(e.serialNumber).then(res, rej)
    reader.onreadingerror = () => rej(new Error('Card could not be read. Try again.'))
  })
}

/* ---------------------------- channels ---------------------------- */
export const channels = {
  list: () => sb.from('channels').select('id,name,category').eq('is_direct', false).eq('is_private', false).order('name').then(ok),
  one: (id) => sb.from('channels').select('id,name,category').eq('id', id).maybeSingle().then(ok),
  create: (name, category) => sb.from('channels').insert({ name, category, is_private: false }).select().single().then(ok), // admin only (RLS)
  remove: (id) => sb.from('channels').delete().eq('id', id).then(ok),                                                   // admin only (RLS)
}

/* ------------------------------ feed ------------------------------ */
// Adds author, reaction counts, my reaction, comment count, RSVP and poll data to feed rows.
async function enrich(rows) {
  rows = rows.map((p) => ({ ...p, id: p.id ?? p.post_id }))
  const ids = rows.map((p) => p.id)
  if (!ids.length) return []
  const me = await uid()
  const [authors, reacts, comments, rsvps, polls] = await Promise.all([
    profile.byIds(rows.map((p) => p.author_id)),
    sb.from('post_reactions').select('post_id,user_id,reaction').in('post_id', ids).then(ok),
    sb.from('feed_comments').select('post_id').in('post_id', ids).then(ok),
    sb.from('event_rsvps').select('post_id,user_id').in('post_id', ids).then(ok),
    sb.from('polls').select('*, poll_options(*)').in('post_id', ids).then(ok),
  ])
  const myVotes = polls.length ? ok(await sb.from('poll_votes').select('poll_id,option_id').eq('user_id', me).in('poll_id', polls.map((p) => p.id))) : []
  return rows.map((p) => {
    const rs = reacts.filter((r) => r.post_id === p.id), counts = {}
    rs.forEach((r) => { counts[r.reaction] = (counts[r.reaction] || 0) + 1 })
    const poll = polls.find((x) => x.post_id === p.id)
    const mine = poll && myVotes.find((v) => v.poll_id === poll.id)
    return {
      ...p,
      author: p.author_id ? authors[p.author_id] || null : null, // null = anonymous
      reactionCounts: counts, likes: rs.length, myReaction: rs.find((r) => r.user_id === me)?.reaction || null,
      commentCount: comments.filter((c) => c.post_id === p.id).length,
      rsvpCount: rsvps.filter((r) => r.post_id === p.id).length, going: rsvps.some((r) => r.post_id === p.id && r.user_id === me),
      poll: poll ? { ...poll, options: poll.poll_options || [], myOption: mine?.option_id || null } : null,
    }
  })
}

export const PAGE = 12
export const feed = {
  // before = created_at of the last loaded post (cursor paging). events = upcoming/past event list.
  async list({ channelId, hot, before, events, past, authorId, limit = PAGE } = {}) {
    let q
    if (hot) q = sb.from('trending_posts').select('*').order('score', { ascending: false }).limit(10)
    else if (events) {
      const now = new Date(Date.now() - 3600e3).toISOString()
      q = sb.from('feed_posts').select('*').eq('is_event', true)
      q = past ? q.lt('event_time', now).order('event_time', { ascending: false }) : q.gte('event_time', now).order('event_time', { ascending: true })
      q = q.limit(limit)
    } else {
      q = sb.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(limit)
      if (before) q = q.lt('created_at', before)
    }
    if (channelId) q = q.eq('channel_id', channelId)
    if (authorId) q = q.eq('author_id', authorId)
    return enrich(ok(await q))
  },
  one: async (id) => (await enrich(ok(await sb.from('feed_posts').select('*').eq('id', id).limit(1))))[0] || null,
  create: async ({ channel_id, content, media_urls = [], is_anonymous = false, is_event = false, event_time = null }) =>
    sb.from('posts').insert({ author_id: await uid(), channel_id: channel_id || null, content, media_urls, is_anonymous, is_event, event_time }).select().single().then(ok),
  edit: (id, patch) => sb.from('posts').update(patch).eq('id', id).then(ok), // content, media_urls, event_time only
  remove: (id) => sb.from('posts').delete().eq('id', id).then(ok),
  // reaction = key | null. prev = my current reaction. Insert, change (UPDATE reaction only) or remove.
  react: async (post_id, reaction, prev) => {
    const me = await uid()
    if (!reaction) return sb.from('post_reactions').delete().eq('post_id', post_id).eq('user_id', me).then(ok)
    const change = () => sb.from('post_reactions').update({ reaction }).eq('post_id', post_id).eq('user_id', me).then(ok)
    if (prev) return change()
    const { error } = await sb.from('post_reactions').insert({ post_id, user_id: me, reaction })
    if (error?.code === '23505') return change() // already reacted on another device
    if (error) throw explain(error)
  },
  rsvp: async (id, on) => on
    ? sb.from('event_rsvps').insert({ post_id: id, user_id: await uid() }).then(({ error }) => { if (error && error.code !== '23505') throw explain(error) })
    : sb.from('event_rsvps').delete().eq('post_id', id).eq('user_id', await uid()).then(ok),
  report: async (target_type, target_id, reason, details) =>
    sb.from('reports').insert({ reporter_id: await uid(), target_type, target_id, reason: reason.slice(0, 100), details: details || null }).then(ok),
  // Trending banner: top posts of the last 24 h
  banner: () => feed.list({ hot: true }).then((r) => r.slice(0, 5)),
}

/* ----------------------------- comments ---------------------------- */
export const comments = {
  async list(post_id) {
    const me = await uid()
    const rows = ok(await sb.from('feed_comments').select('*').eq('post_id', post_id).order('created_at'))
    const ids = rows.map((c) => c.id)
    const [authors, liked] = await Promise.all([
      profile.byIds(rows.map((c) => c.author_id)),
      ids.length ? sb.from('comment_likes').select('comment_id').eq('user_id', me).in('comment_id', ids).then(ok) : [],
    ])
    const set = new Set(liked.map((l) => l.comment_id))
    const list = rows.map((c) => {
      // Databases without a writable parent_id keep the thread link in a hidden prefix (stripped here)
      const m = (c.content || '').match(MARK)
      return { ...c, content: m ? c.content.replace(MARK, '') : c.content, parent_id: c.parent_id || (m ? m[1] : null), markerParent: m ? m[1] : null,
        author: c.author_id ? authors[c.author_id] || null : null, liked: set.has(c.id) }
    })
    // Top-level comments are floors (1F, 2F ...). Every reply, even a reply to a reply, hangs under its top comment (Facebook / Instagram style).
    const byId = Object.fromEntries(list.map((c) => [c.id, c]))
    const rootOf = (c) => { let x = c, n = 0; while (x.parent_id && byId[x.parent_id] && n++ < 12) x = byId[x.parent_id]; return x }
    const roots = list.filter((c) => !c.parent_id || !byId[c.parent_id])
    roots.forEach((c, i) => { c.floor = i + 1; c.replies = [] })
    list.forEach((c) => { if (roots.includes(c)) return; const r = rootOf(c); if (r !== c) r.replies.push(c) })
    return roots
  },
  add: async (post_id, content, is_anonymous = false, parent_id = null) => {
    const row = { post_id, author_id: await uid(), content, is_anonymous }
    if (parent_id && caps.replies) row.parent_id = parent_id
    else if (parent_id) row.content = `[[r:${parent_id}]]` + content
    let res = await sb.from('post_comments').insert(row)
    if (res.error && row.parent_id && /parent_id|permission denied/i.test(res.error.message)) { // column not writable: use the hidden prefix
      delete row.parent_id; row.content = `[[r:${parent_id}]]` + content
      res = await sb.from('post_comments').insert(row)
    }
    return ok(res)
  },
  edit: (id, content, markerParent = null) => sb.from('post_comments').update({ content: markerParent ? `[[r:${markerParent}]]` + content : content }).eq('id', id).then(ok),
  remove: (id) => sb.from('post_comments').delete().eq('id', id).then(ok),
  like: async (id, on) => on
    ? sb.from('comment_likes').insert({ comment_id: id, user_id: await uid() }).then(({ error }) => { if (error && error.code !== '23505') throw explain(error) })
    : sb.from('comment_likes').delete().eq('comment_id', id).eq('user_id', await uid()).then(ok),
}
const MARK = /^\[\[r:([0-9a-f-]{36})\]\]\s?/i

/* ------------------------------ polls ------------------------------ */
export const polls = {
  // The post text is the question. We try with a `question` column first and without it if the table has none.
  async create(post_id, question, options, expires_at = null) {
    const base = { post_id, ...(expires_at ? { expires_at } : {}) }
    let res = await sb.from('polls').insert({ ...base, question }).select().single()
    if (res.error && /question/i.test(res.error.message)) res = await sb.from('polls').insert(base).select().single()
    const poll = ok(res)
    ok(await sb.from('poll_options').insert(options.map((option_text) => ({ poll_id: poll.id, option_text }))))
    return poll
  },
  vote: async (poll_id, option_id) => sb.from('poll_votes').insert({ poll_id, option_id, user_id: await uid() }).then(ok),
  unvote: async (poll_id) => sb.from('poll_votes').delete().eq('poll_id', poll_id).eq('user_id', await uid()).then(ok),
  get: (post_id) => sb.from('polls').select('*, poll_options(*)').eq('post_id', post_id).maybeSingle().then(ok),
}

/* ------------------------- chats (DM + group) ------------------------ */
export const chat = {
  async mine() {
    const me = await uid()
    const mem = ok(await sb.from('channel_members').select('channel_id, channels(id,name,is_direct)').eq('user_id', me))
    const ids = mem.map((m) => m.channel_id)
    if (!ids.length) return []
    const others = ok(await sb.from('channel_members').select('channel_id,user_id').in('channel_id', ids).neq('user_id', me))
    const prof = await profile.byIds(others.map((o) => o.user_id))
    const rows = await Promise.all(mem.map(async (m) => {
      const other = others.find((o) => o.channel_id === m.channel_id)
      const last = ok(await sb.from('channel_messages').select('*').eq('channel_id', m.channel_id).order('created_at', { ascending: false }).limit(1))[0]
      const p = m.channels?.is_direct ? prof[other?.user_id] : null
      return { id: m.channel_id, isDirect: !!m.channels?.is_direct, title: p?.display_name || m.channels?.name || 'Chat', avatar: p?.avatar_url, peer: p || null, last }
    }))
    return rows.sort((a, b) => new Date(b.last?.created_at || 0) - new Date(a.last?.created_at || 0))
  },
  info: async (channel_id) => {
    const me = await uid()
    const ch = ok(await sb.from('channels').select('id,name,is_direct').eq('id', channel_id).maybeSingle())
    const mem = ok(await sb.from('channel_members').select('user_id').eq('channel_id', channel_id))
    const prof = await profile.byIds(mem.map((m) => m.user_id))
    const peer = ch?.is_direct ? prof[mem.find((m) => m.user_id !== me)?.user_id] : null
    return { id: channel_id, title: peer?.display_name || ch?.name || 'Chat', isDirect: !!ch?.is_direct, peer, members: prof }
  },
  openDm: (other) => sb.rpc('get_or_create_dm', { p_other: other }).then(ok),
  createGroup: (name, members) => sb.rpc('create_group_chat', { p_name: name, p_member_ids: members }).then(ok),
  leave: async (channel_id) => sb.from('channel_members').delete().eq('channel_id', channel_id).eq('user_id', await uid()).then(ok),
  messages: (channel_id) => sb.from('channel_messages').select('*').eq('channel_id', channel_id).order('created_at').limit(200).then(ok),
  send: async (channel_id, content) => sb.from('channel_messages').insert({ channel_id, sender_id: await uid(), content }).select().single().then(ok),
  // channel_messages is not in the realtime publication of the V2 patch, so the thread also polls (see Chat page).
  // This subscription starts working by itself if you add the table to supabase_realtime later.
  subscribe: (channel_id, cb) => {
    const ch = sb.channel('msg-' + channel_id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channel_id}` }, (p) => cb(p.new))
      .subscribe()
    return () => sb.removeChannel(ch)
  },
}

/* ------------------------ anonymous matchmaking ---------------------- */
export const anon = {
  join: (tags) => sb.rpc('join_matchmaking', { p_tags: tags }).then(ok), // {status:'waiting'} | {status:'matched', session_id, slot}
  leave: () => sb.rpc('leave_matchmaking').then(ok),
  mine: async () => { const r = ok(await sb.rpc('my_anonymous_session')); return (Array.isArray(r) ? r[0] : r) || null },
  send: (session, text) => sb.rpc('send_anonymous_message', { p_session_id: session, p_content: text }).then(ok), // returns message id
  end: (session) => sb.rpc('end_anonymous_session', { p_session_id: session }).then(ok),
  history: (session) => sb.from('anonymous_live_messages').select('*').eq('session_id', session).order('created_at').then(ok),
  subscribe: (session, cb) => {
    const ch = sb.channel('anon-' + session)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anonymous_live_messages', filter: `session_id=eq.${session}` }, (p) => cb(p.new))
      .subscribe()
    return () => sb.removeChannel(ch)
  },
}

/* ------------------------------ friends ------------------------------ */
export const friends = {
  addByQr: (hash) => sb.rpc('add_friend_by_qr', { p_qr_hash: hash }).then(ok),
  list: async () => {
    const me = await uid()
    const rows = ok(await sb.from('friendships').select('requester_id,addressee_id,status').eq('status', 'accepted'))
    const ids = rows.map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id))
    return Object.values(await profile.byIds(ids)).sort((a, b) => a.display_name.localeCompare(b.display_name))
  },
  isFriend: async (other) => {
    const me = await uid()
    const r = ok(await sb.from('friendships').select('status').or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`))
    return r[0]?.status || null
  },
  remove: async (other) => {
    const me = await uid()
    return sb.from('friendships').delete().or(`and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`).then(ok)
  },
}

/* ------------------------- shop (Shop Nav) ------------------------- */
export const shop = {
  registerMerchant: (name, desc, expMinutes = 30) =>
    sb.rpc('register_merchant', { p_shop_name: name, p_description: desc || null, p_terms_version: TERMS_VERSION, p_accept_terms: true, p_order_expiration_minutes: expMinutes }).then(ok),
  // Shopee-style browsing: every available product of every open shop
  allProducts: async ({ q = '', from = 0, size = 24 } = {}) => {
    let b = sb.from('products').select('*, merchants!inner(id,shop_name,is_active)').eq('is_available', true).eq('merchants.is_active', true).order('name').range(from, from + size - 1)
    if (q.trim()) b = b.ilike('name', `%${q.trim().replace(/[\\%_,()]/g, ' ')}%`)
    return ok(await b)
  },
  product: async (id) => ok(await sb.from('products').select('*, merchants(id,shop_name,description,is_active,owner_id,order_expiration_minutes)').eq('id', id).maybeSingle()),
  openOrders: async (merchant_id) => (await sb.from('orders').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant_id).in('status', ['pending', 'confirmed', 'ready_for_pickup'])).count || 0,
  // Deleting a shop needs an admin: the request is filed as a report and an admin approves it
  requestDeletion: async (merchant) => feed.report('user', await uid(), SHOP_DELETE_REASON, `Shop: ${merchant.shop_name} (${merchant.id})`),
  myDeletionRequest: async () => ok(await sb.from('reports').select('id,status,created_at,handled_at').eq('reporter_id', await uid()).eq('reason', SHOP_DELETE_REASON).order('created_at', { ascending: false }).limit(1))[0] || null,
  merchants: () => sb.from('merchants').select('*').eq('is_active', true).order('shop_name').then(ok),
  merchant: (id) => sb.from('merchants').select('*').eq('id', id).maybeSingle().then(ok),
  myMerchant: async () => sb.from('merchants').select('*').eq('owner_id', await uid()).maybeSingle().then(ok),
  updateMerchant: (id, patch) => sb.from('merchants').update(patch).eq('id', id).then(ok), // shop_name, description, is_active, order_expiration_minutes
  products: (merchant_id, all = false) => {
    let q = sb.from('products').select('*').eq('merchant_id', merchant_id).order('name')
    if (!all) q = q.eq('is_available', true)
    return q.then(ok)
  },
  addProduct: (p) => sb.from('products').insert(p).select().single().then(ok),
  editProduct: (id, patch) => sb.from('products').update(patch).eq('id', id).then(ok), // name, price_php, price_points, image_url, stock, is_available
  removeProduct: async (id) => {
    const { error } = await sb.from('products').delete().eq('id', id)
    if (error?.code === '23503') { ok(await sb.from('products').update({ is_available: false }).eq('id', id)); return 'hidden' } // already ordered: hide instead
    if (error) throw explain(error)
    return 'deleted'
  },
  // items = [{product_id, quantity}]; the server computes prices, totals, stock, expiry and points
  placeOrder: (merchant_id, items, payWith = 'cash') => sb.rpc('place_order', { p_merchant_id: merchant_id, p_items: items, p_pay_with: payWith }).then(ok),
  myOrders: async () => sb.from('orders').select('*, order_items(*, products(name,image_url))').eq('customer_id', await uid()).order('created_at', { ascending: false }).then(ok),
  shopOrders: async (merchant_id) => {
    const rows = ok(await sb.from('orders').select('*, order_items(*, products(name))').eq('merchant_id', merchant_id).order('created_at', { ascending: false }).limit(60))
    const cust = await profile.byIds(rows.map((r) => r.customer_id))
    return rows.map((r) => ({ ...r, customer: cust[r.customer_id] || null }))
  },
  setStatus: (id, status) => sb.from('orders').update({ status }).eq('id', id).then(ok), // trigger enforces the legal flow
  merchantNames: async (ids) => Object.fromEntries(ok(await sb.from('merchants').select('id,shop_name').in('id', [...new Set(ids)])).map((m) => [m.id, m.shop_name])),
}

/* ---------------------------- points & pets ---------------------------- */
export const points = {
  claimDaily: () => sb.rpc('claim_daily_login').then(ok), // returns points added (0 = already claimed today, Manila day)
  history: () => sb.from('point_transactions').select('*').order('created_at', { ascending: false }).limit(60).then(ok),
  earned: async () => ok(await sb.from('point_transactions').select('amount,reason').eq('user_id', await uid()).gt('amount', 0)).filter((x) => x.reason !== 'Order Refund').reduce((a, x) => a + x.amount, 0),
  pets: () => sb.from('virtual_pets').select('*').order('store_cost_points').then(ok),
  myPets: async () => sb.from('user_pets').select('*').eq('user_id', await uid()).then(ok),
  buyPet: (id) => sb.rpc('buy_pet', { p_pet_id: id }).then(ok),
  equipPet: (id) => sb.rpc('equip_pet', { p_pet_id: id }).then(ok),
}

/* --------------------------- notifications --------------------------- */
export const notifications = {
  list: () => sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60).then(ok),
  unread: async () => { const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null); return count || 0 },
  read: (id) => sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).then(ok),
  readAll: () => sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).then(ok),
  remove: (id) => sb.from('notifications').delete().eq('id', id).then(ok),
  subscribe: (userId, cb) => {
    const ch = sb.channel('notif-' + userId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => cb(p.new)).subscribe()
    return () => sb.removeChannel(ch)
  },
}

/* ------------------------------- admin ------------------------------- */
export const admin = {
  setRole: (u, r) => sb.rpc('admin_set_role', { p_user: u, p_role: r }).then(ok),
  verify: (u) => sb.rpc('admin_verify_student', { p_user: u }).then(ok),
  suspend: (u, reason, until = null) => sb.rpc('admin_suspend_user', { p_user: u, p_reason: reason, p_until: until }).then(ok),
  lift: (u) => sb.rpc('admin_lift_suspension', { p_user: u }).then(ok),
  grant: (u, amount, reason) => sb.rpc('admin_grant_points', { p_user: u, p_amount: amount, p_reason: reason }).then(ok),
  lookup: (q) => sb.rpc('admin_lookup_user', { p_query: q }).then(ok),
  transcript: async (session, reason) => {
    const rows = ok(await sb.rpc('admin_get_anonymous_transcript', { p_session: session, p_reason: reason }))
    const p = await profile.byIds(rows.map((r) => r.sender_id))
    return rows.map((r) => ({ ...r, sender: p[r.sender_id] || null }))
  },
  reports: async (status) => {
    let q = sb.from('reports').select('*').order('created_at', { ascending: false }).limit(80)
    if (status) q = q.eq('status', status)
    const rows = ok(await q); const p = await profile.byIds(rows.map((r) => r.reporter_id))
    return rows.map((r) => ({ ...r, reporter: p[r.reporter_id] || null }))
  },
  handleReport: async (id, status) => sb.from('reports').update({ status, handled_by: await uid(), handled_at: new Date().toISOString() }).eq('id', id).then(ok),
  preview: async (type, id) => {
    if (type === 'post') return ok(await sb.from('feed_posts').select('content,media_urls,channel_id,created_at').eq('id', id).maybeSingle())
    if (type === 'comment') return ok(await sb.from('feed_comments').select('content,post_id,created_at').eq('id', id).maybeSingle())
    if (type === 'user') return ok(await sb.from('profiles').select('display_name,username,role').eq('id', id).maybeSingle())
    return null
  },
  suspensions: async () => {
    const rows = ok(await sb.from('suspensions').select('*').is('lifted_at', null).order('created_at', { ascending: false }))
    const p = await profile.byIds(rows.map((r) => r.user_id))
    return rows.map((r) => ({ ...r, user: p[r.user_id] || null }))
  },
  audit: async () => {
    const rows = ok(await sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100))
    const p = await profile.byIds(rows.map((r) => r.actor_id))
    return rows.map((r) => ({ ...r, actor: p[r.actor_id] || null }))
  },
  // Everyone using the app (public columns only), newest first
  users: async ({ q = '', from = 0, size = 30, unverified = false } = {}) => {
    let b = sb.from('profiles').select(PUB + ',points_balance,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + size - 1)
    if (q.trim()) { const t = esc(q.trim().replace(/[,()]/g, ' ')); b = b.or(`username.ilike.%${t}%,display_name.ilike.%${t}%`) }
    if (unverified) b = b.eq('role', 'student').eq('verified_badge', false)
    const { data, error, count } = await b
    if (error) throw explain(error)
    return { rows: data, count }
  },
  // People who sent a Student ID for verification (latest request per person)
  verifyRequests: async () => {
    const rows = ok(await sb.from('reports').select('*').eq('reason', VERIFY_REASON).eq('status', 'open').order('created_at', { ascending: false }).limit(150))
    const seen = new Set(), uniq = rows.filter((r) => !seen.has(r.target_id) && seen.add(r.target_id))
    const p = await profile.byIds(uniq.map((r) => r.target_id))
    return uniq.map((r) => ({ ...r, user: p[r.target_id] || null, requestedId: (r.details || '').replace(/^Student ID:\s*/, ''), ids: rows.filter((x) => x.target_id === r.target_id).map((x) => x.id) }))
  },
  closeRequests: (ids, status) => Promise.all(ids.map((id) => admin.handleReport(id, status))),
  verifyAndClose: async (userId) => {
    ok(await sb.rpc('admin_verify_student', { p_user: userId }))
    const open = ok(await sb.from('reports').select('id').eq('target_id', userId).eq('reason', VERIFY_REASON).eq('status', 'open'))
    await admin.closeRequests(open.map((r) => r.id), 'resolved')
  },
  shopDeletions: async () => {
    const rows = ok(await sb.from('reports').select('*').eq('reason', SHOP_DELETE_REASON).eq('status', 'open').order('created_at', { ascending: false }))
    const owners = rows.map((r) => r.target_id)
    const [shops, p] = await Promise.all([owners.length ? sb.from('merchants').select('*').in('owner_id', owners).then(ok) : [], profile.byIds(owners)])
    return rows.map((r) => ({ ...r, owner: p[r.target_id] || null, shop: shops.find((m) => m.owner_id === r.target_id) || null }))
  },
  // Removes the shop. If the database does not allow deleting shops (or it still has orders), the shop is closed instead.
  approveShopDeletion: async (report, shop) => {
    let mode = 'deleted'
    if (shop) {
      const { error } = await sb.from('merchants').delete().eq('id', shop.id)
      if (error) { ok(await sb.from('merchants').update({ is_active: false }).eq('id', shop.id)); mode = 'closed' }
    }
    await admin.handleReport(report.id, 'resolved')
    return mode
  },
  openCounts: async () => {
    const rows = ok(await sb.from('reports').select('reason,target_id').eq('status', 'open'))
    return { verify: new Set(rows.filter((r) => r.reason === VERIFY_REASON).map((r) => r.target_id)).size, shops: rows.filter((r) => r.reason === SHOP_DELETE_REASON).length,
      reports: rows.filter((r) => r.reason !== VERIFY_REASON && r.reason !== SHOP_DELETE_REASON).length }
  },
}
