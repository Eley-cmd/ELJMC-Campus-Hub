import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Send, MoreHorizontal, Pencil, Trash2, Flag, Link2, CalendarPlus, Check, Heart, X, ChevronLeft, ChevronRight, CalendarDays, BarChart3 } from 'lucide-react'
import { feed, polls } from '../api'
import { ago, dateTime, compact } from '../lib/format'
import { googleCalendarUrl, downloadIcs } from '../lib/ics'
import { errText } from '../lib/errors'
import { Avatar, Name, RoleTag, Img, Sheet, Confirm } from './ui'
import ReportSheet from './Report'
import ShareSheet from './ShareSheet'
import { useApp } from '../app/context'

/* ----------------------------- media grid ----------------------------- */
// Tap opens the photo viewer. Double tap hearts the post (like Instagram).
function MediaGrid({ urls, onDouble }) {
  const [open, setOpen] = useState(-1); const last = useRef(0); const timer = useRef()
  const n = urls.length; if (!n) return null
  const shown = urls.slice(0, 4)
  const tap = (i) => {
    const now = Date.now()
    if (now - last.current < 300) { clearTimeout(timer.current); last.current = 0; onDouble?.() }
    else { last.current = now; timer.current = setTimeout(() => setOpen(i), 300) }
  }
  return <>
    <div className={'media m' + Math.min(n, 4)}>
      {shown.map((u, i) => <div key={u + i} className="mcell" onClick={() => tap(i)}>
        <Img src={u} w={n === 1 ? 900 : 500} />{i === 3 && n > 4 && <div className="more-n">+{n - 4}</div>}</div>)}
    </div>
    {open >= 0 && <div className="lightbox" onClick={() => setOpen(-1)}>
      <button className="ibtn lb-x" aria-label="Close"><X size={26} /></button>
      {n > 1 && <button className="ibtn lb-l" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setOpen((open + n - 1) % n) }}><ChevronLeft size={30} /></button>}
      <img src={urls[open]} alt="" onClick={(e) => e.stopPropagation()} />
      {n > 1 && <button className="ibtn lb-r" aria-label="Next" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % n) }}><ChevronRight size={30} /></button>}
    </div>}
  </>
}

/* -------------------------------- poll -------------------------------- */
function Poll({ post, question }) {
  const { toast } = useApp()
  const [poll, setPoll] = useState(post.poll); const [busy, setBusy] = useState(false)
  const closed = poll.expires_at && new Date(poll.expires_at) < new Date()
  const opts = poll.options || []; const total = opts.reduce((a, o) => a + (o.votes_count || 0), 0)
  const refresh = async (myOption) => { const fresh = await polls.get(post.id); if (fresh) setPoll({ ...fresh, options: fresh.poll_options || [], myOption }) }
  const vote = async (o) => {
    if (busy || closed || poll.myOption) return; setBusy(true)
    try { await polls.vote(poll.id, o.id); await refresh(o.id) } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) }
  }
  const retract = async () => { setBusy(true); try { await polls.unvote(poll.id); await refresh(null) } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  const show = poll.myOption || closed
  return <div className="poll">
    <div className="poll-h"><BarChart3 size={16} /> Campus pulse{closed && ' (closed)'}</div>
    {(poll.question && poll.question !== question) && <b>{poll.question}</b>}
    {opts.map((o) => { const pct = total ? Math.round(((o.votes_count || 0) / total) * 100) : 0
      return <button key={o.id} className={'poll-o' + (poll.myOption === o.id ? ' mine' : '')} disabled={busy || closed || !!poll.myOption} onClick={() => vote(o)}>
        {show && <i style={{ width: pct + '%' }} />}<span>{o.option_text}{poll.myOption === o.id && <Check size={14} />}</span>{show && <em>{pct}%</em>}</button> })}
    <div className="poll-f mute">{total} vote{total === 1 ? '' : 's'}{poll.expires_at && !closed && ` - ends ${dateTime(poll.expires_at)}`}
      {poll.myOption && !closed && <button className="link" onClick={retract}>Change vote</button>}</div>
  </div>
}

