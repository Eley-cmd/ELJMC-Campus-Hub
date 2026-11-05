import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, Hash, Store, Package, UserRound, FileText } from 'lucide-react'
import { feed, profile, channels, shop } from '../api'
import { useQuery } from '../ui/hooks'
import { useHidden } from '../lib/hidden'
import { categoryMeta } from '../lib/channels'
import { peso } from '../lib/format'
import { Avatar, Name, Empty, ErrorBox } from './ui'
import { Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import Post from './Post'

// The violet pill search bar used on Home, Chats, Channels and Shop (same look everywhere)
export function SearchBar({ value, onChange, placeholder = 'Search', sticky }) {
  return <div className={'msgr-search' + (sticky ? ' sticky' : '')}><Search size={18} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} enterKeyHint="search" />
    {value && <button type="button" className="ibtn" aria-label="Clear" onClick={() => onChange('')}><X size={16} /></button>}</div>
}

const Group = ({ title, Icon, children }) => <div className="sr-group"><div className="sr-h"><Icon size={15} /> {title}</div>{children}</div>

// Results for posts, people, channels, shops and products
export default function SearchResults({ q, boards }) {
  const [dq, setDq] = useState(q.trim())
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t) }, [q])
  const hiddenIds = useHidden()
  const ok = dq.length >= 2
  const res = useQuery('search:' + (ok ? dq : ''), async () => {
    if (!ok) return null
    const [people, posts, products] = await Promise.all([profile.search(dq), feed.search(dq), shop.allProducts({ q: dq, size: 6 }).catch(() => [])])
    return { people, posts, products }
  })
  const chans = useQuery('channels', channels.list); const shops = useQuery('merchants', shop.merchants)
  const needle = dq.toLowerCase()
  const cs = ok ? (chans.data || []).filter((c) => c.name?.toLowerCase().includes(needle)).slice(0, 6) : []
  const ss = ok ? (shops.data || []).filter((m) => m.shop_name?.toLowerCase().includes(needle)).slice(0, 6) : []
  if (!ok) return <p className="mute center small" style={{ padding: 24 }}>Type at least 2 letters to search posts, people, channels and shops.</p>
  if (res.loading && !res.data) return <div className="card flush"><Skeletons n={5} C={ListRowSkeleton} /></div>
  if (res.error && !res.data) return <ErrorBox error={res.error} retry={res.reload} />
  const { people = [], posts = [], products = [] } = res.data || {}
  const ps = posts.filter((p) => !hiddenIds.has(p.id))
  if (!people.length && !ps.length && !products.length && !cs.length && !ss.length) return <Empty Icon={Search} title="No results" hint={`Nothing found for "${dq}".`} />
  return <>
    {!!people.length && <Group title="People" Icon={UserRound}><div className="card flush">{people.map((u) => <Link key={u.id} to={`/profile/${u.username}`} className="row pad chrow">
      <Avatar p={u} size={42} dot /><div className="grow minw"><Name p={u} /><div className="mute small ell">@{u.username}</div></div></Link>)}</div></Group>}
    {!!cs.length && <Group title="Channels" Icon={Hash}><div className="card flush">{cs.map((c) => <Link key={c.id} to={`/channel/${c.id}`} className="row pad chrow">
      <span className="chico"><Hash size={18} /></span><div className="grow minw"><b>{c.name}</b><div className="mute small">{categoryMeta(c.category).label}</div></div></Link>)}</div></Group>}
    {!!ss.length && <Group title="Shops" Icon={Store}><div className="card flush">{ss.map((m) => <Link key={m.id} to={`/shop/${m.id}`} className="row pad chrow">
      <span className="chico"><Store size={18} /></span><b className="grow">{m.shop_name}</b></Link>)}</div></Group>}
    {!!products.length && <Group title="Products" Icon={Package}><div className="card flush">{products.map((p) => <Link key={p.id} to={`/product/${p.id}`} className="row pad chrow">
      <span className="chico"><Package size={18} /></span><div className="grow minw"><b className="ell">{p.name}</b><div className="mute small">{peso(p.price_php)}{p.merchants?.shop_name ? ` - ${p.merchants.shop_name}` : ''}</div></div></Link>)}</div></Group>}
    {!!ps.length && <Group title="Posts" Icon={FileText}>{ps.map((p) => <Post key={p.id} p={p} boards={boards} onChange={res.reload} />)}</Group>}
  </>
}