import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Store, ShoppingCart, ReceiptText, Clock, Search, Package, X } from 'lucide-react'
import { shop } from '../api'
import { useQuery, usePoll, useTick } from '../ui/hooks'
import { Skeletons, ProductSkeleton } from '../ui/Skeleton'
import { Img, Empty, ErrorBox } from '../components/ui'
import { useApp } from '../app/context'
import { useCart } from '../app/cart'
import { peso, countdown, dateTime } from '../lib/format'
import { ORDER_LABEL } from '../config'
import { errText } from '../lib/errors'

// One product tile, Shopee style: photo, name, price, shop. Tap to open it.
export function ProductCard({ p }) {
  const shopName = p.merchants?.shop_name || p.shop_name
  const sold = p.stock < 1
  return <Link to={`/product/${p.id}`} className={'pcard' + (sold ? ' sold' : '')}>
    <div className="pcard-img">{p.image_url ? <Img src={p.image_url} w={400} /> : <div className="noimg"><Package size={30} /></div>}{sold && <span className="soldtag">Sold out</span>}</div>
    <div className="pcard-b"><span className="pname2">{p.name}</span>
      <div className="pcard-price"><b>{peso(p.price_php)}</b>{p.price_points != null && <em>{p.price_points} pts</em>}</div>
      <div className="pcard-meta">{shopName && <span className="ell"><Store size={12} /> {shopName}</span>}{!sold && p.stock <= 5 && <span className="low">{p.stock} left</span>}</div></div>
  </Link>
}

export function CartButton() {
  const { count } = useCart()
  return <Link to="/cart" className="ibtn bell" aria-label={`Cart, ${count} items`}><ShoppingCart size={23} />{count > 0 && <i className="bellcount">{count > 99 ? '99+' : count}</i>}</Link>
}

const SIZE = 24
/* ------------------------------ browse everything ------------------------------ */
export default function Shop() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState('')
  useEffect(() => { const t = setTimeout(() => setDq(q), 350); return () => clearTimeout(t) }, [q])
  const merchants = useQuery('merchants', shop.merchants)
  const first = useQuery('products:' + dq, () => shop.allProducts({ q: dq, size: SIZE }))
  const [extra, setExtra] = useState([]); const [done, setDone] = useState(false); const [more, setMore] = useState(false)
  useEffect(() => { setExtra([]); setDone(false) }, [dq])
  const list = [...(first.data || []), ...extra]
  const hasMore = !!first.data && first.data.length >= SIZE && !done
  const loadMore = async () => {
    setMore(true)
    try { const r = await shop.allProducts({ q: dq, from: list.length, size: SIZE }); if (r.length < SIZE) setDone(true); setExtra((x) => [...x, ...r]) } catch { /* retry on next tap */ } finally { setMore(false) }
  }
  const inStockFirst = [...list].sort((a, b) => (a.stock < 1) - (b.stock < 1))
  return <>
    <div className="page-title"><h1>Shop</h1><div className="grow" />
      <Link to="/orders" className="ibtn" aria-label="My orders"><ReceiptText size={23} /></Link><CartButton /></div>
    <div className="shopsearch"><div className="inp"><Search size={18} /><input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <button className="ibtn" aria-label="Clear" onClick={() => setQ('')}><X size={16} /></button>}</div></div>

    {!q && (merchants.loading ? <div className="storerow">{Array.from({ length: 5 }, (_, i) => <div key={i} className="sk round" style={{ width: 64, height: 64, flex: 'none' }} />)}</div>
      : !!merchants.data?.length && <div className="storerow">{merchants.data.map((m) => <Link key={m.id} to={`/shop/${m.id}`} className="storepill"><span>{m.shop_name[0]?.toUpperCase()}</span><em className="ell">{m.shop_name}</em></Link>)}</div>)}

    {first.loading ? <div className="pgrid">{Array.from({ length: 6 }, (_, i) => <ProductSkeleton key={i} />)}</div>
      : first.error && !first.data ? <ErrorBox error={first.error} retry={first.reload} />
      : !inStockFirst.length ? <Empty Icon={Package} title={dq ? 'No products found' : 'Nothing for sale yet'} hint={dq ? 'Try another word.' : 'Shops can add products from Profile > Shop Nav.'}>{!dq && <Link to="/merchant" className="btn sm">Open my shop</Link>}</Empty>
      : <><div className="pgrid">{inStockFirst.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        {hasMore && <div className="center" style={{ padding: 12 }}><button className="btn ghost sm" disabled={more} onClick={loadMore}>{more ? 'Loading' : 'Show more'}</button></div>}</>}
  </>
}