/* -------------------------------- event -------------------------------- */
function EventBox({ post }) {
  const { toast } = useApp()
  const [going, setGoing] = useState(post.going); const [n, setN] = useState(post.rsvpCount); const [menu, setMenu] = useState(false)
  useEffect(() => { setGoing(post.going); setN(post.rsvpCount) }, [post.going, post.rsvpCount])
  if (!post.is_event || !post.event_time) return null
  const d = new Date(post.event_time), past = d < new Date()
  const toggle = async () => { const on = !going; setGoing(on); setN(n + (on ? 1 : -1)); try { await feed.rsvp(post.id, on) } catch (e) { setGoing(!on); setN(n); toast(errText(e), 'err') } }
  const title = (post.content || 'Campus event').split('\n')[0]
  return <div className="event">
    <div className="cal"><small>{d.toLocaleString(undefined, { month: 'short' })}</small><b>{d.getDate()}</b></div>
    <div className="grow"><b>{d.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</b>
      <div className="mute"><CalendarDays size={13} /> {dateTime(d)} - {n} going</div></div>
    <div className="event-a">
      <button className={'btn sm' + (going ? '' : ' ghost')} disabled={past} onClick={toggle}>{going ? <><Check size={14} /> Going</> : "I'm going"}</button>
      <div className="menu-wrap"><button className="ibtn" aria-label="Add to calendar" onClick={() => setMenu(!menu)}><CalendarPlus size={20} /></button>
        {menu && <div className="menu" onMouseLeave={() => setMenu(false)}>
          <a href={googleCalendarUrl(title, post.event_time)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>Google Calendar</a>
          <button onClick={() => { downloadIcs(title, post.event_time); setMenu(false) }}>Download .ics</button></div>}</div>
    </div></div>
}

/* ---------------------------- edit post sheet ---------------------------- */
function EditSheet({ post, onClose, onSaved }) {
  const { toast } = useApp()
  const [text, setText] = useState(post.content || ''); const [media, setMedia] = useState(post.media_urls || []); const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await feed.edit(post.id, { content: text.trim(), media_urls: media }); toast('Post updated'); onSaved(); onClose() }
    catch (e) { toast(errText(e), 'err') } finally { setBusy(false) }
  }
  return <Sheet title="Edit post" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || (!text.trim() && !media.length)} onClick={save}>Save</button></>}>
    <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
    {!!media.length && <div className="preview">{media.map((u) => <div key={u}><Img src={u} w={200} /><button aria-label="Remove image" onClick={() => setMedia(media.filter((x) => x !== u))}><X size={14} /></button></div>)}</div>}
  </Sheet>
}

