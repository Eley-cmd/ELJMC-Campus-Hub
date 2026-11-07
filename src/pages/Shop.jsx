import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Store, ShoppingCart, ReceiptText, Clock, Package, MapPin, LayoutGrid, Coins, Tag, Flame, ArrowRight, Plus } from 'lucide-react'
import { shop } from '../api'
import { useQuery, usePoll, useTick } from '../ui/hooks'
import { Skeletons, ProductSkeleton } from '../ui/Skeleton'
import { Img, Empty, ErrorBox } from '../components/ui'
import { SearchBar } from '../components/Search'
import { useApp } from '../app/context'
import { useCart, cart } from '../app/cart'
import { peso, countdown, dateTime } from '../lib/format'
import { ORDER_LABEL } from '../config'
import { errText } from '../lib/errors'

// One product card: photo, name, shop, price and a small "Cart +" button. Tap the card to open the product.
export function ProductCard({ p }) {
  const { toast } = useApp()
  const shopName = p.merchants?.shop_name || p.shop_name
  const sold = p.stock < 1
  const add = (e) => { e.preventDefault(); e.stopPropagation(); cart.add({ ...p, shop_name: shopName }, 1); toast('Added to cart') }
  return <div className={'pc' + (sold ? ' sold' : '')}>
    <Link to={`/product/${p.id}`} className="pc-img" aria-label={p.name}>
      {p.image_url ? <Img src={p.image_url} w={400} /> : <div className="noimg"><Package size={30} /></div>}
      {p.price_points != null && <span className="pc-pts"><Coins size={11} /> {p.price_points}</span>}
      {sold && <span className="soldtag">Sold out</span>}
      {!sold && p.stock <= 5 && <span className="pc-low">{p.stock} left</span>}</Link>
    <div className="pc-b">
      <Link to={`/product/${p.id}`} className="pc-name">{p.name}</Link>
      {shopName && <span className="pc-shop ell"><Store size={12} /> {shopName}</span>}
      <div className="pc-foot"><b className="pc-price">{peso(p.price_php)}</b>
        <button type="button" className="pc-add" disabled={sold} aria-label={`Add ${p.name} to cart`} onClick={add}>Cart <Plus size={13} /></button></div></div>
  </div>
}

export function CartButton() {
  const { count } = useCart()
  return <Link to="/cart" className="ibtn bell" aria-label={`Cart, ${count} items`}><ShoppingCart size={23} />{count > 0 && <i className="bellcount">{count > 99 ? '99+' : count}</i>}</Link>
}

const SIZE = 24
// Round icon filters (like the category circles in the food app). They filter the products already loaded.
const FILTERS = [['all', 'All', LayoutGrid, '#7c3aed'], ['points', 'Points', Coins, '#db2777'], ['cheap', 'Under 50', Tag, '#d97706'], ['low', 'Almost gone', Flame, '#ea580c']]
const KEEP = { all: () => true, points: (p) => p.price_points != null, cheap: (p) => Number(p.price_php) <= 50, low: (p) => p.stock > 0 && p.stock <= 5 }
const Section = ({ title, onAll, children }) => <div className="sec"><div className="sec-h"><h2>{title}</h2>{onAll && <button type="button" onClick={onAll}>View all <ChevronRight size={15} /></button>}</div>{children}</div>

// Promo banner: swaps by itself. Everything on it comes from real data (your points, newest product, opening a shop).
function Hero({ products, onPoints }) {
  const nav = useNavigate(); const [i, setI] = useState(0); const [hold, setHold] = useState(false)
  const withPts = products.find((p) => p.price_points != null && p.image_url) || products.find((p) => p.price_points != null)
  const newest = products.find((p) => p.image_url && p.stock > 0) || products[0]
  const slides = [
    { tag: 'ELJMC POINTS', title: 'Pay with your points', sub: 'Use the points you earn on campus for food and items.', cta: 'Shop with points', act: onPoints, img: withPts?.image_url, c: 'linear-gradient(120deg,#4c1d95,#7c3aed 60%,#a78bfa)' },
    ...(newest ? [{ tag: 'JUST IN', title: newest.name, sub: `From ${newest.merchants?.shop_name || 'a campus shop'} - ${peso(newest.price_php)}`, cta: 'View item', act: () => nav(`/product/${newest.id}`), img: newest.image_url, c: 'linear-gradient(120deg,#6d28d9,#c026d3 70%,#e879f9)' }] : []),
    { tag: 'SELL ON CAMPUS', title: 'Open your shop', sub: 'Reach every student, teacher and staff member.', cta: 'Open shop', act: () => nav('/merchant'), c: 'linear-gradient(120deg,#1e1b4b,#4338ca 60%,#6366f1)' },
  ]
  useEffect(() => { if (hold || slides.length < 2) return; const t = setInterval(() => setI((x) => (x + 1) % slides.length), 5200); return () => clearInterval(t) }, [hold, slides.length])
  const s = slides[i % slides.length]
  return <div className="hero" style={{ background: s.c }} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onTouchStart={() => setHold(true)}>
    <div className="hero-body" key={i}>
      <div className="hero-text"><span className="hero-tag">{s.tag}</span><h2 className="ell2">{s.title}</h2><p className="ell2">{s.sub}</p>
        <button type="button" className="hero-cta" onClick={s.act}>{s.cta} <ArrowRight size={15} /></button></div>
      {s.img && <div className="hero-img"><Img src={s.img} w={400} /></div>}</div>
    <div className="dots">{slides.map((_, k) => <button key={k} type="button" aria-label={`Slide ${k + 1}`} className={k === i % slides.length ? 'on' : ''} onClick={() => setI(k)} />)}</div></div>
}

