import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, QrCode, ScanLine, RefreshCw, Nfc, CreditCard, UserMinus, MessageCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { friends, profile, chat, scanAndPairRfid } from '../api'
import { useQuery } from '../ui/hooks'
import { Skeletons, ListRowSkeleton, Bar } from '../ui/Skeleton'
import { Avatar, Segmented, Empty, ErrorBox, Sheet, Confirm, Field } from '../components/ui'
import { useApp } from '../app/context'
import { errText } from '../lib/errors'

const PREFIX = 'ELJMC:'

function Scanner({ onHash, onClose }) {
  const [err, setErr] = useState(''); const done = useRef(false)
  useEffect(() => {
    let scanner
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        scanner = new Html5Qrcode('qr-reader')
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, (text) => {
          if (done.current) return; done.current = true
          onHash(text.startsWith(PREFIX) ? text.slice(PREFIX.length) : text.trim())
        }, () => {})
      } catch { setErr('Camera is not available. Allow camera access, or type the code below.') }
    })()
    return () => { try { scanner?.isScanning && scanner.stop().then(() => scanner.clear()) } catch { /* ignore */ } }
  }, []) // eslint-disable-line
  const [manual, setManual] = useState('')
  return <Sheet title="Scan a friend's QR code" onClose={onClose}>
    <div id="qr-reader" className="qr-reader" />
    {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
    <Field label="Or paste a code"><div className="row"><input className="input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="QR code text" />
      <button className="btn sm" disabled={!manual.trim()} onClick={() => onHash(manual.trim().replace(PREFIX, ''))}>Add</button></div></Field>
  </Sheet>
}

export default function Friends() {
  const nav = useNavigate(); const { toast } = useApp()
  const [tab, setTab] = useState('qr'); const [scan, setScan] = useState(false); const [rm, setRm] = useState(null)
  const priv = useQuery('private', profile.private); const fr = useQuery('friends', friends.list)
  const [serial, setSerial] = useState(''); const [busy, setBusy] = useState(false)

  const add = async (hash) => {
    setScan(false)
    try { const r = await friends.addByQr(hash); toast(r.status === 'added' ? 'Friend added' : 'You are already friends'); fr.reload() } catch (e) { toast(errText(e), 'err') }
  }
  const regen = async () => { try { await profile.regenQr(); priv.reload(); toast('New QR code created. The old one no longer works.') } catch (e) { toast(errText(e), 'err') } }
  const pair = async (s) => { setBusy(true); try { await profile.pairRfid(s); setSerial(''); priv.reload(); toast('Card paired') } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  const nfc = async () => { setBusy(true); try { toast('Hold your card near the back of your phone'); await scanAndPairRfid(); priv.reload(); toast('Card paired') } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) } }
  const dm = async (u) => { try { nav(`/chat/${await chat.openDm(u.id)}`) } catch (e) { toast(errText(e), 'err') } }
  const p = priv.data

  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Friends</h1></div>
    <Segmented value={tab} onChange={setTab} items={[['qr', 'My QR'], ['list', `Friends${fr.data ? ` (${fr.data.length})` : ''}`], ['card', 'ID card']]} />

    {tab === 'qr' && <div className="card center qrcard">
      {priv.loading ? <div className="sk" style={{ width: 220, height: 220, margin: '0 auto', borderRadius: 16 }} />
        : priv.error ? <ErrorBox error={priv.error} retry={priv.reload} compact />
        : <div className="qrbox"><QRCodeSVG value={PREFIX + p.qr_code_hash} size={220} level="M" includeMargin /></div>}
      <p className="mute small">Let a friend scan this code to add you instantly.</p>
      <div className="row center-row"><button className="btn" onClick={() => setScan(true)}><ScanLine size={18} /> Scan a code</button>
        <button className="btn ghost" onClick={regen}><RefreshCw size={16} /> New code</button></div></div>}

    {tab === 'list' && (fr.loading ? <div className="card flush"><Skeletons n={5} C={ListRowSkeleton} /></div> : fr.error && !fr.data ? <ErrorBox error={fr.error} retry={fr.reload} />
      : !fr.data?.length ? <Empty Icon={QrCode} title="No friends yet" hint="Scan a classmate's QR code to add them."><button className="btn sm" onClick={() => setScan(true)}>Scan a code</button></Empty>
      : <div className="card flush">{fr.data.map((u) => <div key={u.id} className="row pad">
        <Link to={`/profile/${u.username}`}><Avatar p={u} size={44} dot /></Link>
        <Link to={`/profile/${u.username}`} className="grow"><b>{u.display_name}</b><div className="mute small">@{u.username}</div></Link>
        <button className="ibtn" aria-label="Message" onClick={() => dm(u)}><MessageCircle size={20} /></button>
        <button className="ibtn" aria-label="Remove friend" onClick={() => setRm(u)}><UserMinus size={20} /></button></div>)}</div>)}

    {tab === 'card' && <div className="card setcard">
      <div className="row"><CreditCard size={20} /><div className="grow"><b>RFID / NFC card</b>
        <div className="mute small">{priv.loading ? <Bar w="40%" h={10} /> : p?.rfid_card_serial ? `Paired: ${p.rfid_card_serial.slice(0, 4)}...${p.rfid_card_serial.slice(-3)}` : 'No card paired yet'}</div></div></div>
      {'NDEFReader' in window && <button className="btn" disabled={busy} onClick={nfc}><Nfc size={18} /> Scan with my phone</button>}
      <Field label="USB reader or manual entry" hint="Click the box, then tap your card on a USB reader. It types the serial for you."><div className="row">
        <input className="input" maxLength={64} value={serial} onChange={(e) => setSerial(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && serial.trim() && pair(serial.trim())} placeholder="Card serial" />
        <button className="btn sm" disabled={busy || !serial.trim()} onClick={() => pair(serial.trim())}>Pair</button></div></Field>
      {!('NDEFReader' in window) && <p className="mute small" style={{ margin: 0 }}>Phone card scanning needs Chrome on Android with NFC turned on.</p>}</div>}

    {scan && <Scanner onHash={add} onClose={() => setScan(false)} />}
    {rm && <Confirm title="Remove friend" text={`Remove ${rm.display_name} from your friends?`} action="Remove" danger onClose={() => setRm(null)}
      onYes={async () => { try { await friends.remove(rm.id); fr.reload() } catch (e) { toast(errText(e), 'err') } }} />}
  </>
}