/* ----------------------------------- one shop ----------------------------------- */
export function ShopPage() {
  const { id } = useParams(); const nav = useNavigate()
  const m = useQuery('merchant:' + id, () => shop.merchant(id)); const prods = useQuery('products:' + id, () => shop.products(id))
  const { count } = useCart()
  const list = (prods.data || []).map((p) => ({ ...p, shop_name: m.data?.shop_name }))
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav('/shop')} aria-label="Back"><ChevronLeft /></button>
      <div className="grow minw"><h1 className="ell">{m.data?.shop_name || <span className="sk" style={{ display: 'inline-block', width: 150, height: 20 }} />}</h1>
        {m.data && <div className="mute small"><Clock size={12} /> Pick up within {m.data.order_expiration_minutes} min of ordering</div>}</div><CartButton /></div>
    {m.data?.description && <p className="pad" style={{ paddingTop: 0, margin: 0 }}>{m.data.description}</p>}
    {prods.loading ? <div className="pgrid">{Array.from({ length: 4 }, (_, i) => <ProductSkeleton key={i} />)}</div> : prods.error && !prods.data ? <ErrorBox error={prods.error} retry={prods.reload} />
      : !list.length ? <Empty Icon={Package} title="Nothing for sale right now" />
      : <div className="pgrid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
    {count > 0 && <Link to="/cart" className="cartbar"><ShoppingCart size={20} /><span>View cart</span><b>{count} item{count > 1 ? 's' : ''}</b></Link>}
  </>
}

/* ------------------------------------ my orders ------------------------------------ */
export function Orders() {
  const nav = useNavigate(); const { toast, reloadMe } = useApp()
  const { data, loading, error, reload } = useQuery('orders', shop.myOrders)
  const names = useQuery('mnames:' + (data || []).map((o) => o.merchant_id).join(), () => shop.merchantNames((data || []).map((o) => o.merchant_id)).catch(() => ({})))
  usePoll(reload, 10000); useTick(1000)
  const cancel = async (o) => { try { await shop.setStatus(o.id, 'cancelled'); toast('Order cancelled'); reload(); reloadMe() } catch (e) { toast(errText(e), 'err') } }
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>My orders</h1></div>
    {loading ? <Skeletons n={3} C={ProductSkeleton} /> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={ReceiptText} title="No orders yet" hint="Pre-order from a campus shop."><Link to="/shop" className="btn sm">Browse shops</Link></Empty>
      : data.map((o) => <div key={o.id} className="card order">
        <div className="row between"><b>{names.data?.[o.merchant_id] || 'Shop'}</b><span className={'status s-' + o.status}>{ORDER_LABEL[o.status] || o.status}</span></div>
        <div className="mute small">{dateTime(o.created_at)} - {o.payment_method === 'points' ? 'Paid with points' : 'Pay cash at pickup'}</div>
        <div className="lines">{o.order_items?.map((i) => <div key={i.id} className="row between"><span>{i.quantity} x {i.products?.name || 'Item'}</span><span className="mute">{peso(i.unit_price_php * i.quantity)}</span></div>)}</div>
        <div className="row between"><b>Total</b><b>{o.payment_method === 'points' ? `${o.total_amount_points} pts` : peso(o.total_amount_php)}</b></div>
        {o.status === 'pending' && <div className="row between"><span className="timer"><Clock size={14} /> Shop must confirm in {countdown(o.expires_at)}</span><button className="btn sm ghost" onClick={() => cancel(o)}>Cancel</button></div>}
        {o.status === 'ready_for_pickup' && <div className="okmsg">Ready. Show this screen at the counter.</div>}</div>)}
  </>
}