/* --------------------------------- card --------------------------------- */
export default function Post({ p, boards = {}, full, onChange, onDeleted }) {
  const { isAdmin, toast } = useApp(); const nav = useNavigate()
  const [my, setMy] = useState(p.myReaction); const [counts, setCounts] = useState(p.reactionCounts || {})
  const [menu, setMenu] = useState(false); const [sheet, setSheet] = useState(null); const [more, setMore] = useState(false); const [burst, setBurst] = useState(false)
  useEffect(() => { setMy(p.myReaction); setCounts(p.reactionCounts || {}) }, [p.myReaction, p.reactionCounts])

  const anonymous = !p.author_id
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const text = p.content || ''; const long = !full && text.length > 280 && !more

  // One reaction only: the heart. onlyAdd = double tap (never removes the heart)
  const heart = async (onlyAdd) => {
    if (onlyAdd) { setBurst(true); setTimeout(() => setBurst(false), 750); if (my) return }
    const prev = my, prevCounts = counts, next = prev ? null : 'love'
    const c = { ...counts }; if (prev) c[prev] = Math.max(0, (c[prev] || 0) - 1); if (next) c[next] = (c[next] || 0) + 1
    setMy(next); setCounts(c)
    try { await feed.react(p.id, next, prev) }
    catch (e) {
      if (next && ['22P02', '23514'].includes(e.code)) { // the database only knows "like": store the heart as that
        try { await feed.react(p.id, 'like', prev); const c2 = { ...prevCounts }; if (prev) c2[prev] = Math.max(0, (c2[prev] || 0) - 1); c2.like = (c2.like || 0) + 1; setMy('like'); setCounts(c2); return } catch { /* fall through */ }
      }
      setMy(prev); setCounts(prevCounts); toast(errText(e), 'err')
    }
  }
  const copyLink = async () => { try { await navigator.clipboard.writeText(`${location.origin}/post/${p.id}`); toast('Link copied') } catch { toast('Could not copy the link', 'err') } }
  const mine = p.is_mine; const board = p.channel_id ? boards[p.channel_id] : null

  return <article className="card post">
    <div className="row top">
      {anonymous ? <Avatar anonymous /> : <Link to={`/profile/${p.author.username}`}><Avatar p={p.author} dot /></Link>}
      <div className="grow">
        <div className="row wrap tight">{anonymous ? <Name anonymous /> : <Link to={`/profile/${p.author.username}`}><Name p={p.author} /></Link>}<RoleTag p={p.author} />{mine && <span className="tag me">You</span>}</div>
        <div className="mute small">{ago(p.created_at)}{board && <> &middot; <Link to={`/channel/${p.channel_id}`} className="board">{board}</Link></>}{p.updated_at && p.updated_at !== p.created_at && ' - edited'}</div>
      </div>
      <div className="menu-wrap"><button className="ibtn" aria-label="More" onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>
        {menu && <div className="menu" onMouseLeave={() => setMenu(false)}>
          <button onClick={() => { setMenu(false); copyLink() }}><Link2 size={15} /> Copy link</button>
          {mine && <button onClick={() => { setMenu(false); setSheet('edit') }}><Pencil size={15} /> Edit</button>}
          {(mine || isAdmin) && <button className="dng" onClick={() => { setMenu(false); setSheet('delete') }}><Trash2 size={15} /> Delete</button>}
          {!mine && <button onClick={() => { setMenu(false); setSheet('report') }}><Flag size={15} /> Report</button>}</div>}</div>
    </div>

    {text && <div className={'body' + (full ? ' full' : '')} onClick={() => !full && nav(`/post/${p.id}`)} style={{ cursor: full ? 'auto' : 'pointer' }}>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{long ? text.slice(0, 280).trimEnd() + '...' : text}</p>
      {long && <button className="link" onClick={(e) => { e.stopPropagation(); setMore(true) }}>See more</button>}</div>}
    <EventBox post={p} />
    {p.poll && <Poll post={p} question={text} />}
    {!!p.media_urls?.length && <div className="burstwrap"><MediaGrid urls={p.media_urls} onDouble={() => heart(true)} />{burst && <Heart className="burst" size={96} fill="currentColor" />}</div>}

    {/* Instagram-style action row: heart, comment, share. The numbers sit next to the icons. */}
    <div className="acts ig">
      <button className={'ab' + (my ? ' on' : '')} onClick={() => heart(false)} aria-pressed={!!my} aria-label={my ? 'Remove heart' : 'Heart'}>
        <Heart size={26} fill={my ? 'currentColor' : 'none'} /><span>{total > 0 ? compact(total) : ''}</span></button>
      <Link className="ab" to={`/post/${p.id}`} aria-label="Comments"><MessageCircle size={26} /><span>{p.commentCount > 0 ? compact(p.commentCount) : ''}</span></Link>
      <button className="ab" onClick={() => setSheet('share')} aria-label="Share"><Send size={25} /></button>
    </div>

    {sheet === 'edit' && <EditSheet post={p} onClose={() => setSheet(null)} onSaved={() => onChange?.()} />}
    {sheet === 'report' && <ReportSheet type="post" id={p.id} onClose={() => setSheet(null)} />}
    {sheet === 'share' && <ShareSheet post={p} onClose={() => setSheet(null)} />}
    {sheet === 'delete' && <Confirm title="Delete post" text="This post and its comments will be removed for everyone." action="Delete" danger onClose={() => setSheet(null)}
      onYes={async () => { try { await feed.remove(p.id); toast('Post deleted'); onDeleted?.(p.id); onChange?.() } catch (e) { toast(errText(e), 'err') } }} />}
  </article>
}
