import { useRef, useState } from 'react'
import { Camera, Contact, ArrowRight } from 'lucide-react'
import { profile } from '../api'
import { uploadImage } from '../lib/cloudinary'
import { errText } from '../lib/errors'
import { Avatar, Field } from '../components/ui'
import { useApp } from '../app/context'

// First run: name, username, photo, optional Student ID (an admin verifies it later)
export default function Onboarding({ done }) {
  const { me, reloadMe, toast } = useApp()
  const [name, setName] = useState(me.display_name || ''); const [user, setUser] = useState(me.username || '')
  const [sid, setSid] = useState(''); const [avatar, setAvatar] = useState(me.avatar_url || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const fileRef = useRef()
  const pick = async (f) => { if (!f) return; setBusy(true); try { setAvatar(await uploadImage(f, 600)) } catch (e) { setErr(errText(e)) } finally { setBusy(false) } }
  const save = async () => {
    setErr('')
    if (!name.trim()) return setErr('Enter your name.')
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(user)) return setErr('Username: 3 to 24 letters, numbers or underscores.')
    setBusy(true)
    try {
      if (user.trim().toLowerCase() !== me.username.toLowerCase() && await profile.usernameTaken(user.trim())) throw new Error('That username is taken.')
      await profile.update({ display_name: name.trim(), username: user.trim(), avatar_url: avatar || null })
      if (sid.trim()) await profile.requestVerification(sid.trim())
      await reloadMe(); toast('Profile ready'); done()
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return <div className="auth">
    <h1>Set up your profile</h1><p className="mute center">This is how classmates will see you.</p>
    <div className="center"><button className="avpick" onClick={() => fileRef.current.click()} aria-label="Choose photo">
      <Avatar p={{ display_name: name || '?', avatar_url: avatar }} size={96} /><span className="avcam"><Camera size={16} /></span></button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => pick(e.target.files[0])} /></div>
    <Field label="Display name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Username" hint="Letters, numbers and underscores."><input className="input" autoCapitalize="none" value={user} onChange={(e) => setUser(e.target.value)} /></Field>
    <Field label="Student ID (optional)" hint="An admin verifies it, then you get the verified badge and Student ID login."><div className="inp"><Contact size={18} /><input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="e.g. 2026-00123" /></div></Field>
    {err && <div className="err" role="alert">{err}</div>}
    <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving' : 'Continue'} <ArrowRight size={18} /></button>
    <button className="link center" onClick={done}>Skip for now</button>
  </div>
}
