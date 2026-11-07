import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Camera, Hash, CalendarDays, Ghost, ShoppingBag, PawPrint, QrCode, Hash as HashIcon, Plus, MessagesSquare, FileText } from 'lucide-react'
import { channels, caps } from '../api'
import { uploadImage, img } from '../lib/cloudinary'
import { chatx } from '../lib/chatx'
import { useQuery } from '../ui/hooks'
import { Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import { ErrorBox, Empty, Sheet, Field } from '../components/ui'
import { SearchBar } from '../components/Search'
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

function CreateChannel({ onClose, onDone, category = 'general' }) {
  const { toast } = useApp()
  const [name, setName] = useState(''); const [cat, setCat] = useState(CATEGORIES.some(([k]) => k === category) ? category : 'general'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
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

/* Channel list: Discord style (collapsible categories, # channels) with Facebook Page style rows (round-square picture, name, subtitle) */
export default function Channels() {
  const { me } = useApp(); const isAdmin = me?.role === 'admin'
  const { data, loading, error, reload } = useQuery('channels', channels.list); const [create, setCreate] = useState(null)
  const [q, setQ] = useState(''); const needle = q.trim().toLowerCase(); const [shut, setShut] = useState({})
  const groups = {}; (data || []).filter((c) => !c.is_direct && (!needle || c.name?.toLowerCase().includes(needle))).forEach((c) => { const m = categoryMeta(c.category); (groups[m.label] ||= { meta: m, cat: c.category, items: [] }).items.push(c) })
  const newBtn = isAdmin && <button type="button" className="btn sm" onClick={() => setCreate('general')}><Plus size={15} /> New channel</button>
  return <>
    <div className="msgr-head"><h1>Channels</h1><div className="grow" />
      {isAdmin && <button type="button" className="msgr-ic" aria-label="New channel" onClick={() => setCreate('general')}><Plus size={24} /></button>}</div>
    <SearchBar sticky value={q} onChange={setQ} placeholder="Search channels" />
    {!q && <div className="tools">{TOOLS.map(([I, l, to]) => <Link key={to} to={to} className="tool"><I size={22} /><span>{l}</span></Link>)}</div>}
    {loading ? <div className="card flush"><Skeletons n={6} C={ListRowSkeleton} /></div> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !Object.keys(groups).length ? <Empty Icon={HashIcon} title={q ? 'No channels found' : 'No channels yet'} hint={q ? 'Try another word.' : isAdmin ? 'Create the first channel for your campus.' : 'An admin can create channels.'}>{!q && newBtn}</Empty>
      : <div className="dc-list">{Object.values(groups).map(({ meta, cat, items }) => { const closed = shut[meta.label] && !needle
        return <div key={meta.label} className="dc-cat">
          <div className="dc-cat-h"><button type="button" className="dc-toggle" aria-expanded={!closed} onClick={() => setShut({ ...shut, [meta.label]: !shut[meta.label] })}>
            {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<span>{meta.label}</span><em>{items.length}</em></button>
            {isAdmin && <button type="button" className="dc-plus" aria-label={`New channel in ${meta.label}`} onClick={() => setCreate(cat)}><Plus size={16} /></button>}</div>
          {!closed && items.map((c) => <Link key={c.id} to={`/channel/${c.id}`} className="dc-ch">
            <span className="dc-av">{c.photo_url ? <img src={img(c.photo_url, 120)} alt="" /> : <Hash size={20} />}</span>
            <span className="dc-meta"><b className="ell">{c.name}</b><span className="ell">{meta.label} - Public channel</span></span>
            <ChevronRight size={18} className="mute" /></Link>)}</div> })}</div>}
    {create && <CreateChannel category={create} onClose={() => setCreate(null)} onDone={reload} />}
  </>
}

/* One channel: a Facebook-Page header (cover, picture, name) with Posts and Chat tabs. Chat opens full screen and looks like Discord. */
export function ChannelPage() {
  const { id } = useParams(); const nav = useNavigate(); const boards = useBoards(); const { me, toast } = useApp(); const isAdmin = me?.role === 'admin'
  const [tab, setTab] = useState('posts'); const [busy, setBusy] = useState(''); const coverRef = useRef(); const photoRef = useRef()
  const ch = useQuery('channel:' + id, () => channels.one(id))
  const m = categoryMeta(ch.data?.category)
  const name = ch.data?.name || 'channel'

  // Only admins can change a channel's picture or cover (the database allows admins only)
  const setArt = async (field, file, max) => {
    if (!file) return
    if (!caps.channelArt) return toast('Channel pictures need one small database update first. Run the "channel pictures" SQL in Supabase.', 'err', 6000)
    setBusy(field)
    try { await channels.update(id, { [field]: await uploadImage(file, max) }); toast(field === 'cover_url' ? 'Cover updated' : 'Picture updated'); await ch.reload() }
    catch (e) { toast(errText(e), 'err') } finally { setBusy('') }
  }
  const Tile = ({ size = 40 }) => <span className="dc-av" style={{ width: size, height: size, flex: 'none' }}>{ch.data?.photo_url ? <img src={img(ch.data.photo_url, 160)} alt="" /> : <Hash size={size * 0.5} />}</span>

  if (tab === 'chat') return <div className="thread dc-full">
    <div className="thread-h row"><button type="button" className="ibtn" onClick={() => setTab('posts')} aria-label="Back to the channel"><ChevronLeft size={26} /></button>
      <Tile />
      <div className="grow minw"><b className="ell" style={{ display: 'block' }}># {name}</b><div className="mute small ell">{m.label} - Public channel</div></div></div>
    <ThreadBody id={id} isDirect={false} variant="discord" placeholder={`Message #${name}`} />
  </div>

  return <div className="chpage">
    <div className="fbp-cover">
      {ch.data?.cover_url && <img className="fbp-cover-img" src={img(ch.data.cover_url, 1000)} alt="" />}
      <button type="button" className="gear" onClick={() => nav('/channels')} aria-label="Back"><ChevronLeft size={22} /></button>
      {isAdmin && <div className="cover-actions"><button type="button" className="cover-btn" disabled={busy === 'cover_url'} onClick={() => coverRef.current.click()}><Camera size={15} /> {ch.data?.cover_url ? 'Change cover' : 'Add cover'}</button></div>}
      <input ref={coverRef} hidden type="file" accept="image/*" onChange={(e) => { setArt('cover_url', e.target.files[0], 1400); e.target.value = '' }} /></div>
    <div className="fbp-head">
      <div className="fbp-av">{ch.data?.photo_url ? <img src={img(ch.data.photo_url, 240)} alt="" /> : <Hash size={34} />}
        {busy === 'photo_url' && <span className="avbusy" />}
        {isAdmin && <><button type="button" className="avcam" aria-label="Change channel picture" disabled={busy === 'photo_url'} onClick={() => photoRef.current.click()}><Camera size={16} /></button>
          <input ref={photoRef} hidden type="file" accept="image/*" onChange={(e) => { setArt('photo_url', e.target.files[0], 600); e.target.value = '' }} /></>}</div>
      <div className="fbp-title">{ch.data ? <><h1 className="ell">{ch.data.name}</h1><div className="mute"><m.Icon size={14} /> {m.label} - Public channel</div></>
        : <><span className="sk" style={{ display: 'block', width: 170, height: 22 }} /><span className="sk" style={{ display: 'block', width: 120, height: 12, marginTop: 8 }} /></>}</div></div>
    <div className="pagetabs" role="tablist">
      <button type="button" role="tab" aria-selected className="on" onClick={() => setTab('posts')}><FileText size={16} /> Posts</button>
      <button type="button" role="tab" aria-selected={false} onClick={() => setTab('chat')}><MessagesSquare size={16} /> Chat</button></div>
    <FeedList channelId={id} boards={boards.map} top={<Composer boards={boards.list} channelId={id} onPosted={() => nav(0)} />} />
  </div>
}