/* ------------------------------ browse everything ------------------------------ */
export default function Shop() {
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [f, setF] = useState('all'); const allRef = useRef()
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
  const ordered = [...list].sort((a, b) => (a.stock < 1) - (b.stock < 1))
  const shown = ordered.filter(KEEP[f])
  const home = !q && f === 'all' // the full storefront; any filter or search shows just the matching products
  const goAll = () => allRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const inStock = ordered.filter((p) => p.stock > 0)
  const ptsRow = inStock.filter(KEEP.points).slice(0, 10); const dealRow = inStock.slice(0, 10)
  return <>
    <div className="shop-top">
      <div className="loc"><span className="loc-ic"><MapPin size={20} /></span><div className="grow minw"><small className="mute">Pickup at</small><b className="ell">ELJMC campus shops</b></div>
        <Link to="/orders" className="ibtn" aria-label="My orders"><ReceiptText size={23} /></Link><CartButton /></div></div>
    <SearchBar sticky value={q} onChange={setQ} placeholder="Search products" />

    {!q && <div className="cats" role="tablist" aria-label="Filter products">{FILTERS.map(([k, label, I, c]) =>
      <button key={k} type="button" role="tab" aria-selected={f === k} className={'cat' + (f === k ? ' on' : '')} style={{ '--c': c }} onClick={() => setF(k)}>
        <span><I size={24} /></span><em>{label}</em></button>)}</div>}

    {home && <>
      <Hero products={ordered} onPoints={() => setF('points')} />
      {merchants.loading ? <div className="shoprow">{Array.from({ length: 3 }, (_, i) => <div key={i} className="sk" style={{ width: 170, height: 150, borderRadius: 18, flex: 'none' }} />)}</div>
        : !!merchants.data?.length && <Section title="Popular Shops"><div className="shoprow">{merchants.data.map((m) => <Link key={m.id} to={`/shop/${m.id}`} className="shopcard">
          <span className="shopcard-av">{m.shop_name[0]?.toUpperCase()}</span><b className="ell">{m.shop_name}</b><small className="mute">Pickup in {m.order_expiration_minutes} min</small></Link>)}</div></Section>}
      {!!dealRow.length && <Section title="Today's Best Deals For You!" onAll={goAll}><div className="hrow">{dealRow.map((p) => <ProductCard key={p.id} p={p} />)}</div></Section>}
      {!!ptsRow.length && <Section title="Pay with points" onAll={() => setF('points')}><div className="hrow">{ptsRow.map((p) => <ProductCard key={p.id} p={p} />)}</div></Section>}
    </>}

    <div ref={allRef} className="sec"><div className="sec-h"><h2>{q ? 'Results' : f === 'all' ? 'All Products' : FILTERS.find(([k]) => k === f)[1]}</h2>{!q && f !== 'all' && <button type="button" onClick={() => setF('all')}>Show all</button>}</div></div>
    {first.loading ? <div className="pgrid">{Array.from({ length: 6 }, (_, i) => <ProductSkeleton key={i} />)}</div>
      : first.error && !first.data ? <ErrorBox error={first.error} retry={first.reload} />
      : !shown.length ? <Empty Icon={Package} title={dq ? 'No products found' : f !== 'all' ? 'Nothing here yet' : 'Nothing for sale yet'} hint={dq ? 'Try another word.' : f !== 'all' ? 'Try another filter.' : 'Shops can add products from Profile > Shop Nav.'}>{!dq && f === 'all' && <Link to="/merchant" className="btn sm">Open my shop</Link>}</Empty>
      : <><div className="pgrid">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        {hasMore && f === 'all' && <div className="center" style={{ padding: 12 }}><button className="btn ghost sm" disabled={more} onClick={loadMore}>{more ? 'Loading' : 'Show more'}</button></div>}</>}
  </>
}

/* ----------------------------------- one shop ----------------------------------- */
export function ShopPage() {
  const { id } = useParams(); const nav = useNavigate()
  const m = useQuery('merchant:' + id, () => shop.merchant(id)); const prods = useQuery('products:' + id, () => shop.products(id))
  const { count } = useCart()
  const list = (prods.data || []).map((p) => ({ ...p, shop_name: m.data?.shop_name }))
  return <>
    <div className="store-cover"><button type="button" className="gear" onClick={() => nav('/shop')} aria-label="Back"><ChevronLeft size={22} /></button>
      <div className="store-cart"><CartButton /></div></div>
    <div className="store-head">
      <span className="store-av">{m.data ? m.data.shop_name[0]?.toUpperCase() : ''}</span>
      <div className="grow minw">{m.data ? <><h1 className="ell">{m.data.shop_name}</h1><div className="mute small"><Clock size={13} /> Pickup within {m.data.order_expiration_minutes} min of ordering</div></>
        : <><span className="sk" style={{ display: 'block', width: 160, height: 22 }} /><span className="sk" style={{ display: 'block', width: 120, height: 12, marginTop: 8 }} /></>}</div></div>
    {m.data?.description && <p className="store-desc">{m.data.description}</p>}
    <div className="sec"><div className="sec-h"><h2>All items{prods.data ? ` (${list.length})` : ''}</h2></div></div>
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