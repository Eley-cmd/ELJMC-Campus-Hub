import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Sun, Moon, Monitor, Bell, Volume2, Vibrate, Contact, LogOut, BadgeCheck, Clock, CircleDot, Download } from 'lucide-react'
import { profile } from '../api'
import { useQuery } from '../ui/hooks'
import { useApp } from '../app/context'
import { getTheme, saveTheme } from '../lib/theme'
import { prefs } from '../lib/alerts'
import { TERMS_VERSION } from '../config'
import { errText } from '../lib/errors'
import { Section, Toggle, Field } from '../components/ui'
import { Bar as SkBar } from '../ui/Skeleton'

export default function Settings() {
  const nav = useNavigate(); const { me, reloadMe, toast, signOut } = useApp()
  const [mode, setMode] = useState(getTheme()); const [pref, setPref] = useState(() => localStorage.getItem('eljmc.status') || 'online')
  const [sound, setSound] = useState(prefs.sound()); const [vib, setVib] = useState(prefs.vibrate())
  const priv = useQuery('private', profile.private); const [sid, setSid] = useState(''); const [busy, setBusy] = useState(false)
  const [install, setInstall] = useState(null)
  useEffect(() => { const h = (e) => { e.preventDefault(); setInstall(e) }; addEventListener('beforeinstallprompt', h); return () => removeEventListener('beforeinstallprompt', h) }, [])

  const theme = (m) => {
    setMode(m); saveTheme(m)
    if (m !== 'system') profile.update({ theme_setting: m }).catch(() => {}) // best effort: syncs the choice to the account
  }
  const status = async (s) => {
    setPref(s); try { localStorage.setItem('eljmc.status', s) } catch { /* ignore */ }
    try { await profile.update({ active_status: s }); reloadMe() } catch (e) { toast(errText(e), 'err') }
  }
  const submitId = async () => {
    if (!sid.trim()) return; setBusy(true)
    try { await profile.requestVerification(sid.trim()); setSid(''); toast('Sent. An admin will verify your ID.'); priv.reload() } catch (e) { toast(errText(e), 'err') } finally { setBusy(false) }
  }
  const p = priv.data
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Settings</h1></div>

    <Section title="Appearance"><div className="card setcard">
      <div className="seg">{[['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'Auto']].map(([k, I, l]) =>
        <button key={k} className={mode === k ? 'on' : ''} onClick={() => theme(k)}><I size={15} /> {l}</button>)}</div>
    </div></Section>

    <Section title="Active status"><div className="card setcard">
      <div className="small mute">Offline hides when you were last active. Others see "Active 5m ago" when you are not using the app.</div>
      <div className="seg">{[['online', 'Online'], ['away', 'Away'], ['offline', 'Offline']].map(([k, l]) =>
        <button key={k} className={pref === k ? 'on' : ''} onClick={() => status(k)}><CircleDot size={14} /> {l}</button>)}</div></div></Section>

    <Section title="Notifications"><div className="card setcard">
      <div className="row between"><span className="row"><Volume2 size={18} /> Sound for new alerts</span><Toggle on={sound} onChange={(v) => { setSound(v); prefs.set('sound', v) }} label="Sound" /></div>
      <div className="row between"><span className="row"><Vibrate size={18} /> Vibration (Android)</span><Toggle on={vib} onChange={(v) => { setVib(v); prefs.set('vibrate', v) }} label="Vibration" /></div></div></Section>

    <Section title="Student ID"><div className="card setcard">
      {priv.loading ? <SkBar h={16} /> : <>
        <div className="row"><Contact size={18} /><div className="grow"><b>{p?.student_id_number || 'Not added yet'}</b>
          <div className="small mute">{p?.id_verified_at ? <span className="okc"><BadgeCheck size={14} /> Verified by an admin</span> : p?.student_id_number ? <span className="row tight"><Clock size={14} /> Waiting for admin verification</span> : 'Add your ID to get a verified badge and Student ID login.'}</div></div></div>
        <Field label={p?.student_id_number ? 'Change Student ID (needs verification again)' : 'Student ID'}><div className="row"><input className="input" maxLength={32} value={sid} onChange={(e) => setSid(e.target.value)} placeholder="e.g. 2026-00123" /><button className="btn sm" disabled={busy || !sid.trim()} onClick={submitId}>Submit</button></div></Field>
        <div className="small mute">Signed in as {p?.email}</div></>}
    </div></Section>

    <Section title="About"><div className="card setcard">
      {install && <button className="btn ghost" onClick={() => { install.prompt(); setInstall(null) }}><Download size={17} /> Install app</button>}
      <div className="small mute">ELJMC Campus Hub. Terms version {TERMS_VERSION}.</div>
      <button className="btn danger" onClick={signOut}><LogOut size={17} /> Log out</button></div></Section>
  </>
}