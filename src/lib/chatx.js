// src/lib/chatx.js  (NEW FILE - nothing existing is changed)
// Extra chat functions for reply / edit / delete / forward / typing / create channel.
//
// >>> ONE LINE TO CHECK: this must import the SAME supabase client your src/api uses.
// Open src/api (the file with `export const chat = ...`), find its import of the client
// (search for "createClient" or "supabase") and copy the path here.
import { supabase } from './supabase'

export const chatx = {
  // latest 200 messages of a chat, oldest first. select('*') so the new columns come along
  async messages(channelId, limit = 200) {
    const { data, error } = await supabase.from('channel_messages').select('*')
      .eq('channel_id', channelId).order('created_at', { ascending: false }).limit(limit)
    if (error) throw error
    return (data || []).reverse()
  },

  // also used for forwarding (forwarded: true)
  async send(channelId, userId, content, { replyTo = null, forwarded = false } = {}) {
    const row = { channel_id: channelId, sender_id: userId, content }
    if (replyTo) row.reply_to_id = replyTo
    if (forwarded) row.forwarded = true
    const { data, error } = await supabase.from('channel_messages').insert(row).select('*').single()
    if (error) throw error
    return data
  },

  async edit(id, content) {
    const { error } = await supabase.rpc('edit_message', { p_id: id, p_content: content })
    if (error) throw error
  },

  async remove(id) {
    const { error } = await supabase.rpc('delete_message', { p_id: id })
    if (error) throw error
  },

  // new / edited / deleted rows (needs channel_messages in the realtime publication, see chat_upgrade.sql)
  subscribe(channelId, onRow) {
    const ch = supabase.channel('msgs:' + channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        (p) => { if (p.new && p.new.id) onRow(p.new) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },

  // "typing..." indicator: broadcast only, nothing is stored in the database
  typing(channelId, me, onTyping) {
    const ch = supabase.channel('typing:' + channelId, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => payload && onTyping(payload)).subscribe()
    return {
      ping: () => ch.send({ type: 'broadcast', event: 'typing', payload: { id: me.id, name: me.display_name } }),
      stop: () => { supabase.removeChannel(ch) },
    }
  },

  // remove a DM or group from MY chat list (needs chat_delete.sql)
  async deleteChat(channelId) {
    const { error } = await supabase.rpc('delete_chat', { p_channel: channelId })
    if (error) throw error
  },

  // admins only (the V2 policy "Admins manage channels")
  async createChannel(name, category) {
    const { data, error } = await supabase.from('channels').insert({ name, category }).select('*').single()
    if (error) throw error
    return data
  },
}