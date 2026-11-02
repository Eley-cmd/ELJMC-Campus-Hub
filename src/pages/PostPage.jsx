import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Heart, CornerDownRight, Send, MoreHorizontal, Pencil, Trash2, Flag, EyeOff, X, ArrowDownUp, UserCheck, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { feed, comments } from '../api'
import { useQuery } from '../ui/hooks'
import { PostSkeleton, CommentSkeleton } from '../ui/Skeleton'
import { Avatar, Name, RoleTag, ErrorBox, Empty, Confirm, Toggle } from '../components/ui'
import ReportSheet from '../components/Report'
import Post from '../components/Post'
import { useBoards } from './Home'
import { useApp } from '../app/context'
import { ago } from  '../lib/format'
import { errText } from '../lib/errors'

// @username in a comment becomes a link
const withMentions = (t) => t.split(/(@[a-zA-Z0-9_]{3,24})/g).map((x, i) => (/^@/.test(x) ? <Link key={i} className="mention" to={`/profile/${x.slice(1)}`}>{x}</Link> : x))

// One comment. Top comments are floors (1F, 2F). Replies are indented under them and collapsed behind "View replies".
function Comment({ c, label, opOf, reload, onReply, nested, root, openId }) {
  const { isAdmin, toast } = useApp()
  const [liked, setLiked] = useState(c.liked); const [n, setN] = useState(c.likes_count || 0)
  const [edit, setEdit] = useState(false); const [text, setText] = useState(c.content); const [menu, setMenu] = useState(false); const [sheet, setSheet] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openId === c.id) setOpen(true) }, [openId, c.id])
  const anonymous = !c.author_id, size = nested ? 28 : 36, count = c.replies?.length || 0
  const like = async () => { const on = !liked; setLiked(on); setN(n + (on ? 1 : -1)); try { await comments.like(c.id, on) } catch (e) { setLiked(!on); setN(n); toast(errText(e), 'err') } }
  const save = async () => { try { await comments.edit(c.id, text.trim(), c.markerParent); setEdit(false); reload() } catch (e) { toast(errText(e), 'err') } }
  const top = root || c
  return <div className={'floor' + (nested ? ' nested' : '')}>
    {anonymous ? <Avatar anonymous size={size} /> : <Link to={`/profile/${c.author.username}`}><Avatar p={c.author} size={size} /></Link>}
    <div className="grow minw">
      <div className="row wrap tight">{anonymous ? <Name anonymous /> : <Link to={`/profile/${c.author.username}`}><Name p={c.author} /></Link>}
        <RoleTag p={c.author} />{opOf(c) && <span className="tag op">OP</span>}{c.is_mine && <span className="tag me">You</span>}
        <span className="grow" /><span className="floor-n">{label}</span></div>
      {edit ? <div style={{ display: 'grid', gap: 6, marginTop: 4 }}><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row"><button className="btn sm" disabled={!text.trim()} onClick={save}>Save</button><button className="btn sm ghost" onClick={() => { setEdit(false); setText(c.content) }}>Cancel</button></div></div>
        : <p className="cbody">{withMentions(c.content)}</p>}
      <div className="row cacts"><span className="mute small">{ago(c.created_at)}</span>
        <button className={liked ? 'liked' : ''} onClick={like} aria-pressed={liked}><Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {n || ''}</button>
        <button onClick={() => onReply(c, label, top)}><CornerDownRight size={15} /> Reply</button>
        <div className="menu-wrap"><button aria-label="More" onClick={() => setMenu(!menu)}><MoreHorizontal size={16} /></button>
          {menu && <div className="menu" onMouseLeave={() => setMenu(false)}>
            {c.is_mine && <button onClick={() => { setMenu(false); setEdit(true) }}><Pencil size={15} /> Edit</button>}
            {(c.is_mine || isAdmin) && <button className="dng" onClick={() => { setMenu(false); setSheet('del') }}><Trash2 size={15} /> Delete</button>}
            {!c.is_mine && <button onClick={() => { setMenu(false); setSheet('rep') }}><Flag size={15} /> Report</button>}</div>}</div></div>
      {!nested && count > 0 && <button className="viewrep" aria-expanded={open} onClick={() => setOpen(!open)}><i />{open ? 'Hide replies' : `View ${count} ${count === 1 ? 'reply' : 'replies'}`}{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
      {!nested && open && count > 0 && <div className="replies">{c.replies.map((r, i) => <Comment key={r.id} c={r} nested root={c} label={`${label}-${i + 1}`} opOf={opOf} reload={reload} onReply={onReply} />)}</div>}
    </div>
    {sheet === 'del' && <Confirm title="Delete comment" text={count ? 'Its replies will be deleted too.' : 'This comment will be removed.'} action="Delete" danger onClose={() => setSheet(null)}
      onYes={async () => { try { await comments.remove(c.id); reload() } catch (e) { toast(errText(e), 'err') } }} />}
    {sheet === 'rep' && <ReportSheet type="comment" id={c.id} onClose={() => setSheet(null)} />}
  </div>
}

export default function PostPage() {
  const { id } = useParams(); const nav = useNavigate(); const { me, toast, suspension } = useApp()
  const boards = useBoards()
  const post = useQuery('post:' + id, () => feed.one(id))
  const cm = useQuery('comments:' + id, () => comments.list(id))
  const [text, setText] = useState(''); const [anon, setAnon] = useState(false); const [reply, setReply] = useState(null)
  const [openId, setOpenId] = useState(null); const [newest, setNewest] = useState(false); const [opOnly, setOp] = useState(false); const [busy, setBusy] = useState(false); const inp = useRef()
  const reloadAll = () => { post.reload(); cm.reload() }

  const isOpOf = (c) => !!post.data && ((c.author_id && c.author_id === post.data.author_id) || (post.data.is_mine && c.is_mine))
  const list = useMemo(() => {
    let l = [...(cm.data || [])]
    if (opOnly) l = l.filter(isOpOf)
    return newest ? l.reverse() : l
  }, [cm.data, newest, opOnly, post.data]) // eslint-disable-line

  // Replying to a reply attaches to the same top comment and starts with @username, like Instagram and Facebook
  const startReply = (target, label, top) => {
    setReply({ c: target, top, label })
    const who = target.author?.username
    setText(who ? `@${who} ` : '')
    setTimeout(() => { inp.current?.focus() }, 30)
  }
  const send = async () => {
    const v = text.trim(); if (!v) return; setBusy(true)
    try { await comments.add(id, v, anon, reply ? reply.top.id : null); const open = reply?.top.id; setText(''); setReply(null); reloadAll(); if (open) setOpenId(open) }
    catch (e) { toast(errText(e), 'err') } finally { setBusy(false) }
  }

  return <>
    <div className="page-title"><button className="ibtn" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back"><ChevronLeft /></button><h1>Post</h1></div>
    {post.loading ? <PostSkeleton /> : post.error && !post.data ? <ErrorBox error={post.error} retry={post.reload} />
      : !post.data ? <Empty Icon={MessageCircle} title="Post not found" hint="It may have been deleted, or it is in a private channel." />
      : <Post p={post.data} boards={boards.map} full onChange={reloadAll} onDeleted={() => nav('/', { replace: true })} />}

    <div className="card floors">
      <div className="row between"><b>Comments {cm.data ? `(${cm.data.reduce((a, c) => a + 1 + (c.replies?.length || 0), 0)})` : ''}</b>
        <div className="row tight"><button className={'chip-btn' + (opOnly ? ' on' : '')} onClick={() => setOp(!opOnly)}><UserCheck size={14} /> OP only</button>
          <button className="chip-btn" onClick={() => setNewest(!newest)}><ArrowDownUp size={14} /> {newest ? 'Newest' : 'Oldest'}</button></div></div>
      {cm.loading ? <><CommentSkeleton /><CommentSkeleton /></> : cm.error && !cm.data ? <ErrorBox error={cm.error} retry={cm.reload} compact />
        : !list.length ? <Empty Icon={MessageCircle} title={opOnly ? 'The OP has not commented' : 'No comments yet'} hint={opOnly ? undefined : 'Take the sofa and be the first to comment.'} />
        : list.map((c) => <Comment key={c.id} c={c} label={`${c.floor}F`} opOf={isOpOf} openId={openId} reload={reloadAll} onReply={startReply} />)}
    </div>

    {!suspension && <div className="cbar">
      {reply && <div className="replychip"><CornerDownRight size={14} /> Replying to {reply.c.author?.display_name || 'Anonymous'} ({reply.label})<button className="ibtn" aria-label="Cancel reply" onClick={() => { setReply(null); setText('') }}><X size={14} /></button></div>}
      <div className="row">
        <Avatar p={me} anonymous={anon} size={34} />
        <input ref={inp} className="msg-in" placeholder={anon ? 'Comment anonymously' : 'Write a comment'} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className={'ibtn' + (anon ? ' sel' : '')} aria-pressed={anon} aria-label="Comment anonymously" onClick={() => setAnon(!anon)}><EyeOff size={20} /></button>
        <button className="send" disabled={!text.trim() || busy} onClick={send} aria-label="Send comment"><Send size={19} /></button></div></div>}
  </>
}
