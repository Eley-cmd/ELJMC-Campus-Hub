import { useNavigate } from 'react-router-dom'
import { Bell, ShoppingBag, Store, UserPlus, BadgeCheck, MessageCircle, CornerDownRight, Heart, CheckCheck, X, ChevronLeft } from 'lucide-react'
import { notifications } from '../api'
import { useQuery } from '../ui/hooks'
import { Skeletons, NotifSkeleton } from '../ui/Skeleton'
import { Empty, ErrorBox } from '../components/ui'
import { useApp } from '../app/context'
import { ago } from '../lib/format'

const ICON = { order_status: ShoppingBag, new_order: Store, friend_added: UserPlus, verified: BadgeCheck, post_reaction: Heart, post_comment: MessageCircle, comment_reply: CornerDownRight, comment_like: Heart }
const route = (n) => {
  const d = n.data || {}
  if (n.type === 'order_status') return '/orders'
  if (n.type === 'new_order') return '/merchant'
  if (n.type === 'friend_added') return '/friends'
  if (n.type === 'verified') return '/settings'
  if (d.post_id) return `/post/${d.post_id}`
  return null
}

export default function Notifications() {
  const nav = useNavigate(); const { setUnread, reloadUnread } = useApp()
  const { data, loading, error, reload, setData } = useQuery('notifs', notifications.list)
  const open = async (n) => {
    if (!n.read_at) { setData((d) => d.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))); notifications.read(n.id).then(reloadUnread, () => {}) }
    const r = route(n); if (r) nav(r)
  }
  const all = async () => { await notifications.readAll(); setUnread(0); reload() }
  const del = async (n) => { setData((d) => d.filter((x) => x.id !== n.id)); notifications.remove(n.id).then(reloadUnread, reload) }
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Notifications</h1><div className="grow" />
      <button className="btn sm ghost" onClick={all} disabled={!data?.some((n) => !n.read_at)}><CheckCheck size={15} /> Read all</button></div>
    {loading ? <div className="card flush"><Skeletons n={6} C={NotifSkeleton} /></div> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={Bell} title="You are all caught up" hint="Reactions, replies, orders and friend adds show up here." />
      : <div className="card flush">{data.map((n) => { const I = ICON[n.type] || Bell
        return <div key={n.id} className={'row pad notif' + (n.read_at ? '' : ' unread')}>
          <button className="row grow left" onClick={() => open(n)}><span className="chico"><I size={18} /></span>
            <div className="grow minw"><div className={n.read_at ? '' : 'bold'}>{n.title}</div>{n.body && <div className="mute small ell">{n.body}</div>}<div className="mute small">{ago(n.created_at)}</div></div>
            {!n.read_at && <i className="udot" />}</button>
          <button className="ibtn" aria-label="Delete notification" onClick={() => del(n)}><X size={16} /></button></div> })}</div>}
  </>
}
