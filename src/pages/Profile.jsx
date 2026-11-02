import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Settings as Gear, Camera, Coins, Gift, Star, MessageCircle, Pencil, ChevronRight, ShoppingBag, PawPrint, QrCode, CalendarDays, Ghost, ReceiptText, Shield, Store, Check, Flag, UserMinus, ChevronLeft } from 'lucide-react'
import { profile, points, friends, chat } from '../api'
import { uploadImage } from '../lib/cloudinary'
import { levelInfo } from '../lib/level'
import { useQuery } from '../ui/hooks'
import { ProfileSkeleton, Bar } from '../ui/Skeleton'
import { Avatar, Name, PetImg, ErrorBox, Sheet, Field, Img, Empty, Confirm } from '../components/ui'
import FeedList from '../components/FeedList'
import ReportSheet from '../components/Report'
import { useBoards } from './Home'
import { useApp } from '../app/context'
import { ROLE_LABEL, COVER } from '../config'
import { errText } from '../lib/errors'

function Cover() { const [bad, setBad] = useState(false); return <div className="cover">{!bad && <img src={COVER} alt="" onError={() => setBad(true)} />}</div> }

function EditProfile({ onClose }) {
  const { me, reloadMe, toast } = useApp(); const ref = useRef()
  const [name, setName] = useState(me.display_name); const [user, setUser] = useState(me.username); const [avatar, setAvatar] = useState(me.avatar_url || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const pick = async (f) => { if (!f) return; setBusy(true); try { setAvatar(await uploadImage(f, 600)) } catch (e) { setErr(errText(e)) } finally { setBusy(false) } }
  const save = async () => {
    setErr(''); if (!name.trim()) return setErr('Enter a display name.'); if (!/^[a-zA-Z0-9_]{3,24}$/.test(user)) return setErr('Username: 3 to 24 letters, numbers or underscores.')
    setBusy(true)
    try {
      if (user.trim().toLowerCase() !== me.username.toLowerCase() && await profile.usernameTaken(user.trim())) throw new Error('That username is taken.')
      await profile.update({ display_name: name.trim(), username: user.trim(), avatar_url: avatar || null }); await reloadMe(); toast('Profile saved'); onClose()
    }
    catch (e) { setErr(/duplicate|exists|unique/i.test(e.message) ? 'That username is taken.' : errText(e)) } finally { setBusy(false) }
  }
  return <Sheet title="Edit profile" onClose={onClose} footer={<button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Save'}</button>}>
    <div className="center"><button className="avpick" onClick={() => ref.current.click()} aria-label="Change photo"><Avatar p={{ display_name: name || '?', avatar_url: avatar }} size={92} /><span className="avcam"><Camera size={16} /></span></button>
      <input ref={ref} hidden type="file" accept="image/*" onChange={(e) => pick(e.target.files[0])} /></div>
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <Field label="Display name"><input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Username"><input className="input" autoCapitalize="none" value={user} onChange={(e) => setUser(e.target.value)} /></Field>
      {err && <div className="err">{err}</div>}</div></Sheet>
}

const MENU = [[ReceiptText, 'My orders', '/orders'], [Store, 'Shop Nav (my shop)', '/merchant'], [PawPrint, 'Pets and points', '/pets'], [QrCode, 'Friends, QR and card', '/friends'], [CalendarDays, 'Events', '/events'], [Ghost, 'Anonymous chat', '/anonymous']]

/* ------------------------------- own profile ------------------------------- */
export function MyProfile() {
  const { me, meError, reloadMe, toast, isAdmin } = useApp(); const [edit, setEdit] = useState(false); const boards = useBoards()
  const earned = useQuery('earned', points.earned); const pets = useQuery('pets', points.pets); const mine = useQuery('mypets', points.myPets)
  const eq = mine.data?.find((u) => u.is_equipped); const pet = pets.data?.find((p) => p.id === eq?.pet_id)
  const claim = async () => { try { const n = await points.claimDaily(); toast(n ? `+${n} points added` : 'Already claimed today'); reloadMe(); earned.reload() } catch (e) { toast(errText(e), 'err') } }
  if (!me) return meError ? <ErrorBox error={meError} retry={reloadMe} /> : <ProfileSkeleton />
  const L = levelInfo(earned.data || 0)
  return <>
    <div className="profile-top"><Cover /><Link to="/settings" className="gear" aria-label="Settings"><Gear size={22} /></Link></div>
    <div className="card profile-card">
      <div className="row top"><div className="avbig"><Avatar p={me} size={84} dot /></div><div className="grow" />{pet && <PetImg p={pet} size={64} />}</div>
      <div className="row wrap tight" style={{ marginTop: 8 }}><h2 className="pname"><Name p={me} /></h2></div>
      <div className="mute">@{me.username} - {ROLE_LABEL[me.role] || me.role}</div>
      <div className="lvl"><div className="row between"><b><Star size={15} /> Level {L.level}</b><span className="mute small">{earned.loading ? '' : `${L.earned} / ${L.to} pts`}</span></div>
        {earned.loading ? <Bar h={10} r={99} /> : <div className="lv"><div style={{ width: L.pct + '%' }} /></div>}</div>
      <div className="row between wrap" style={{ marginTop: 10 }}><span className="pts"><Coins size={18} /> <b>{me.points_balance}</b> points{pet && <span className="mute small"> - {pet.name} x{Number(pet.point_multiplier)}</span>}</span>
        <div className="row"><button className="btn sm ghost" onClick={claim}><Gift size={15} /> Check in</button><button className="btn sm" onClick={() => setEdit(true)}><Pencil size={15} /> Edit</button></div></div>
    </div>
    <div className="card flush">{[...MENU, ...(isAdmin ? [[Shield, 'Admin console', '/admin']] : [])].map(([I, l, to]) =>
      <Link key={to} to={to} className="row pad menurow"><span className="chico"><I size={18} /></span><b className="grow">{l}</b><ChevronRight size={18} className="mute" /></Link>)}</div>
    <div className="group-h plain">My posts</div>
    <FeedList authorId={me.id} boards={boards.map} empty={<Empty Icon={Pencil} title="No posts yet" hint="Anonymous posts do not show here." />} />
    {edit && <EditProfile onClose={() => setEdit(false)} />}
  </>
}

/* ----------------------------- someone else's profile ----------------------------- */
export function UserProfile() {
  const { username } = useParams(); const nav = useNavigate(); const { me, toast } = useApp(); const boards = useBoards()
  const u = useQuery('user:' + username, () => profile.byUsername(username))
  const rel = useQuery('rel:' + (u.data?.id || ''), () => (u.data ? friends.isFriend(u.data.id) : null))
  const [sheet, setSheet] = useState(null)
  if (u.data && me && u.data.id === me.id) { nav('/profile', { replace: true }); return null }
  const msg = async () => { try { nav(`/chat/${await chat.openDm(u.data.id)}`) } catch (e) { toast(errText(e), 'err') } }
  return <>
    <div className="profile-top"><Cover /><button className="gear" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft size={22} /></button></div>
    {u.loading ? <ProfileSkeleton /> : u.error && !u.data ? <ErrorBox error={u.error} retry={u.reload} />
      : !u.data ? <Empty Icon={Ghost} title="User not found" /> : <>
        <div className="card profile-card"><div className="avbig"><Avatar p={u.data} size={84} dot /></div>
          <h2 className="pname"><Name p={u.data} /></h2><div className="mute">@{u.data.username} - {ROLE_LABEL[u.data.role] || u.data.role}</div>
          <div className="row" style={{ marginTop: 12 }}><button className="btn sm" onClick={msg}><MessageCircle size={15} /> Message</button>
            {rel.data === 'accepted' && <button className="btn sm ghost" onClick={() => setSheet('unfriend')}><Check size={15} /> Friends</button>}
            <button className="btn sm ghost" onClick={() => setSheet('report')}><Flag size={15} /> Report</button></div>
          {rel.data !== 'accepted' && <p className="mute small" style={{ marginBottom: 0 }}>To become friends, scan each other's QR code in Friends.</p>}</div>
        <div className="group-h plain">Posts</div>
        <FeedList authorId={u.data.id} boards={boards.map} empty={<Empty Icon={Pencil} title="No public posts yet" />} /></>}
    {sheet === 'report' && u.data && <ReportSheet type="user" id={u.data.id} onClose={() => setSheet(null)} />}
    {sheet === 'unfriend' && <Confirm title="Remove friend" text={`Remove ${u.data.display_name} from your friends?`} action="Remove" danger onClose={() => setSheet(null)}
      onYes={async () => { try { await friends.remove(u.data.id); rel.reload(); toast('Friend removed') } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}
