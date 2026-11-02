import { useEffect, useState } from 'react'
import { Link2, Share2, Search, Check, Send } from 'lucide-react'
import { chat, friends, profile } from '../api'
import { useQuery } from '../ui/hooks'
import { Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import { Avatar, Sheet, Empty } from './ui'
import { useApp } from '../app/context'
import { errText } from '../lib/errors'

// Instagram-style share: pick people to send the post to, or copy the link / share with another app.
export default function ShareSheet({ post, onClose }) {
  const { toast } = useApp()
  const url = `${location.origin}/post/${post.id}`
  const fr = useQuery('friends', friends.list)
  const [q, setQ] = useState(''); const [found, setFound] = useState([]); const [sel, setSel] = useState([]); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) return setFound([])
    const t = setTimeout(() => profile.search(q.trim()).then(setFound, () => {}), 300); return () => clearTimeout(t)
  }, [q])
  const people = q.trim().length >= 2 ? found : fr.data || []
  const toggle = (u) => setSel((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]))

  const send = async () => {
    setBusy(true)
    try {
      for (const u of sel) { const id = await chat.openDm(u.id); await chat.send(id, (note.trim() ? note.trim() + '\n' : '') + url) }
      toast(sel.length === 1 ? `Sent to ${sel[0].display_name}` : `Sent to ${sel.length} people`); onClose()
    } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied'); onClose() } catch { toast('Could not copy the link', 'err') } }
  const native = async () => { try { await navigator.share({ title: 'ELJMC Campus Hub', text: (post.content || '').slice(0, 100), url }); onClose() } catch { /* cancelled */ } }

  return <Sheet title="Share" onClose={onClose} footer={sel.length > 0 && <div style={{ display: 'grid', gap: 8, width: '100%' }}>
    <input className="input" placeholder="Write a message..." maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
    <button className="btn" disabled={busy} onClick={send}><Send size={17} /> {busy ? 'Sending' : sel.length === 1 ? 'Send' : `Send separately (${sel.length})`}</button></div>}>
    <div className="inp"><Search size={18} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {fr.loading && !q ? <Skeletons n={3} C={ListRowSkeleton} /> : !people.length ? <Empty title={q ? 'No one found' : 'No friends yet'} hint={q ? undefined : 'Search a name, or add friends with their QR code.'} />
      : <div className="sharegrid">{people.map((u) => { const on = sel.some((x) => x.id === u.id)
        return <button key={u.id} className={'sharep' + (on ? ' on' : '')} onClick={() => toggle(u)}><span className="shav"><Avatar p={u} size={60} />{on && <i><Check size={14} /></i>}</span><span className="ell">{u.display_name}</span></button> })}</div>}
    <div className="shareacts">
      <button onClick={copy}><span><Link2 size={22} /></span>Copy link</button>
      {navigator.share && <button onClick={native}><span><Share2 size={22} /></span>Share to...</button>}
    </div></Sheet>
}
