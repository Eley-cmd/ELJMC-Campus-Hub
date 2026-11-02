import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Store, Plus, Package, Pencil, Trash2, Clock, ImagePlus, Check, X, ReceiptText, ShieldAlert } from 'lucide-react'
import { shop } from '../api'
import { useQuery, usePoll, useTick } from '../ui/hooks'
import { Skeletons, ListRowSkeleton, ProductSkeleton } from '../ui/Skeleton'
import { Img, Empty, ErrorBox, Sheet, Field, Segmented, Toggle, Avatar, Confirm } from '../components/ui'
import { useApp } from '../app/context'
import { uploadImage } from '../lib/cloudinary'
import { peso, countdown, dateTime } from '../lib/format'
import { ORDER_FLOW, ORDER_LABEL, ORDER_ACTION, TERMS_VERSION } from '../config'
import { errText } from '../lib/errors'

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`)

function Register({ onDone }) {
  const { toast } = useApp()
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [min, setMin] = useState(30); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const go = async () => { setBusy(true); setErr(''); try { await shop.registerMerchant(name.trim(), desc.trim(), min); toast('Your shop is open'); onDone() } catch (e) { setErr(errText(e)) } finally { setBusy(false) } }
  return <div className="card setcard">
    <div className="row"><Store size={22} /><h2 style={{ margin: 0 }}>Open your shop</h2></div>
    <p className="mute" style={{ margin: 0 }}>Sell food and items to the campus. Orders are pre-orders with a pickup timer you control.</p>
    <Field label="Shop name"><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Description (optional)"><textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
    <Field label={`Order expiry: ${fmtMin(min)}`} hint="How long you have to confirm an order (5 minutes to 5 hours). It cannot be changed on an order once placed."><input type="range" min={5} max={300} step={5} value={min} onChange={(e) => setMin(+e.target.value)} /></Field>
    <div className="terms"><b>Platform Terms (version {TERMS_VERSION})</b>
      <ul><li>You are responsible for preparing and handing over every order you confirm.</li><li>Points orders are refunded automatically when an order is cancelled or expires.</li>
        <li>Point System: points are earned on campus, are not cash, and have no value outside ELJMC Campus Hub.</li><li>Moderators may suspend shops that break campus rules.</li></ul></div>
    <label className="row"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> <span>I agree to the Terms and the Point System rules</span></label>
    {err && <div className="err">{err}</div>}
    <button type="button" className="btn" disabled={busy || !ok || !name.trim()} onClick={go}>Open shop</button></div>
}

function ProductForm({ merchantId, p, onClose, onSaved }) {
  const { toast } = useApp(); const ref = useRef()
  const [f, setF] = useState({ name: p?.name || '', price_php: p?.price_php ?? '', price_points: p?.price_points ?? '', stock: p?.stock ?? 10, is_available: p?.is_available ?? true, image_url: p?.image_url || '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pick = async (file) => { if (!file) return; setBusy(true); try { setF((x) => ({ ...x, image_url: '' })); const u = await uploadImage(file, 900); setF((x) => ({ ...x, image_url: u })) } catch (e) { setErr(errText(e)) } finally { setBusy(false) } }
  const save = async () => {
    setErr(''); const price = Number(f.price_php), stock = Number.isInteger(+f.stock) ? +f.stock : NaN
    if (!f.name.trim()) return setErr('Enter a name.'); if (!(price >= 0) || f.price_php === '') return setErr('Enter a price in pesos.'); if (!(stock >= 0)) return setErr('Stock must be 0 or more.')
    if (f.price_points !== '' && !(Number.isInteger(+f.price_points) && +f.price_points >= 0)) return setErr('Points price must be a whole number.')
    const row = { name: f.name.trim(), price_php: price, price_points: f.price_points === '' ? null : +f.price_points, stock, is_available: f.is_available, image_url: f.image_url || null }
    setBusy(true)
    try { p ? await shop.editProduct(p.id, row) : await shop.addProduct({ ...row, merchant_id: merchantId }); toast(p ? 'Product saved' : 'Product added'); onSaved(); onClose() } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return <Sheet title={p ? 'Edit product' : 'New product'} onClose={onClose} footer={<button type="button" className="btn" disabled={busy} onClick={save}>{busy ? 'Please wait' : 'Save'}</button>}>
    <div style={{ display: 'grid', gap: 12 }}>
      <button type="button" className="pimg" onClick={() => ref.current.click()}>{f.image_url ? <Img src={f.image_url} w={400} /> : <span><ImagePlus size={26} /> Add photo</span>}</button>
      <input ref={ref} hidden type="file" accept="image/*" onChange={(e) => pick(e.target.files[0])} />
      <Field label="Name"><input className="input" maxLength={80} value={f.name} onChange={set('name')} /></Field>
      <div className="row"><Field label="Price (PHP)"><input className="input" inputMode="decimal" value={f.price_php} onChange={set('price_php')} /></Field>
        <Field label="Points price" hint="Leave empty for cash only"><input className="input" inputMode="numeric" value={f.price_points} onChange={set('price_points')} /></Field></div>
      <Field label="Stock"><input className="input" inputMode="numeric" value={f.stock} onChange={set('stock')} /></Field>
      <div className="row between"><span>Available for sale</span><Toggle on={f.is_available} onChange={(v) => setF({ ...f, is_available: v })} label="Available" /></div>
      {err && <div className="err">{err}</div>}</div></Sheet>
}

function Orders({ m }) {
  const { toast } = useApp(); const { data, loading, error, reload } = useQuery('shoporders:' + m.id, () => shop.shopOrders(m.id))
  usePoll(reload, 8000); useTick(1000)
  const move = async (o, s) => { try { await shop.setStatus(o.id, s); toast(ORDER_LABEL[s]); reload() } catch (e) { toast(errText(e), 'err'); reload() } }
  if (loading) return <Skeletons n={3} C={ProductSkeleton} />
  if (error && !data) return <ErrorBox error={error} retry={reload} />
  if (!data?.length) return <Empty Icon={ReceiptText} title="No orders yet" hint="New orders appear here and you get a notification." />
  return data.map((o) => <div key={o.id} className="card order">
    <div className="row between"><div className="row"><Avatar p={o.customer} size={34} /><div><b>{o.customer?.display_name || 'Customer'}</b><div className="mute small">{dateTime(o.created_at)}</div></div></div><span className={'status s-' + o.status}>{ORDER_LABEL[o.status] || o.status}</span></div>
    <div className="lines">{o.order_items?.map((i) => <div key={i.id} className="row between"><span>{i.quantity} x {i.products?.name || 'Item'}</span><span className="mute">{peso(i.unit_price_php * i.quantity)}</span></div>)}</div>
    <div className="row between"><b>{o.payment_method === 'points' ? `${o.total_amount_points} pts (paid)` : `${peso(o.total_amount_php)} cash`}</b>
      {o.status === 'pending' && <span className="timer"><Clock size={14} /> {countdown(o.expires_at)}</span>}</div>
    {ORDER_FLOW[o.status] && <div className="row wrap">{ORDER_FLOW[o.status].map((s) => <button type="button" key={s} className={'btn sm' + (s === 'cancelled' ? ' ghost' : '')} onClick={() => move(o, s)}>{s === 'cancelled' ? <X size={14} /> : <Check size={14} />} {ORDER_ACTION[s]}</button>)}</div>}
    {!ORDER_FLOW[o.status] && <div className="mute small">This order is locked.</div>}</div>)
}

function Products({ m }) {
  const { toast } = useApp(); const { data, loading, error, reload } = useQuery('myproducts:' + m.id, () => shop.products(m.id, true))
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null)
  return <>
    <button type="button" className="btn" style={{ marginBottom: 10 }} onClick={() => setEdit('new')}><Plus size={17} /> Add product</button>
    {loading ? <Skeletons n={4} C={ListRowSkeleton} /> : error && !data ? <ErrorBox error={error} retry={reload} />
      : !data?.length ? <Empty Icon={Package} title="No products yet" hint="Add what you sell so people can pre-order." />
      : <div className="card flush">{data.map((p) => <div key={p.id} className="row pad">
        {p.image_url ? <Img src={p.image_url} w={120} className="thumb" /> : <span className="chico"><Package size={18} /></span>}
        <div className="grow minw"><b className="ell">{p.name}</b><div className="mute small">{peso(p.price_php)}{p.price_points != null && ` or ${p.price_points} pts`} - {p.stock} in stock{!p.is_available && ' - hidden'}</div></div>
        <button type="button" className="ibtn" aria-label="Edit" onClick={() => setEdit(p)}><Pencil size={18} /></button><button type="button" className="ibtn" aria-label="Delete" onClick={() => setDel(p)}><Trash2 size={18} /></button></div>)}</div>}
    {edit && <ProductForm merchantId={m.id} p={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    {del && <Confirm title="Remove product" text={`Remove "${del.name}"? If it was ordered before, it is hidden instead.`} action="Remove" danger onClose={() => setDel(null)}
      onYes={async () => { try { const r = await shop.removeProduct(del.id); toast(r === 'hidden' ? 'Product hidden (it has past orders)' : 'Product removed'); reload() } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}

function ShopSettings({ m, reload }) {
  const { toast } = useApp(); const [name, setName] = useState(m.shop_name); const [desc, setDesc] = useState(m.description || ''); const [min, setMin] = useState(m.order_expiration_minutes); const [active, setActive] = useState(m.is_active); const [busy, setBusy] = useState(false)
  const del = useQuery('mydel', shop.myDeletionRequest); const openOrders = useQuery('openorders:' + m.id, () => shop.openOrders(m.id)); const [ask, setAsk] = useState(false)
  const save = async () => { setBusy(true); try { await shop.updateMerchant(m.id, { shop_name: name.trim(), description: desc.trim() || null, order_expiration_minutes: min, is_active: active }); toast('Shop saved'); reload() } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  const pending = del.data?.status === 'open'
  return <>
    <div className="card setcard">
      <Field label="Shop name"><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Description"><textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <Field label={`Order expiry for new orders: ${fmtMin(min)}`} hint="Orders already placed keep their own timer."><input type="range" min={5} max={300} step={5} value={min} onChange={(e) => setMin(+e.target.value)} /></Field>
      <div className="row between"><span>Shop is open</span><Toggle on={active} onChange={setActive} label="Shop is open" /></div>
      <button type="button" className="btn" disabled={busy || !name.trim()} onClick={save}>Save</button></div>
    <div className="card setcard dangerzone">
      <div className="row"><ShieldAlert size={20} /><b>Delete shop</b></div>
      <p className="mute small" style={{ margin: 0 }}>An admin has to approve it. Your shop and products are removed from the app once approved.</p>
      {pending ? <div className="notice">Request sent. Waiting for an admin to approve it.</div> : <>
        {del.data?.status === 'dismissed' && <p className="err" style={{ margin: 0 }}>Your last request was declined by an admin.</p>}
        {openOrders.data > 0 && <p className="mute small" style={{ margin: 0 }}>Finish or cancel your {openOrders.data} open order{openOrders.data > 1 ? 's' : ''} first.</p>}
        <button type="button" className="btn danger" disabled={openOrders.loading || openOrders.data > 0} onClick={() => setAsk(true)}>Request shop deletion</button></>}
    </div>
    {ask && <Confirm title="Request shop deletion" text="An admin will review this. You can keep selling until it is approved." action="Send request" danger onClose={() => setAsk(false)}
      onYes={async () => { try { await shop.requestDeletion(m); toast('Request sent to the admins'); del.reload() } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}

export default function Merchant() {
  const nav = useNavigate(); const [tab, setTab] = useState('orders')
  const { data: m, loading, error, reload } = useQuery('mymerchant', shop.myMerchant)
  const del = useQuery('mydel', shop.myDeletionRequest)
  // Shop was closed by an admin-approved deletion request
  const closed = !!m && !m.is_active && del.data?.status === 'resolved'
  return <>
    <div className="page-title"><button type="button" className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Shop Nav</h1></div>
    {loading ? <Skeletons n={3} C={ProductSkeleton} /> : error && !m ? <ErrorBox error={error} retry={reload} />
      : !m || closed ? <>
        {closed && <div className="notice" style={{ marginBottom: 10 }}>An admin approved your request, so "{m.shop_name}" is no longer on Shop Nav. You can open a new shop below.</div>}
        <Register onDone={() => { reload(); del.reload() }} />
      </> : <>
        <div className="mute pad" style={{ paddingTop: 0 }}>{m.shop_name}{!m.is_active && ' (closed)'}</div>
        <Segmented value={tab} onChange={setTab} items={[['orders', 'Orders'], ['products', 'Products'], ['settings', 'Settings']]} />
        {tab === 'orders' ? <Orders m={m} /> : tab === 'products' ? <Products m={m} /> : <ShopSettings m={m} reload={reload} />}</>}
  </>
}