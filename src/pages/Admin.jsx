import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ChevronLeft, Flag, Users, Ban, ScrollText, Hash, Search, BadgeCheck, Check, X, Eye, Plus, Trash2, Coins, ShieldCheck, Store } from 'lucide-react'
import { admin, channels } from '../api'
import { useQuery } from '../ui/hooks'
import { Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import { Avatar, Name, Empty, ErrorBox, Sheet, Field, Segmented, Confirm } from '../components/ui'
import { useApp } from '../app/context'
import { ROLES, ROLE_LABEL, VERIFY_REASON, SHOP_DELETE_REASON } from '../config'
import { dateTime, ago } from '../lib/format'
import { errText } from '../lib/errors'
import { categoryMeta } from '../lib/channels'

const special = (r) => r.reason === VERIFY_REASON || r.reason === SHOP_DELETE_REASON

/* ------------------------------ ordinary reports ------------------------------ */
function Reports({ onChanged }) {
  const { toast } = useApp(); const [status, setStatus] = useState('open'); const [view, setView] = useState(null); const [tx, setTx] = useState(null)
  const { data: all, loading, error, reload } = useQuery('reports:' + status, () => admin.reports(status))
  const data = all?.filter((r) => !special(r))
  const set = async (r, s) => { try { await admin.handleReport(r.id, s); reload(); onChanged() } catch (e) { toast(errText(e), 'err') } }
  const look = async (r) => { try { setView({ r, data: await admin.preview(r.target_type, r.target_id) }) } catch (e) { toast(errText(e), 'err') } }
  const transcript = async (r) => { const reason = prompt('Why do you need to read this chat? This is logged.'); if (!reason?.trim()) return
    try { setTx({ r, rows: await admin.transcript(r.target_id, reason.trim()) }) } catch (e) { toast(errText(e), 'err') } }
  return <>
    <Segmented value={status} onChange={setStatus} items={[['open', 'Open'], ['reviewing', 'Reviewing'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']]} />
    {loading ? <div className="card flush"><Skeletons n={4} C={ListRowSkeleton} /></div> : error && !all ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={Flag} title="Nothing here" /> : data.map((r) => <div key={r.id} className="card order">
        <div className="row between"><b>{r.reason}</b><span className="tag">{r.target_type.replace('_', ' ')}</span></div>
        {r.details && <p style={{ margin: 0 }}>{r.details}</p>}
        <div className="mute small">By {r.reporter?.display_name || 'unknown'} - {dateTime(r.created_at)}</div>
        <div className="row wrap">{r.target_type === 'anonymous_session' ? <button className="btn sm ghost" onClick={() => transcript(r)}><Eye size={14} /> Read chat</button> : r.target_type !== 'message' && <button className="btn sm ghost" onClick={() => look(r)}><Eye size={14} /> View</button>}
          {r.status !== 'reviewing' && <button className="btn sm ghost" onClick={() => set(r, 'reviewing')}>Reviewing</button>}
          {r.status !== 'resolved' && <button className="btn sm" onClick={() => set(r, 'resolved')}><Check size={14} /> Resolve</button>}
          {r.status !== 'dismissed' && <button className="btn sm ghost" onClick={() => set(r, 'dismissed')}><X size={14} /> Dismiss</button>}</div></div>)}
    {view && <Sheet title="Reported content" onClose={() => setView(null)}>{view.data ? <div style={{ display: 'grid', gap: 8 }}>
      {view.data.content && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{view.data.content}</p>}{view.data.display_name && <p style={{ margin: 0 }}><b>{view.data.display_name}</b> @{view.data.username} ({view.data.role})</p>}
      {view.data.media_urls?.map((u) => <img key={u} src={u} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} />)}</div> : <p className="mute">This content no longer exists.</p>}</Sheet>}
    {tx && <Sheet title="Chat transcript" onClose={() => setTx(null)} wide>{!tx.rows.length ? <p className="mute">No messages.</p> : tx.rows.map((m) => <div key={m.id} className="row pad-s top"><Avatar p={m.sender} size={28} /><div><b className="small">{m.sender?.display_name || 'Unknown'}</b> <span className="mute small">{dateTime(m.sent_at)}</span><div>{m.message_content}</div></div></div>)}</Sheet>}
  </>
}

/* ---------------------------- one user: details + actions ---------------------------- */
function UserDetail({ u, onClose, onChanged }) {
  const { toast, me } = useApp(); const [act, setAct] = useState(null)
  const info = useQuery('udetail:' + u.id, async () => (await admin.lookup(u.username)).find((x) => x.id === u.id) || null)
  const i = info.data
  const run = async (fn, msg) => { try { await fn(); toast(msg); setAct(null); info.reload(); onChanged() } catch (e) { toast(errText(e), 'err') } }
  return <Sheet title="User" onClose={onClose}>
    <div className="row"><Avatar p={u} size={56} dot /><div className="grow minw"><Name p={u} /><div className="mute small">@{u.username} - {ROLE_LABEL[u.role] || u.role}</div><div className="mute small">Joined {dateTime(u.created_at)} - {u.points_balance} pts</div></div></div>
    {info.loading ? <Skeletons n={2} C={ListRowSkeleton} /> : i ? <div className="card setcard" style={{ margin: 0 }}>
      <div className="small"><span className="mute">Email</span><br /><b>{i.email}</b></div>
      <div className="small"><span className="mute">Student ID</span><br /><b>{i.student_id_number || 'Not submitted'}</b> {i.id_verified_at ? <span className="okc"><BadgeCheck size={13} /> verified</span> : i.student_id_number ? <span className="dngc">waiting for verification</span> : null}</div>
      {i.rfid_card_serial && <div className="small"><span className="mute">Card</span><br /><b>{i.rfid_card_serial}</b></div>}</div>
      : <p className="mute small" style={{ margin: 0 }}>Private details could not be loaded for this user.</p>}
    <div className="row wrap">
      {i?.student_id_number && !i.id_verified_at && <button className="btn sm" onClick={() => run(() => admin.verifyAndClose(u.id), 'Student ID verified')}><BadgeCheck size={14} /> Verify ID</button>}
      {u.id !== me.id && <><button className="btn sm ghost" onClick={() => setAct('role')}>Role</button><button className="btn sm ghost" onClick={() => setAct('sus')}><Ban size={14} /> Suspend</button></>}
      <button className="btn sm ghost" onClick={() => setAct('pts')}><Coins size={14} /> Points</button></div>
    {act === 'role' && <RoleSheet u={u} onClose={() => setAct(null)} onGo={(r) => run(() => admin.setRole(u.id, r), 'Role updated')} />}
    {act === 'sus' && <SuspendSheet u={u} onClose={() => setAct(null)} onGo={(r, d) => run(() => admin.suspend(u.id, r, d ? new Date(Date.now() + d * 864e5).toISOString() : null), 'User suspended')} />}
    {act === 'pts' && <PointsSheet u={u} onClose={() => setAct(null)} onGo={(a, r) => run(() => admin.grant(u.id, a, r), 'Points updated')} />}
  </Sheet>
}

/* ---------------------------------- all users ---------------------------------- */
function UserTools({ onChanged }) {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [only, setOnly] = useState(false); const [sel, setSel] = useState(null)
  const [extra, setExtra] = useState([]); const [more, setMore] = useState(false)
  const key = `users:${dq}:${only}`
  const first = useQuery(key, () => admin.users({ q: dq, unverified: only }))
  const rows = [...(first.data?.rows || []), ...extra]; const total = first.data?.count ?? 0
  const search = () => { setExtra([]); setDq(q) }
  const loadMore = async () => { setMore(true); try { const r = await admin.users({ q: dq, unverified: only, from: rows.length }); setExtra((x) => [...x, ...r.rows]) } finally { setMore(false) } }
  return <>
    <div className="row pad" style={{ paddingTop: 0 }}><div className="inp grow"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search name or username" /></div><button className="btn sm" onClick={search}>Search</button></div>
    <div className="chips"><button className={!only ? 'on' : ''} onClick={() => { setExtra([]); setOnly(false) }}>All users</button><button className={only ? 'on' : ''} onClick={() => { setExtra([]); setOnly(true) }}>Not verified</button></div>
    <p className="mute small pad" style={{ paddingTop: 0 }}>{first.data ? `${total} user${total === 1 ? '' : 's'}${dq ? ' found' : ' using the app'}` : ' '}</p>
    {first.loading ? <div className="card flush"><Skeletons n={6} C={ListRowSkeleton} /></div> : first.error && !first.data ? <ErrorBox error={first.error} retry={first.reload} />
      : !rows.length ? <Empty Icon={Users} title="No users found" />
      : <div className="card flush">{rows.map((u) => <button key={u.id} className="row pad listbtn" onClick={() => setSel(u)}><Avatar p={u} size={42} dot />
        <div className="grow left minw"><Name p={u} /><div className="mute small ell">@{u.username} - joined {ago(u.created_at)} ago</div></div>
        <span className="tag">{ROLE_LABEL[u.role] || u.role}</span></button>)}</div>}
    {rows.length < total && <div className="center" style={{ padding: 12 }}><button className="btn ghost sm" disabled={more} onClick={loadMore}>{more ? 'Loading' : 'Show more'}</button></div>}
    {sel && <UserDetail u={sel} onClose={() => setSel(null)} onChanged={() => { first.reload(); onChanged() }} />}
  </>
}

const RoleSheet = ({ u, onClose, onGo }) => { const [r, setR] = useState(u.role)
  return <Sheet title={`Role for ${u.display_name}`} onClose={onClose} footer={<button className="btn" disabled={r === u.role} onClick={() => onGo(r)}>Save role</button>}>
    <select className="input" value={r} onChange={(e) => setR(e.target.value)}>{ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select></Sheet> }
const SuspendSheet = ({ u, onClose, onGo }) => { const [r, setR] = useState(''); const [d, setD] = useState('0')
  return <Sheet title={`Suspend ${u.display_name}`} onClose={onClose} footer={<button className="btn danger" disabled={!r.trim()} onClick={() => onGo(r.trim(), +d)}>Suspend</button>}>
    <div style={{ display: 'grid', gap: 12 }}><Field label="Reason"><textarea className="input" rows={3} value={r} onChange={(e) => setR(e.target.value)} /></Field>
      <Field label="Length"><select className="input" value={d} onChange={(e) => setD(e.target.value)}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="30">30 days</option><option value="0">Permanent</option></select></Field></div></Sheet> }
const PointsSheet = ({ u, onClose, onGo }) => { const [a, setA] = useState(''); const [r, setR] = useState('')
  return <Sheet title={`Points for ${u.display_name}`} onClose={onClose} footer={<button className="btn" disabled={!Number.isInteger(+a) || +a === 0 || !r.trim()} onClick={() => onGo(+a, r.trim())}>Apply</button>}>
    <div style={{ display: 'grid', gap: 12 }}><Field label="Amount" hint="Use a negative number to remove points"><input className="input" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} /></Field>
      <Field label="Reason"><input className="input" maxLength={200} value={r} onChange={(e) => setR(e.target.value)} /></Field></div></Sheet> }


/* ------------------------- people waiting for Student ID verification ------------------------- */
function Verifications({ onChanged }) {
  const { toast } = useApp(); const { data, loading, error, reload } = useQuery('verifs', admin.verifyRequests); const [rev, setRev] = useState(null)
  const done = () => { setRev(null); reload(); onChanged() }
  const reject = async (r) => { try { await admin.closeRequests(r.ids, 'dismissed'); toast('Request declined'); done() } catch (e) { toast(errText(e), 'err') } }
  return <>
    <p className="mute small pad" style={{ paddingTop: 0 }}>People who sent their Student ID. Check it, then verify. They get the verified badge and can log in with their Student ID.</p>
    {loading ? <div className="card flush"><Skeletons n={4} C={ListRowSkeleton} /></div> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={ShieldCheck} title="No one is waiting" hint="New requests show up here." />
      : data.map((r) => <div key={r.id} className="card order"><div className="row"><Avatar p={r.user} size={44} /><div className="grow minw"><Name p={r.user} /><div className="mute small">@{r.user?.username} - sent {ago(r.created_at)} ago</div></div></div>
        <div className="small">Student ID sent: <b>{r.requestedId || 'unknown'}</b></div>
        <div className="row wrap"><button className="btn sm" disabled={!r.user} onClick={() => setRev(r)}><BadgeCheck size={14} /> Review and verify</button><button className="btn sm ghost" onClick={() => reject(r)}><X size={14} /> Decline</button></div></div>)}
    {rev && <VerifySheet r={rev} onClose={() => setRev(null)} onDone={done} />}
  </>
}
function VerifySheet({ r, onClose, onDone }) {
  const { toast } = useApp(); const [busy, setBusy] = useState(false)
  const info = useQuery('vinfo:' + r.target_id, async () => (await admin.lookup(r.user.username)).find((x) => x.id === r.target_id) || null)
  const i = info.data
  const go = async () => { setBusy(true); try { await admin.verifyAndClose(r.target_id); toast('Student ID verified'); onDone() } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  return <Sheet title="Verify Student ID" onClose={onClose} footer={<button className="btn" disabled={busy || !i?.student_id_number} onClick={go}><BadgeCheck size={16} /> Verify</button>}>
    <div className="row"><Avatar p={r.user} size={48} /><div><Name p={r.user} /><div className="mute small">@{r.user.username}</div></div></div>
    {info.loading ? <Skeletons n={2} C={ListRowSkeleton} /> : i ? <div style={{ display: 'grid', gap: 8 }}>
      <div className="small"><span className="mute">Student ID on file</span><br /><b className="big2">{i.student_id_number || 'None'}</b></div>
      <div className="small"><span className="mute">Email</span><br /><b>{i.email}</b></div>
      <p className="mute small" style={{ margin: 0 }}>Only verify after you have matched this ID with the school records.</p></div>
      : <p className="mute">Could not load this user's details.</p>}</Sheet>
}

/* ------------------------------ shop deletion requests ------------------------------ */
function ShopRequests({ onChanged }) {
  const { toast } = useApp(); const { data, loading, error, reload } = useQuery('shopdel', admin.shopDeletions); const [ask, setAsk] = useState(null)
  const approve = async (r) => { try { const mode = await admin.approveShopDeletion(r, r.shop); toast(mode === 'deleted' ? 'Shop deleted' : 'Shop closed and hidden'); reload(); onChanged() } catch (e) { toast(errText(e), 'err') } }
  const decline = async (r) => { try { await admin.handleReport(r.id, 'dismissed'); toast('Request declined'); reload(); onChanged() } catch (e) { toast(errText(e), 'err') } }
  return <>
    <p className="mute small pad" style={{ paddingTop: 0 }}>Shop owners who asked to delete their shop. Nothing is removed until you approve.</p>
    {loading ? <div className="card flush"><Skeletons n={3} C={ListRowSkeleton} /></div> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={Store} title="No deletion requests" />
      : data.map((r) => <div key={r.id} className="card order"><div className="row"><span className="chico"><Store size={18} /></span><div className="grow minw"><b>{r.shop?.shop_name || 'Shop already removed'}</b><div className="mute small">Owner: {r.owner?.display_name || 'unknown'} (@{r.owner?.username}) - asked {ago(r.created_at)} ago</div></div></div>
        <div className="row wrap"><button className="btn sm danger" onClick={() => setAsk(r)}><Trash2 size={14} /> Approve deletion</button><button className="btn sm ghost" onClick={() => decline(r)}><X size={14} /> Decline</button></div></div>)}
    {ask && <Confirm title="Delete this shop?" text={`"${ask.shop?.shop_name || 'This shop'}" and its products will be removed from the app. This cannot be undone.`} action="Delete shop" danger onClose={() => setAsk(null)} onYes={() => approve(ask)} />}
  </>
}

function Suspensions() {
  const { toast } = useApp(); const { data, loading, error, reload } = useQuery('susp', admin.suspensions)
  if (loading) return <Skeletons n={3} C={ListRowSkeleton} />; if (error && !data) return <ErrorBox error={error} retry={reload} />
  if (!data?.length) return <Empty Icon={Ban} title="No active suspensions" />
  return data.map((s) => <div key={s.id} className="card order"><div className="row"><Avatar p={s.user} size={38} /><div className="grow"><b>{s.user?.display_name}</b><div className="mute small">{s.expires_at ? `Until ${dateTime(s.expires_at)}` : 'Permanent'}</div></div>
    <button className="btn sm ghost" onClick={async () => { try { await admin.lift(s.user_id); toast('Suspension lifted'); reload() } catch (e) { toast(errText(e), 'err') } }}>Lift</button></div><div>{s.reason}</div></div>)
}

function Audit() {
  const { data, loading, error, reload } = useQuery('audit', admin.audit)
  if (loading) return <Skeletons n={5} C={ListRowSkeleton} />; if (error && !data) return <ErrorBox error={error} retry={reload} />
  return <div className="card flush">{data.map((a) => <div key={a.id} className="pad"><b>{a.action.replace(/_/g, ' ')}</b> <span className="mute small">by {a.actor?.display_name || 'system'}</span>
    <div className="mute small">{dateTime(a.created_at)}{a.details && Object.keys(a.details).length ? ' - ' + Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(', ') : ''}</div></div>)}</div>
}

function Channels() {
  const { toast } = useApp(); const { data, loading, error, reload } = useQuery('channels', channels.list)
  const [name, setName] = useState(''); const [cat, setCat] = useState(''); const [del, setDel] = useState(null)
  const cats = [...new Set([...(data || []).map((c) => c.category), 'general'].filter(Boolean))]
  const add = async () => { try { await channels.create(name.trim(), cat || cats[0]); setName(''); toast('Channel created'); reload() } catch (e) { toast(errText(e), 'err') } }
  return <>
    <div className="card setcard"><b>New channel</b><div className="row"><input className="input" placeholder="e.g. MATH101" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <select className="input" value={cat || cats[0] || ''} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c} value={c}>{categoryMeta(c).label}</option>)}</select></div>
      <button className="btn" disabled={!name.trim()} onClick={add}><Plus size={16} /> Create</button></div>
    {loading ? <Skeletons n={4} C={ListRowSkeleton} /> : error && !data ? <ErrorBox error={error} retry={reload} /> : <div className="card flush">{data.map((c) => <div key={c.id} className="row pad"><span className="chico"><Hash size={18} /></span>
      <div className="grow"><b>{c.name}</b><div className="mute small">{categoryMeta(c.category).label}</div></div><button className="ibtn" aria-label="Delete channel" onClick={() => setDel(c)}><Trash2 size={18} /></button></div>)}</div>}
    {del && <Confirm title="Delete channel" text={`Delete "${del.name}"? Posts in it may be affected.`} action="Delete" danger onClose={() => setDel(null)} onYes={async () => { try { await channels.remove(del.id); reload() } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}

export default function Admin() {
  const nav = useNavigate(); const { isAdmin, me } = useApp(); const [tab, setTab] = useState('reports')
  const counts = useQuery('admincounts', admin.openCounts)
  if (me && !isAdmin) return <Navigate to="/" replace />
  const n = counts.data || {}; const changed = () => counts.reload()
  const tabs = [['reports', Flag, 'Reports', n.reports], ['verify', ShieldCheck, 'Verification', n.verify], ['users', Users, 'Users'], ['shops', Store, 'Shop requests', n.shops], ['susp', Ban, 'Suspensions'], ['channels', Hash, 'Channels'], ['audit', ScrollText, 'Audit log']]
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Admin console</h1></div>
    <div className="chips">{tabs.map(([k, I, l, c]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><I size={14} /> {l}{c > 0 && <i className="countdot">{c}</i>}</button>)}</div>
    {tab === 'reports' ? <Reports onChanged={changed} /> : tab === 'verify' ? <Verifications onChanged={changed} /> : tab === 'users' ? <UserTools onChanged={changed} /> : tab === 'shops' ? <ShopRequests onChanged={changed} /> : tab === 'susp' ? <Suspensions /> : tab === 'channels' ? <Channels /> : <Audit />}
  </>
}
