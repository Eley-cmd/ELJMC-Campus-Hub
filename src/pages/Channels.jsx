import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Hash, ChevronRight, CalendarDays, Ghost, ShoppingBag, PawPrint, QrCode, Hash as HashIcon, Plus, Search, X } from 'lucide-react'
import { channels } from '../api'
import { chatx } from '../lib/chatx'
import { useQuery } from '../ui/hooks'
import { Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import { ErrorBox, PageTitle, Empty, Sheet, Field, Segmented } from '../components/ui'
import Composer from '../components/Composer'
import FeedList from '../components/FeedList'
import { ThreadBody } from './Chats'
import { useBoards } from './Home'
import { useApp } from '../app/context'
import { categoryMeta } from '../lib/channels'
import { errText } from '../lib/errors'

const TOOLS = [[CalendarDays, 'Events', '/events'], [Ghost, 'Anonymous chat', '/anonymous'], [ShoppingBag, 'Shop Nav', '/shop'], [PawPrint, 'Pets', '/pets'], [QrCode, 'Friends and QR', '/friends']]

// the words are matched by src/lib/channels.js to a label and icon
const CATEGORIES = [['general', 'General'], ['academics', 'Academics'], ['events', 'ELJMC Events'], ['courses', 'Course and Professor Hub'], ['safety', 'Campus Safety'], ['commute', 'Ride and Commute']]

function CreateChannel({ onClose, onDone }) {
  const { toast } = useApp()
  const [name, setName] = useState(''); const [cat, setCat] = useState('general'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    try { await chatx.createChannel(name.trim(), cat); toast('Channel created'); onDone(); onClose() }
    catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return <Sheet title="New channel" onClose={onClose} footer={<button type="button" className="btn" disabled={busy || !name.trim()} onClick={go}>{busy ? 'Please wait' : 'Create channel'}</button>}>
    <Field label="Channel name"><input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Library updates" /></Field>
    <Field label="Category"><select value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
    {err && <div className="err">{err}</div>}
  </Sheet>
}

export default function Channels() {
  const { me } = useApp(); const isAdmin = me?.role === 'admin'
  const { data, loading, error, reload } = useQuery('channels', channels.list); const [create, setCreate] = useState(false)
  const [q, setQ] = useState(''); const needle = q.trim().toLowerCase()
  const groups = {}; (data || []).filter((c) => !c.is_direct && (!needle || c.name?.toLowerCase().includes(needle))).forEach((c) => { const m = categoryMeta(c.category); (groups[m.label] ||= { meta: m, items: [] }).items.push(c) })
  // The "New channel" button (admins only) sits below the message or below the list, like "Open my shop" in Shop
  const newBtn = isAdmin && <button type="button" className="btn sm" onClick={() => setCreate(true)}><Plus size={15} /> New channel</button>
  return <>
    <PageTitle>Channels</PageTitle>
    <div className="shopsearch"><div className="inp"><Search size={18} /><input placeholder="Search channels" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <button type="button" className="ibtn" aria-label="Clear" onClick={() => setQ('')}><X size={16} /></button>}</div></div>
    {!q && <div className="tools">{TOOLS.map(([I, l, to]) => <Link key={to} to={to} className="tool"><I size={22} /><span>{l}</span></Link>)}</div>}
    {loading ? <div className="card flush"><Skeletons n={6} C={ListRowSkeleton} /></div> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !Object.keys(groups).length ? <Empty Icon={HashIcon} title={q ? 'No channels found' : 'No channels yet'} hint={q ? 'Try another word.' : isAdmin ? 'Create the first channel for your campus.' : 'An admin can create channels.'}>{!q && newBtn}</Empty>
      : <>{Object.values(groups).map(({ meta, items }) => <div key={meta.label} className="card flush">
        <div className="group-h"><meta.Icon size={16} /> {meta.label}</div>
        {items.map((c) => <Link key={c.id} to={`/channel/${c.id}`} className="row pad chrow"><span className="chico"><Hash size={18} /></span><b className="grow">{c.name}</b><ChevronRight size={18} className="mute" /></Link>)}</div>)}
        {newBtn && !q && <div className="center" style={{ padding: '4px 0 16px' }}>{newBtn}</div>}</>}
    {create && <CreateChannel onClose={() => setCreate(false)} onDone={reload} />}
  </>
}

export function ChannelPage() {
  const { id } = useParams(); const nav = useNavigate(); const boards = useBoards()
  const [tab, setTab] = useState('posts')
  const ch = useQuery('channel:' + id, () => channels.one(id))
  const m = categoryMeta(ch.data?.category)
  return <>
    <div className="page-title"><button type="button" className="ibtn" onClick={() => nav('/channels')} aria-label="Back"><ChevronLeft /></button>
      <div><h1>{ch.data?.name || <span className="sk" style={{ display: 'inline-block', width: 140, height: 20 }} />}</h1>{ch.data && <div className="mute small">{m.label}</div>}</div></div>
    <Segmented value={tab} onChange={setTab} items={[['posts', 'Posts'], ['chat', 'Chat']]} />
    {tab === 'posts'
      ? <FeedList channelId={id} boards={boards.map} top={<Composer boards={boards.list} channelId={id} onPosted={() => nav(0)} />} />
      : <div className="thread embedded"><ThreadBody id={id} isDirect={false} /></div>}
  </>
}