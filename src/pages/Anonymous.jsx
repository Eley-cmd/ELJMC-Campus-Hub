import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Ghost, Send, X, Flag, PowerOff, Search, ShieldCheck } from 'lucide-react'
import { anon } from '../api'
import { usePoll, useViewportHeight } from '../ui/hooks'
import { MessageSkeleton } from '../ui/Skeleton'
import { Avatar, Empty, ErrorBox } from '../components/ui'
import ReportSheet from '../components/Report'
import { useApp } from '../app/context'
import { clock } from '../lib/format'
import { errText } from '../lib/errors'

// Interest-based anonymous 1-on-1 chat. The server only ever tells you your slot (a or b), never who the partner is.
export default function Anonymous() {
  const nav = useNavigate(); const { toast, suspension } = useApp()
  const [phase, setPhase] = useState('boot') // boot | idle | waiting | chat | ended
  const [tags, setTags] = useState([]); const [draft, setDraft] = useState(''); const [session, setSession] = useState(null); const [slot, setSlot] = useState('a')
  const [msgs, setMsgs] = useState([]); const [t, setT] = useState(''); const [err, setErr] = useState(null); const [report, setReport] = useState(false); const end = useRef(); const box = useRef(); const ta = useRef()

  const enter = (sid, s, sharedTags) => { setSession(sid); setSlot(s); setPhase('chat'); setMsgs(sharedTags?.length ? [{ id: 'sys-tags', slot: 's', content: `You both like: ${sharedTags.join(', ')}`, created_at: new Date().toISOString() }] : []) }
  // Resume an active session after a page reload
  useEffect(() => { anon.mine().then((m) => (m ? enter(m.session_id, m.slot) : setPhase('idle')), () => setPhase('idle')) }, [])
  // Waiting: ask again every 4 s (this also keeps our queue entry fresh; the server drops entries older than 2 minutes)
  const tryJoin = async () => {
    try { const r = await anon.join(tags); setErr(null); if (r.status === 'matched') enter(r.session_id, r.slot, r.shared_tags); else setPhase('waiting') }
    catch (e) { setErr(e); if (phase === 'waiting') setPhase('idle') }
  }
  usePoll(tryJoin, 4000, phase === 'waiting')

  const merge = (rows) => setMsgs((cur) => { const m = new Map(cur.map((x) => [x.id, x])); rows.forEach((x) => m.set(x.id, x)); return [...m.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) })
  useEffect(() => {
    if (phase !== 'chat' || !session) return
    anon.history(session).then(merge, () => {})
    return anon.subscribe(session, (m) => merge([m]))
  }, [phase, session])
  usePoll(() => anon.history(session).then(merge, () => {}), 3000, phase === 'chat') // fallback if the websocket drops on a poor network
  useEffect(() => { if (msgs.some((m) => m.slot === 's' && m.content === 'session_ended')) setPhase('ended') }, [msgs])
  const toBottom = () => { const el = box.current; if (el) el.scrollTop = el.scrollHeight } // scroll the list only, never the page
  useViewportHeight(toBottom)
  useEffect(toBottom, [msgs, phase])
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }, [t])
  const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches // Enter sends on a computer, adds a new line on a phone

  const addTag = () => { const v = draft.trim().toLowerCase().slice(0, 30); if (v && !tags.includes(v) && tags.length < 10) setTags([...tags, v]); setDraft('') }
  const start = async () => { setPhase('waiting'); setErr(null); await tryJoin() }
  const cancel = async () => { try { await anon.leave() } catch { /* ignore */ } setPhase('idle') }
  const send = async () => {
    const v = t.trim(); if (!v) return; setT('')
    try { const id = await anon.send(session, v); merge([{ id, session_id: session, slot, content: v, created_at: new Date().toISOString() }]) } catch (e) { setT(v); toast(errText(e), 'err') }
  }
  const end_ = async () => { try { await anon.end(session) } catch (e) { toast(errText(e), 'err') } setPhase('ended') }
  const again = () => { setSession(null); setMsgs([]); setPhase('idle') }

  const Head = <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Anonymous chat</h1></div>

  if (phase === 'boot') return <>{Head}<MessageSkeleton /></>
  if (phase === 'chat' || phase === 'ended') return <div className="thread">
    <div className="thread-h row"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><Avatar anonymous size={40} /><div className="grow minw"><b className="ell" style={{ display: 'block' }}>Stranger</b><div className="mute small">{phase === 'ended' ? 'Chat ended' : 'Anonymous chat'}</div></div>
      {phase === 'chat' && <><button className="ibtn" aria-label="Report" onClick={() => setReport(true)}><Flag size={19} /></button><button className="ibtn" aria-label="End chat" onClick={end_}><PowerOff size={19} /></button></>}</div>
    <div className="thread-b" ref={box}>
      <div className="notice"><ShieldCheck size={15} /> Messages are deleted when the chat ends. A moderation copy is kept for 90 days.</div>
      {msgs.filter((m) => m.content !== 'session_ended').map((m) => m.slot === 's' ? <div key={m.id} className="mute center small">{m.content}</div>
        : <div key={m.id} className={'msg' + (m.slot === slot ? ' mine' : '')}>{m.slot !== slot && <Avatar anonymous size={30} />}<div className="bub-wrap"><div className="bubble">{m.content}</div><small className="mute time">{clock(m.created_at)}</small></div></div>)}
      {phase === 'ended' && <div className="card center" style={{ margin: '12px 0' }}><p>This chat has ended.</p><button className="btn" onClick={again}>Find someone new</button></div>}
      <div ref={end} /></div>
    {phase === 'chat' && <div className="thread-f"><textarea ref={ta} className="msg-in" rows={1} placeholder="Aa" maxLength={2000} value={t} onChange={(e) => setT(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && fine) { e.preventDefault(); send() } }} />
      {t.trim() && <button type="button" className="send" onClick={send} aria-label="Send"><Send size={20} /></button>}</div>}
    {report && <ReportSheet type="anonymous_session" id={session} onClose={() => setReport(false)} />}
  </div>

  return <>{Head}
    <div className="card center anon-hero"><span className="anon-ico"><Ghost size={34} /></span><h2>Meet someone new</h2>
      <p className="mute">Chat 1-on-1 with a classmate who shares your interests. Nobody sees your name.</p>
      {suspension && <div className="err">Your account is suspended, so matching is turned off.</div>}
      <div className="taginput"><div className="chips wrapchips">{tags.map((x) => <span key={x} className="chip-lite on">{x}<button aria-label={`Remove ${x}`} onClick={() => setTags(tags.filter((y) => y !== x))}><X size={12} /></button></span>)}</div>
        <div className="row"><input className="input" placeholder={tags.length >= 10 ? 'Max 10 interests' : 'Add an interest, e.g. anime'} value={draft} disabled={tags.length >= 10} maxLength={30} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())} />
          <button className="btn sm ghost" onClick={addTag} disabled={!draft.trim()}>Add</button></div></div>
      {err && <ErrorBox compact error={err} />}
      {phase === 'waiting' ? <><div className="radar"><Search size={22} /></div><p className="mute">Looking for someone{tags.length ? ' who likes ' + tags.slice(0, 3).join(', ') : ''}...</p><button className="btn ghost" onClick={cancel}>Cancel</button></>
        : <button className="btn" disabled={!!suspension} onClick={start}><Search size={18} /> Find a match</button>}
      <p className="mute small">With no interests, you can match with anyone.</p></div></>
}