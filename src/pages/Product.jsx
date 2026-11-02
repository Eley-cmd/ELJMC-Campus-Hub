import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Store, ChevronRight, Minus, Plus, ShoppingCart, Trash2, Package, Banknote, Coins, Clock } from 'lucide-react'
import { shop } from '../api'
import { useQuery } from '../ui/hooks'
import { cart, useCart } from '../app/cart'
import { useApp } from '../app/context'
import { Img, Empty, ErrorBox } from '../components/ui'
import { Bar } from '../ui/Skeleton'
import { CartButton } from './Shop'
import { peso } from '../lib/format'
import { errText } from '../lib/errors'

/* ------------------------------- product detail ------------------------------- */
export function ProductPage() {
  const { id } = useParams(); const nav = useNavigate(); const { me, toast } = useApp()
  const { data: p, loading, error, reload } = useQuery('product:' + id, () => shop.product(id))
  const [qty, setQty] = useState(1)
  const mine = p?.merchants?.owner_id === me?.id
  const gone = p && (!p.is_available || !p.merchants?.is_active)
  const sold = p && p.stock < 1
  const add = () => { cart.add({ ...p, shop_name: p.merchants?.shop_name }, qty); toast('Added to cart') }
  const buy = () => { cart.add({ ...p, shop_name: p.merchants?.shop_name }, qty); nav('/cart') }
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => (history.length > 1 ? nav(-1) : nav('/shop'))} aria-label="Back"><ChevronLeft /></button><div className="grow" /><CartButton /></div>
    {loading ? <div className="card"><div className="sk" style={{ aspectRatio: '1', borderRadius: 12 }} /><div style={{ height: 12 }} /><Bar w="70%" h={20} /><div style={{ height: 10 }} /><Bar w="40%" h={16} /></div>
      : error && !p ? <ErrorBox error={error} retry={reload} />
      : !p ? <Empty Icon={Package} title="Product not found" hint="It may have been removed." />
      : <>
        <div className="card flush">{p.image_url ? <Img src={p.image_url} w={900} className="pdetail-img" /> : <div className="pdetail-img noimg"><Package size={48} /></div>}
          <div className="pdetail-b"><div className="pdetail-price"><b>{peso(p.price_php)}</b>{p.price_points != null && <em>or {p.price_points} pts</em>}</div>
            <h2 className="pdetail-name">{p.name}</h2>
            <div className="mute small">{sold ? 'Sold out' : `${p.stock} available`}</div></div></div>
        <Link to={`/shop/${p.merchant_id}`} className="card row shoplink"><span className="chico"><Store size={18} /></span><div className="grow minw"><b className="ell">{p.merchants?.shop_name}</b>
          <div className="mute small"><Clock size={12} /> Pick up within {p.merchants?.order_expiration_minutes} min of ordering</div></div><span className="mute small">Visit shop</span><ChevronRight size={18} className="mute" /></Link>
        {gone ? <p className="notice">This item is not available right now.</p> : mine ? <p className="notice">This is your own product.</p> : !sold && <>
          <div className="card row between"><b>Quantity</b><div className="qty" style={{ width: 130 }}><button aria-label="Less" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><Minus size={16} /></button><b>{qty}</b><button aria-label="More" disabled={qty >= p.stock} onClick={() => setQty(qty + 1)}><Plus size={16} /></button></div></div>
          <div className="buybar"><button className="btn ghost" onClick={add}><ShoppingCart size={18} /> Add to cart</button><button className="btn" onClick={buy}>Buy now</button></div></>}
        {sold && !gone && <div className="buybar"><button className="btn" disabled>Sold out</button></div>}
      </>}
  </>
}

/* ------------------------------------- cart ------------------------------------- */
export function CartPage() {
  const nav = useNavigate(); const { me, toast, reloadMe, suspension } = useApp(); const { items } = useCart()
  const [pay, setPay] = useState({}); const [busy, setBusy] = useState('')
  const groups = Object.values(items.reduce((a, i) => { (a[i.p.merchant_id] ||= { id: i.p.merchant_id, name: i.p.shop_name, rows: [] }).rows.push(i); return a }, {}))
  const place = async (g) => {
    const method = pay[g.id] || 'cash'; setBusy(g.id)
    try { await shop.placeOrder(g.id, g.rows.map((i) => ({ product_id: i.p.id, quantity: i.qty })), method); cart.clearShop(g.id); toast('Order placed'); reloadMe(); nav('/orders') }
    catch (e) { toast(errText(e), 'err') } finally { setBusy('') }
  }
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>My cart</h1></div>
    {!groups.length ? <Empty Icon={ShoppingCart} title="Your cart is empty" hint="Browse the shop and add what you like."><Link to="/shop" className="btn sm">Browse shop</Link></Empty>
      : groups.map((g) => { const php = g.rows.reduce((a, i) => a + i.p.price_php * i.qty, 0); const canPts = g.rows.every((i) => i.p.price_points != null); const pts = canPts ? g.rows.reduce((a, i) => a + i.p.price_points * i.qty, 0) : 0
        const method = canPts ? pay[g.id] || 'cash' : 'cash'
        return <div key={g.id} className="card cartgroup">
          <Link to={`/shop/${g.id}`} className="row"><Store size={18} /><b className="grow">{g.name}</b><ChevronRight size={18} className="mute" /></Link>
          {g.rows.map(({ p, qty }) => <div key={p.id} className="row cartrow">
            <Link to={`/product/${p.id}`}>{p.image_url ? <Img src={p.image_url} w={160} className="thumb" /> : <span className="chico"><Package size={18} /></span>}</Link>
            <div className="grow minw"><Link to={`/product/${p.id}`} className="ell" style={{ display: 'block' }}>{p.name}</Link><b>{peso(p.price_php)}</b></div>
            <div className="qty"><button aria-label="Less" onClick={() => cart.set(p.id, qty - 1)}><Minus size={16} /></button><b>{qty}</b><button aria-label="More" disabled={qty >= p.stock} onClick={() => cart.set(p.id, qty + 1)}><Plus size={16} /></button></div>
            <button className="ibtn" aria-label="Remove" onClick={() => cart.remove(p.id)}><Trash2 size={18} /></button></div>)}
          <div className="seg"><button className={method === 'cash' ? 'on' : ''} onClick={() => setPay({ ...pay, [g.id]: 'cash' })}><Banknote size={15} /> Pay cash at pickup</button>
            <button className={method === 'points' ? 'on' : ''} disabled={!canPts} onClick={() => setPay({ ...pay, [g.id]: 'points' })}><Coins size={15} /> Use points</button></div>
          {method === 'points' && me && <p className={me.points_balance < pts ? 'err' : 'mute small'} style={{ margin: 0 }}>You have {me.points_balance} points{me.points_balance < pts ? `, you need ${pts}.` : '.'}</p>}
          <div className="row between"><span className="mute">Total</span><b className="big2">{method === 'points' ? `${pts} pts` : peso(php)}</b></div>
          <button className="btn" disabled={busy === g.id || !!suspension || (method === 'points' && me && me.points_balance < pts)} onClick={() => place(g)}>{busy === g.id ? 'Placing order' : 'Place order'}</button>
          <p className="mute small" style={{ margin: 0 }}>If the shop does not confirm in time, the order expires and points are refunded automatically.</p></div> })}
  </>
}
