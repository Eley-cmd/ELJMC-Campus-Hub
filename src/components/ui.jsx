import { useEffect, useState } from 'react'
import { BadgeCheck, Ghost, RefreshCw, WifiOff, X, PawPrint, ImageOff, Inbox } from 'lucide-react'
import { img } from '../lib/cloudinary'
import { slug } from '../lib/format'
import { ROLE_LABEL } from '../config'

export function Avatar({ p, size = 44, anonymous, dot }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [p?.avatar_url])
  const st = { width: size, height: size, fontSize: size * 0.4 }
  let inner
  if (anonymous || (!p)) inner = <div className="av anon" style={st}><Ghost size={size * 0.5} /></div>
  else if (p.avatar_url && !bad) inner = <img className="av" style={st} src={img(p.avatar_url, Math.max(120, size * 2))} alt="" onError={() => setBad(true)} loading="lazy" />
  else inner = <div className="av" style={st}>{(p.display_name || p.username || '?')[0].toUpperCase()}</div>
  const status = p?.active_status
  return <span className="avwrap">{inner}{dot && status && status !== 'offline' && <i className={'presence ' + status} />}</span>
}

export const Name = ({ p, anonymous }) => (
  <b className="name">{anonymous || !p ? 'Anonymous' : p.display_name}
    {p?.verified_badge && !anonymous && <BadgeCheck size={15} className="vbadge" aria-label="Verified" />}</b>
)
export const RoleTag = ({ p }) => (p && p.role && p.role !== 'student' ? <span className="tag">{ROLE_LABEL[p.role] || p.role}</span> : null)

// Image with a skeleton until it loads, and a clean fallback when it fails
export function Img({ src, w = 800, alt = '', className = '', style, onClick }) {
  const [st, set] = useState('load')
  useEffect(() => set('load'), [src])
  return <div className={'imgbox ' + className} style={style} onClick={onClick}>
    {st === 'load' && <div className="sk fill" />}
    {st === 'bad' ? <div className="imgbad"><ImageOff size={22} /></div>
      : <img src={img(src, w)} alt={alt} loading="lazy" onLoad={() => set('ok')} onError={() => set('bad')} style={{ opacity: st === 'ok' ? 1 : 0 }} />}
  </div>
}

// Pet picture: /pets/<name>.png first (your files), then the database image_url, then an icon
export function PetImg({ p, size = 96 }) {
  const srcs = [`/pets/${slug(p.name)}.png`, `/pets/${slug(p.name)}.webp`, `/pets/${slug(p.name)}.jpg`, p.image_url].filter(Boolean)
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [p.name])
  if (i >= srcs.length) return <div className="av pet-fallback" style={{ width: size, height: size, borderRadius: 18 }}><PawPrint size={size * 0.45} /></div>
  return <img src={srcs[i]} alt={p.name} onError={() => setI(i + 1)} style={{ width: size, height: size, objectFit: 'contain' }} />
}

export function ErrorBox({ error, retry, compact }) {
  const net = /network|connection/i.test(error?.message || '')
  return <div className={'errbox' + (compact ? ' compact' : '')}>
    {net ? <WifiOff size={20} /> : null}
    <div>{error?.message || 'Could not load.'}</div>
    {retry && <button className="btn sm ghost" onClick={retry}><RefreshCw size={14} /> Retry</button>}
  </div>
}
export const Empty = ({ Icon = Inbox, title, hint, children }) => (
  <div className="empty"><Icon size={34} /><b>{title}</b>{hint && <div className="mute">{hint}</div>}{children}</div>
)

export function Sheet({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-h"><b>{title}</b><button className="ibtn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <div className="sheet-b">{children}</div>
      {footer && <div className="sheet-f">{footer}</div>}
    </div></div>
}

export const Toggle = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></button>
)
export const Section = ({ title, children, action }) => (
  <div className="section"><div className="section-h"><b>{title}</b>{action}</div>{children}</div>
)
export const Field = ({ label, hint, children }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small className="mute">{hint}</small>}</label>
)
export function Segmented({ value, onChange, items }) {
  return <div className="seg" role="tablist">{items.map(([k, label]) =>
    <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>)}</div>
}
export const PageTitle = ({ children, right, back }) => <div className="page-title">{back}<h1>{children}</h1><div className="grow" />{right}</div>

export function Confirm({ title = 'Are you sure?', text, action = 'Confirm', danger, onYes, onClose }) {
  const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); try { await onYes() } finally { setBusy(false); onClose() } }
  return <Sheet title={title} onClose={onClose} footer={<>
    <button className="btn ghost" onClick={onClose}>Cancel</button>
    <button className={'btn' + (danger ? ' danger' : '')} disabled={busy} onClick={go}>{busy ? 'Please wait' : action}</button></>}>
    <p style={{ margin: 0 }}>{text}</p></Sheet>
}
