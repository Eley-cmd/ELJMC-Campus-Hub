import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Send, Users, MessageSquarePlus, LogOut, Flag, Search, Check, UserRound, Reply, Pencil, Trash2, Forward, Copy, MoreHorizontal, X, Hash } from 'lucide-react'
import { chat, channels, friends, profile } from '../api'
import { chatx } from '../lib/chatx'
import { useQuery, usePoll } from '../ui/hooks'
import { ChatRowSkeleton, MessageSkeleton, Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import { Avatar, Empty, ErrorBox, Sheet, Field, Confirm, PageTitle } from '../components/ui'
import ReportSheet from '../components/Report'
import { useApp } from '../app/context'
import { ago, clock, dateTime } from '../lib/format'
import { errText } from '../lib/errors'

/* ------------------------------ new chat sheet ------------------------------ */
function NewChat({ onClose }) {
  const nav = useNavigate(); const { toast } = useApp()
  const [mode, setMode] = useState('dm'); const [q, setQ] = useState(''); const [name, setName] = useState(''); const [sel, setSel] = useState([]); const [busy, setBusy] = useState(false); const [found, setFound] = useState([])
  const fr = useQuery('friends', friends.list)
  useEffect(() => {
    if (q.trim().length < 2) return setFound([])
    const t = setTimeout(() => profile.search(q.trim()).then(setFound, () => {}), 300); return () => clearTimeout(t)
  }, [q])
  const list = q.trim().length >= 2 ? found : fr.data || []
  const dm = async (u) => { setBusy(true); try { const id = await chat.openDm(u.id); onClose(); nav(`/chat/${id}`) } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  const group = async () => { setBusy(true); try { const id = await chat.createGroup(name.trim(), sel); onClose(); nav(`/chat/${id}`) } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  return <Sheet title="New chat" onClose={onClose} footer={mode === 'group' && <button type="button" className="btn" disabled={busy || !name.trim() || !sel.length} onClick={group}>Create group ({sel.length + 1}/50)</button>}>
    <div className="seg small-seg"><button type="button" className={mode === 'dm' ? 'on' : ''} onClick={() => setMode('dm')}><MessageSquarePlus size={15} /> Message</button>
      <button type="button" className={mode === 'group' ? 'on' : ''} onClick={() => setMode('group')}><Users size={15} /> Group</button></div>
    {mode === 'group' && <Field label="Group name"><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MATH101 study group" /></Field>}
    <div className="inp" style={{ margin: '10px 0' }}><Search size={18} /><input placeholder={mode === 'dm' ? 'Search by name or username' : 'Add friends or search people'} value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {fr.loading && !q ? <Skeletons n={4} C={ListRowSkeleton} /> : !list.length ? <Empty Icon={UserRound} title={q ? 'No one found' : 'No friends yet'} hint={q ? undefined : 'Scan a friend\'s QR code, or search by name above.'} />
      : list.map((u) => { const on = sel.includes(u.id)
        return <button type="button" key={u.id} className="row pad listbtn" disabled={busy} onClick={() => (mode === 'dm' ? dm(u) : setSel(on ? sel.filter((x) => x !== u.id) : [...sel, u.id]))}>
          <Avatar p={u} size={42} /><div className="grow left"><b>{u.display_name}</b><div className="mute small">@{u.username}</div></div>{mode === 'group' && <span className={'check' + (on ? ' on' : '')}>{on && <Check size={14} />}</span>}</button> })}
  </Sheet>
}

/* --------------------------------- chat list --------------------------------- */
export function Chats() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useQuery('chats', chat.mine); const [del, setDel] = useState(null)
  const [newOpen, setNew] = useState(false)
  const [q, setQ] = useState(''); const needle = q.trim().toLowerCase()
  const list = (data || []).filter((c) => !needle || c.title?.toLowerCase().includes(needle) || c.last?.content?.toLowerCase().includes(needle))
  usePoll(reload, 15000)
  // The "Start a chat" button sits below the message or below the list, like "Open my shop" in Shop
  const startBtn = <button type="button" className="btn sm" onClick={() => setNew(true)}><MessageSquarePlus size={15} /> Start a chat</button>
  return <>
    <div className="shopsearch"><div className="inp"><Search size={18} /><input placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <button type="button" className="ibtn" aria-label="Clear" onClick={() => setQ('')}><X size={16} /></button>}</div></div>
    {loading ? <Skeletons n={6} C={ChatRowSkeleton} /> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={MessageSquarePlus} title="No chats yet" hint="Message a friend or classmate.">{startBtn}</Empty>
      : !list.length ? <Empty Icon={Search} title="No chats found" hint="Try another word." />
      : <><div className="card flush">{list.map((c) => <div key={c.id} className="chatwrap">
        <Link to={`/chat/${c.id}`} className="row pad chatrow">
          <Avatar p={c.peer || { display_name: c.title }} size={48} dot />
          <div className="grow minw"><div className="row between"><b className="ell">{c.title}</b><span className="mute small">{c.last && ago(c.last.created_at)}</span></div>
            <div className="mute ell">{c.last?.content || 'No messages yet'}</div></div></Link>
        <button type="button" className="ibtn chatdel" aria-label={`Delete chat with ${c.title}`} onClick={() => setDel(c)}><Trash2 size={18} /></button></div>)}</div>
        {!q && <div className="center" style={{ padding: '4px 0 16px' }}>{startBtn}</div>}</>}
    {newOpen && <NewChat onClose={() => setNew(false)} />}
    {del && <Confirm title="Delete chat" text={`Delete "${del.title}"? It disappears from your chats. Other people in a group keep it, and a new message can bring it back.`} action="Delete" danger onClose={() => setDel(null)}
      onYes={async () => { try { await chatx.deleteChat(del.id); toast('Chat deleted'); reload() } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}

export const ChatsPage = () => <><PageTitle>Chats</PageTitle><Chats /></>

// Links in messages (like a shared post) are clickable
const linkify = (t) => String(t || '').split(/(https?:\/\/\S+)/g).map((x, i) => {
  if (!/^https?:\/\//.test(x)) return x
  try { const u = new URL(x); if (u.origin === location.origin) return <Link key={i} className="msglink" to={u.pathname + u.search}>{u.pathname.startsWith('/post/') ? 'View post' : x}</Link>
    return <a key={i} className="msglink" href={x} target="_blank" rel="noreferrer">{x}</a> } catch { return x }
})

const GAP = 20 * 60 * 1000 // a new time label appears after 20 minutes of silence

/* ------------------------------- forward sheet ------------------------------- */
function ForwardSheet({ m, onClose }) {
  const { me, toast } = useApp()
  const mine = useQuery('chats', chat.mine); const pub = useQuery('channels', channels.list)
  const [q, setQ] = useState(''); const [sel, setSel] = useState([]); const [busy, setBusy] = useState(false)
  const all = [...(mine.data || []).map((c) => ({ id: c.id, title: c.title, peer: c.peer })),
    ...(pub.data || []).filter((c) => !c.is_direct).map((c) => ({ id: c.id, title: '# ' + c.name, channel: true }))]
  const list = all.filter((c) => c.title?.toLowerCase().includes(q.trim().toLowerCase()))
  const go = async () => {
    setBusy(true)
    try { for (const id of sel) await chatx.send(id, me.id, m.content, { forwarded: true }); toast(sel.length > 1 ? 'Forwarded to ' + sel.length + ' chats' : 'Forwarded'); onClose() }
    catch (e) { toast(errText(e), 'err') } finally { setBusy(false) }
  }
  return <Sheet title="Forward to" onClose={onClose} footer={<button type="button" className="btn" disabled={busy || !sel.length} onClick={go}>{busy ? 'Sending' : `Send${sel.length ? ' (' + sel.length + ')' : ''}`}</button>}>
    <div className="msgprev ell">{m.content}</div>
    <div className="inp"><Search size={18} /><input placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {(mine.loading && !mine.data) ? <Skeletons n={4} C={ListRowSkeleton} /> : !list.length ? <Empty Icon={UserRound} title="No chats found" />
      : list.map((c) => { const on = sel.includes(c.id)
        return <button type="button" key={c.id} className="row pad listbtn" onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])}>
          {c.channel ? <span className="chico"><Hash size={18} /></span> : <Avatar p={c.peer || { display_name: c.title }} size={42} />}
          <b className="grow left ell">{c.title}</b><span className={'check' + (on ? ' on' : '')}>{on && <Check size={14} />}</span></button> })}
  </Sheet>
}

/* --------------------- messages + composer (used by chats AND channels) --------------------- */
// Put it inside an element with className="thread" (or "thread embedded").
export function ThreadBody({ id, members, isDirect }) {
  const { me, toast } = useApp()
  const [msgs, setMsgs] = useState(null); const [err, setErr] = useState(null); const [text, setText] = useState(''); const [sending, setSending] = useState(false)
  const [senders, setSenders] = useState({}); const [reply, setReply] = useState(null); const [editing, setEditing] = useState(null)
  const [menu, setMenu] = useState(null); const [fwd, setFwd] = useState(null); const [del, setDel] = useState(null); const [typers, setTypers] = useState({}); const [flash, setFlash] = useState(null)
  const end = useRef(); const stick = useRef(true); const inRef = useRef(); const lp = useRef(); const typingApi = useRef(null); const lastPing = useRef(0)

  const merge = (rows) => setMsgs((cur) => {
    const map = new Map((cur || []).map((m) => [m.id, m])); rows.forEach((m) => map.set(m.id, m))
    return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  })
  const load = () => chatx.messages(id).then((r) => {
    setErr(null)
    setMsgs((cur) => { // keep a message you just sent until the server list includes it
      const ids = new Set(r.map((x) => x.id)); const now = Date.now()
      const extra = (cur || []).filter((m) => m.__t && now - m.__t < 10000 && !ids.has(m.id))
      return [...r, ...extra].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })
  }, (e) => setErr(e))
  useEffect(() => { setMsgs(null); setReply(null); setEditing(null); setText(''); load(); return chatx.subscribe(id, (m) => merge([m])) }, [id]) // eslint-disable-line
  usePoll(load, 3500) // backup in case realtime is not enabled yet

  useEffect(() => { // typing indicator (broadcast only)
    if (!me) return
    const api = chatx.typing(id, me, (p) => { if (p.id !== me.id) setTypers((t) => ({ ...t, [p.id]: { name: p.name, ts: Date.now() } })) })
    typingApi.current = api
    return () => { typingApi.current = null; api.stop() }
  }, [id, me?.id]) // eslint-disable-line
  useEffect(() => {
    const t = setInterval(() => setTypers((cur) => {
      const now = Date.now(); const next = {}; let changed = false
      Object.entries(cur).forEach(([k, v]) => { if (now - v.ts < 3500) next[k] = v; else changed = true })
      return changed ? next : cur
    }), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { // names for people who wrote messages
    const missing = [...new Set((msgs || []).map((m) => m.sender_id))].filter((x) => x && !senders[x] && !members?.[x])
    if (missing.length) profile.byIds(missing).then((p) => setSenders((s) => ({ ...s, ...p })), () => {})
  }, [msgs, members]) // eslint-disable-line
  const typingList = Object.entries(typers)
  useEffect(() => { if (stick.current) end.current?.scrollIntoView({ block: 'end' }) }, [msgs, typingList.length])

  const byId = useMemo(() => new Map((msgs || []).map((m) => [m.id, m])), [msgs])
  const who = (uid) => members?.[uid] || senders[uid]
  const nameOf = (uid) => (uid === me?.id ? 'You' : who(uid)?.display_name || 'Someone')

  const onType = (e) => {
    const v = e.target.value; setText(v)
    if (v && Date.now() - lastPing.current > 2000) { lastPing.current = Date.now(); typingApi.current?.ping() }
  }
  const send = async () => {
    const v = text.trim(); if (!v || sending || !me) return; setSending(true)
    if (editing) {
      try { await chatx.edit(editing.id, v); merge([{ ...editing, content: v, edited_at: new Date().toISOString() }]); setEditing(null); setText('') }
      catch (e) { toast(errText(e), 'err') } finally { setSending(false) }
      return
    }
    const rp = reply; setText(''); setReply(null)
    try { const m = await chatx.send(id, me.id, v, { replyTo: rp?.id }); merge([{ ...m, __t: Date.now() }]); stick.current = true }
    catch (e) { setText(v); setReply(rp); toast(errText(e), 'err') } finally { setSending(false) }
  }
  const startReply = (m) => { setEditing(null); setReply(m); inRef.current?.focus() }
  const startEdit = (m) => { setReply(null); setEditing(m); setText(m.content); inRef.current?.focus() }
  const cancelBar = () => { setReply(null); if (editing) { setEditing(null); setText('') } }
  const jump = (mid) => { const el = document.getElementById('m-' + mid); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFlash(mid); setTimeout(() => setFlash(null), 1400) }
  const press = (m) => { clearTimeout(lp.current); lp.current = setTimeout(() => setMenu(m), 450) }
  const unpress = () => clearTimeout(lp.current)
  const copy = async (m) => { try { await navigator.clipboard.writeText(m.content); toast('Copied') } catch { toast('Could not copy', 'err') } }
  const canDelete = (m) => m.sender_id === me?.id || me?.role === 'admin'
  const act = (fn) => { const m = menu; setMenu(null); fn(m) }

  return <>
    <div className="thread-b" onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }}>
      {msgs === null ? (err ? <ErrorBox error={err} retry={load} /> : <MessageSkeleton />)
        : !msgs.length ? <Empty Icon={MessageSquarePlus} title="Say hello" hint={isDirect ? 'Messages you send here are private to this chat.' : 'Be the first to write something.'} />
        : msgs.map((m, i) => {
          const mine = m.sender_id === me?.id, u = who(m.sender_id), prev = msgs[i - 1], next = msgs[i + 1]
          const close = (a, b) => a && b && a.sender_id === b.sender_id && Math.abs(new Date(b.created_at) - new Date(a.created_at)) < GAP
          const sameP = close(prev, m), sameN = close(m, next), sep = !prev || new Date(m.created_at) - new Date(prev.created_at) >= GAP
          const gone = !!m.deleted_at, rp = m.reply_to_id ? byId.get(m.reply_to_id) : null
          const more = <button type="button" className="msg-more" aria-label="Message options" onClick={() => setMenu(m)}><MoreHorizontal size={16} /></button>
          return <Fragment key={m.id}>
            {sep && <div className="tsep">{dateTime(m.created_at)}</div>}
            <div id={'m-' + m.id} className={'msg pop' + (mine ? ' mine' : '') + (sameP ? ' g-top' : '') + (sameN ? ' g-bot' : '') + (flash === m.id ? ' flash' : '')}>
              {mine && more}
              {!mine && (!sameN ? <Avatar p={u || { display_name: '?' }} size={30} /> : <span style={{ width: 30, flex: 'none' }} />)}
              <div className="bub-wrap">
                {!mine && !sameP && !isDirect && <small className="mute">{u?.display_name || '...'}</small>}
                <div className={'bubble' + (gone ? ' gone-b' : '')} onContextMenu={(e) => { e.preventDefault(); setMenu(m) }}
                  onPointerDown={() => press(m)} onPointerUp={unpress} onPointerLeave={unpress} onPointerCancel={unpress}>
                  {gone ? <i className="gone">{mine ? 'You removed a message' : 'Message removed'}</i> : <>
                    {m.forwarded && <div className="fwdlabel"><Forward size={11} /> Forwarded</div>}
                    {m.reply_to_id && <button type="button" className="quote" onClick={() => rp && jump(rp.id)}>
                      <b>{rp ? nameOf(rp.sender_id) : 'Message'}</b><span>{rp ? (rp.deleted_at ? 'Message removed' : rp.content) : 'Original message'}</span></button>}
                    {linkify(m.content)}{m.edited_at && <span className="edited">edited</span>}</>}
                </div>
                {!sameN && <small className="mute time">{clock(m.created_at)}</small>}
              </div>
              {mine && (!sameN ? <Avatar p={me} size={30} /> : <span style={{ width: 30, flex: 'none' }} />)}
              {!mine && more}
            </div></Fragment>
        })}
      {err && msgs && <div className="mute center small">Connection problem. Retrying...</div>}
      {typingList.length > 0 && <div className="msg pop"><Avatar p={who(typingList[0][0]) || { display_name: typingList[0][1].name || '?' }} size={30} />
        <div className="bub-wrap">{!isDirect && <small className="mute">{typingList.map(([, v]) => v.name).join(', ')} {typingList.length > 1 ? 'are' : 'is'} typing</small>}
          <div className="bubble typing" aria-label="Typing"><i /><i /><i /></div></div></div>}
      <div ref={end} /></div>

    {(reply || editing) && <div className="thread-bar">
      {editing ? <><Pencil size={16} /><div><b>Editing message</b><div className="mute ell">{editing.content}</div></div></>
        : <><Reply size={16} /><div><b>Replying to {nameOf(reply.sender_id)}</b><div className="mute ell">{reply.content}</div></div></>}
      <button type="button" className="ibtn" aria-label="Cancel" onClick={cancelBar}><X size={18} /></button></div>}
    <div className="thread-f"><input ref={inRef} className="msg-in" placeholder={editing ? 'Edit your message' : 'Type here a message'} maxLength={4000} value={text} onChange={onType}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } else if (e.key === 'Escape') cancelBar() }} />
      <button type="button" className="send" onClick={send} disabled={!text.trim() || sending} aria-label={editing ? 'Save' : 'Send'}>{editing ? <Check size={20} /> : <Send size={20} />}</button></div>

    {menu && <Sheet title="Message" onClose={() => setMenu(null)}>
      {!menu.deleted_at && <div className="msgprev">{menu.content}</div>}
      {!menu.deleted_at && <>
        <button type="button" className="msgact" onClick={() => act(startReply)}><Reply size={20} /> Reply</button>
        <button type="button" className="msgact" onClick={() => act(setFwd)}><Forward size={20} /> Forward</button>
        <button type="button" className="msgact" onClick={() => act(copy)}><Copy size={20} /> Copy</button>
        {menu.sender_id === me?.id && <button type="button" className="msgact" onClick={() => act(startEdit)}><Pencil size={20} /> Edit</button>}
        {canDelete(menu) && <button type="button" className="msgact dng" onClick={() => act(setDel)}><Trash2 size={20} /> {menu.sender_id === me?.id ? 'Remove' : 'Remove (moderator)'}</button>}</>}
      {menu.deleted_at && <p className="mute" style={{ margin: 0 }}>This message was removed.</p>}
    </Sheet>}
    {fwd && <ForwardSheet m={fwd} onClose={() => setFwd(null)} />}
    {del && <Confirm title="Remove message" text="This removes the message for everyone in this chat." action="Remove" danger onClose={() => setDel(null)}
      onYes={async () => { try { await chatx.remove(del.id); merge([{ ...del, deleted_at: new Date().toISOString(), content: '[deleted]' }]) } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}

/* ---------------------------------- thread page ---------------------------------- */
export function Thread() {
  const { id } = useParams(); const nav = useNavigate(); const { toast } = useApp()
  const info = useQuery('chatinfo:' + id, () => chat.info(id)); const [sheet, setSheet] = useState(null)
  const title = info.data?.title || 'Chat'
  return <div className="thread">
    <div className="thread-h row"><button type="button" className="ibtn" onClick={() => nav('/chat')} aria-label="Back"><ChevronLeft /></button>
      {info.loading ? <><div className="sk round" style={{ width: 36, height: 36 }} /><div className="sk" style={{ width: 120, height: 14 }} /></>
        : <><Avatar p={info.data?.peer || { display_name: title }} size={36} dot /><b className="grow ell">{title}</b></>}
      {info.data && !info.data.isDirect && <button type="button" className="ibtn" aria-label="Leave group" onClick={() => setSheet('leave')}><LogOut size={19} /></button>}
      {info.data?.isDirect && <button type="button" className="ibtn" aria-label="Delete chat" onClick={() => setSheet('delete')}><Trash2 size={19} /></button>}
      {info.data?.isDirect && info.data.peer && <button type="button" className="ibtn" aria-label="Report user" onClick={() => setSheet('report')}><Flag size={19} /></button>}</div>
    <ThreadBody id={id} members={info.data?.members} isDirect={!!info.data?.isDirect} />
    {sheet === 'leave' && <Confirm title="Leave group" text="You will stop receiving messages from this group." action="Leave" danger onClose={() => setSheet(null)}
      onYes={async () => { try { await chat.leave(id); nav('/chat') } catch (e) { toast(errText(e), 'err') } }} />}
    {sheet === 'delete' && <Confirm title="Delete chat" text="This chat disappears from your list. A new message from the other person can bring it back." action="Delete" danger onClose={() => setSheet(null)}
      onYes={async () => { try { await chatx.deleteChat(id); nav('/chat') } catch (e) { toast(errText(e), 'err') } }} />}
    {sheet === 'report' && info.data?.peer && <ReportSheet type="user" id={info.data.peer.id} onClose={() => setSheet(null)} />}
  </div>
}