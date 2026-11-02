import { useRef, useState } from 'react'
import { ImagePlus, EyeOff, X, CalendarDays, BarChart3, Plus, Image as ImageIcon } from 'lucide-react'
import { feed, polls } from '../api'
import { uploadImage } from '../lib/cloudinary'
import { errText } from '../lib/errors'
import { toLocalInput } from '../lib/format'
import { Avatar, Sheet, Toggle } from './ui'
import { useApp } from '../app/context'

const EXPIRY = [['', 'No end'], ['1', '1 day'], ['3', '3 days'], ['7', '7 days']]

// Facebook-style composer: a "What's on your mind?" bar that opens a full sheet
export default function Composer({ boards = [], channelId = '', onPosted, startEvent }) {
  const { me, toast, suspension } = useApp()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(''); const [files, setFiles] = useState([]); const [anonymous, setAnon] = useState(false)
  const [ch, setCh] = useState(channelId); const [isEvent, setEvent] = useState(!!startEvent); const [when, setWhen] = useState('')
  const [pollOn, setPollOn] = useState(false); const [opts, setOpts] = useState(['', '']); const [exp, setExp] = useState('')
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const ref = useRef()

  const reset = () => { setText(''); setFiles([]); setAnon(false); setEvent(!!startEvent); setWhen(''); setPollOn(false); setOpts(['', '']); setExp(''); setErr('') }
  const addFiles = (list) => setFiles((f) => [...f, ...Array.from(list).filter((x) => x.type.startsWith('image/'))].slice(0, 9))
  const cleanOpts = opts.map((o) => o.trim()).filter(Boolean)
  const valid = (text.trim() || files.length) && (!isEvent || when) && (!pollOn || (text.trim() && cleanOpts.length >= 2))

  const post = async () => {
    setErr('')
    if (isEvent && new Date(when) < new Date()) return setErr('Pick a future date and time for the event.')
    try {
      let urls = []
      if (files.length) { setBusy(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}`); urls = await Promise.all(files.map((f) => uploadImage(f))) }
      setBusy('Posting')
      const created = await feed.create({ channel_id: ch || null, content: text.trim(), media_urls: urls, is_anonymous: anonymous, is_event: isEvent, event_time: isEvent ? new Date(when).toISOString() : null })
      if (pollOn) {
        try { await polls.create(created.id, text.trim(), cleanOpts, exp ? new Date(Date.now() + Number(exp) * 864e5).toISOString() : null) }
        catch (e) { await feed.remove(created.id).catch(() => {}); throw e }
      }
      toast('Posted'); reset(); setOpen(false); onPosted?.()
    } catch (e) { setErr(errText(e)) } finally { setBusy('') }
  }

  return <>
    <div className="card compose-bar">
      <div className="row"><Avatar p={me} size={40} />
        <button className="compose-in" disabled={!!suspension} onClick={() => setOpen(true)}>{suspension ? 'Your account is suspended' : "What's on your mind?"}</button>
        <button className="ibtn accent" aria-label="Add photos" disabled={!!suspension} onClick={() => setOpen(true)}><ImageIcon size={22} /></button></div>
    </div>
    {open && <Sheet title="Create post" onClose={() => !busy && setOpen(false)} footer={<button className="btn" disabled={!valid || !!busy} onClick={post}>{busy || 'Post'}</button>}>
      <div className="row"><Avatar p={me} anonymous={anonymous} size={44} />
        <div className="grow"><b>{anonymous ? 'Anonymous' : me?.display_name}</b>
          <select className="mini-select" value={ch} onChange={(e) => setCh(e.target.value)} aria-label="Board"><option value="">General feed</option>{boards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
      <textarea className="compose-text" autoFocus rows={5} maxLength={5000} placeholder={pollOn ? 'Ask your question' : "What's on your mind?"} value={text} onChange={(e) => setText(e.target.value)} />

      {!!files.length && <div className="preview">{files.map((f, i) => <div key={i}><img src={URL.createObjectURL(f)} alt="" />
        <button aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button></div>)}</div>}

      {isEvent && <div className="subbox"><CalendarDays size={18} /><div className="grow"><small className="mute">Event date and time</small>
        <input type="datetime-local" className="input" min={toLocalInput(new Date())} value={when} onChange={(e) => setWhen(e.target.value)} /></div></div>}
      {pollOn && <div className="subbox col"><div className="row"><BarChart3 size={18} /><b>Poll options</b></div>
        {opts.map((o, i) => <div key={i} className="row"><input className="input" placeholder={`Option ${i + 1}`} maxLength={80} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
          {opts.length > 2 && <button className="ibtn" aria-label="Remove option" onClick={() => setOpts(opts.filter((_, j) => j !== i))}><X size={16} /></button>}</div>)}
        {opts.length < 6 && <button className="link" onClick={() => setOpts([...opts, ''])}><Plus size={14} /> Add option</button>}
        <label className="row between small"><span>Voting ends</span><select className="mini-select" value={exp} onChange={(e) => setExp(e.target.value)}>{EXPIRY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>}

      <div className="addbar"><span>Add to your post</span>
        <button className="ibtn accent" aria-label="Add photos" onClick={() => ref.current.click()}><ImagePlus size={22} /></button>
        <button className={'ibtn' + (isEvent ? ' sel' : '')} aria-pressed={isEvent} aria-label="Event" onClick={() => setEvent(!isEvent)}><CalendarDays size={22} /></button>
        <button className={'ibtn' + (pollOn ? ' sel' : '')} aria-pressed={pollOn} aria-label="Poll" onClick={() => setPollOn(!pollOn)}><BarChart3 size={22} /></button>
        <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} /></div>
      <div className="row between anon-row"><span className="row"><EyeOff size={18} /> Post anonymously</span><Toggle on={anonymous} onChange={setAnon} label="Post anonymously" /></div>
      {anonymous && <p className="mute small" style={{ margin: 0 }}>Others will not see your name. Moderators can still trace abuse.</p>}
      {err && <div className="err" role="alert">{err}</div>}
    </Sheet>}
  </>
}
