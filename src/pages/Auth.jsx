import { useEffect, useRef, useState } from 'react'
import { Chrome, Facebook, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { auth } from '../api'
import { errText } from '../lib/errors'
import { LOGO, TAGLINE } from '../config'

const REMEMBER_KEY = 'eljmc.rememberId'
const savedId = () => { try { return localStorage.getItem(REMEMBER_KEY) || '' } catch { return '' } }

// "ELJMC Hub" sits under the picture, not on top of it. Your logo shows beside it only if /assets/eljmc-logo.png really exists.
function BrandLine() {
  const [ok, setOk] = useState(false)
  useEffect(() => { const i = new Image(); i.onload = () => setOk(true); i.src = LOGO }, [])
  return <div className="au-brandline">{ok && <img src={LOGO} alt="" width={30} height={30} style={{ objectFit: 'contain' }} />}<span>ELJMC Hub</span></div>
}

// Social button picture: /public/assets/google.png and /public/assets/facebook.png, with an icon if the file is missing
function SocialIcon({ src, Fallback }) {
  const [bad, setBad] = useState(false)
  return bad ? <Fallback size={22} /> : <img src={src} alt="" width={26} height={26} style={{ objectFit: 'contain' }} onError={() => setBad(true)} />
}

// Violet header with the book.png picture behind it and a wave at the bottom
function Head({ size = 'mid', back }) {
  return <div className={'au-head ' + size}>
    <img className="au-img" src="/assets/book.png" alt="" draggable="false" onError={(e) => { e.currentTarget.style.display = 'none' }} />
    {back && <button type="button" className="au-back" onClick={back} aria-label="Back"><ArrowLeft size={22} /></button>}
    <svg className="au-wave" viewBox="0 0 480 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="w1" d="M0 58 C 80 22 160 26 250 60 S 410 88 480 42 L480 100 L0 100 Z" />
      <path className="w2" d="M0 66 C 90 30 170 36 260 68 S 400 84 480 56 L480 100 L0 100 Z" />
    </svg>
  </div>
}

const RANK = { welcome: 0, login: 1, signup: 2, forgot: 2, confirm: 3 }

const Pill = ({ children }) => <div className="au-field">{children}</div>

// Screens follow the MOFINOW mockup: welcome, login, create account
export default function Auth() {
  const [step, setStep] = useState('welcome') // welcome | login | signup | forgot | confirm
  const dir = useRef('fwd') // which way the screen slides: forward (next) or back
  const go = (next) => { dir.current = (RANK[next] ?? 0) >= (RANK[step] ?? 0) ? 'fwd' : 'back'; setStep(next) }
  const [f, setF] = useState(() => ({ id: savedId(), pw: '', user: '', name: '' }))
  const [remember, setRemember] = useState(() => !!savedId())
  const [show, setShow] = useState(false)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [info, setInfo] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { setErr(''); setInfo('') }, [step])

  const run = async (fn) => { setBusy(true); setErr(''); try { await fn() } catch (e) { setErr(errText(e)) } finally { setBusy(false) } }
  const login = () => run(async () => {
    if (!f.id.trim() || !f.pw) throw new Error('Enter your email or Student ID and your password.')
    if (f.id.includes('@')) await auth.email(f.id.trim(), f.pw); else await auth.studentId(f.id.trim(), f.pw)
    // Remember me keeps only your email / Student ID (never the password)
    try { if (remember) localStorage.setItem(REMEMBER_KEY, f.id.trim()); else localStorage.removeItem(REMEMBER_KEY) } catch { /* ignore */ }
  })
  const signup = () => run(async () => {
    if (!f.name.trim()) throw new Error('Enter your full name.')
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(f.user)) throw new Error('Username: 3 to 24 letters, numbers or underscores.')
    if (!/^\S+@\S+\.\S+$/.test(f.id)) throw new Error('Enter a valid email address.')
    if (f.pw.length < 6) throw new Error('Password must be at least 6 characters.')
    const r = await auth.signUp(f.id.trim(), f.pw, f.user.trim(), f.name.trim())
    try { localStorage.setItem('eljmc.wantedUsername', JSON.stringify({ email: f.id.trim().toLowerCase(), username: f.user.trim() })) } catch { /* ignore */ }
    if (r.needsConfirm) go('confirm')
  })
  const forgot = () => run(async () => { if (!/^\S+@\S+\.\S+$/.test(f.id)) throw new Error('Enter your email address.'); await auth.forgot(f.id.trim()); setInfo('Check your email for the reset link.') })

  const Social = <>
    <div className="au-or"><span>OR</span></div>
    <div className="au-social">
      <button type="button" className="au-circle" disabled={busy} aria-label="Continue with Google" onClick={() => run(auth.google)}><SocialIcon src="/assets/google.png" Fallback={Chrome} /></button>
      <button type="button" className="au-circle" disabled={busy} aria-label="Continue with Facebook" onClick={() => run(auth.facebook)}><SocialIcon src="/assets/facebook.png" Fallback={Facebook} /></button>
    </div>
    <p className="au-cap">Sign in with another account</p></>

  /* ------------------------------ welcome ------------------------------ */
  if (step === 'welcome') return <div className="au"><Head size="tall" />
    <div key={step} className={'au-body ' + (dir.current === 'fwd' ? 'in-fwd' : 'in-back')}>
      <BrandLine />
      <h1 className="au-title">Welcome !</h1>
      <p className="au-sub">{TAGLINE}</p>
      <button type="button" className="au-btn" onClick={() => go('signup')}>Create Account</button>
      <button type="button" className="au-btn ghost" onClick={() => go('login')}>Login</button>
      <div className="au-social small">
        <button type="button" className="au-circle sm" disabled={busy} aria-label="Continue with Google" onClick={() => run(auth.google)}><SocialIcon src="/assets/google.png" Fallback={Chrome} /></button>
        <button type="button" className="au-circle sm" disabled={busy} aria-label="Continue with Facebook" onClick={() => run(auth.facebook)}><SocialIcon src="/assets/facebook.png" Fallback={Facebook} /></button>
      </div>
      <p className="au-cap">Sign in with another account</p>
      {err && <div className="err center" role="alert">{err}</div>}
    </div></div>

  /* ------------------------------ confirm email ------------------------------ */
  if (step === 'confirm') return <div className="au"><Head size="short" />
    <div key={step} className={'au-body ' + (dir.current === 'fwd' ? 'in-fwd' : 'in-back')}>
      <BrandLine />
      <h1 className="au-title">Check your email</h1>
      <p className="au-sub">We sent a confirmation link to <b>{f.id}</b>. Open it, then come back and log in.</p>
      <button type="button" className="au-btn" onClick={() => go('login')}>Back to log in</button>
    </div></div>

  /* ------------------------------ login / signup / forgot ------------------------------ */
  const isLogin = step === 'login', isSignup = step === 'signup'
  // Back goes to the Welcome screen from Login and Create account. Only "Reset password" goes back to Login.
  return <div className="au"><Head size={isSignup ? 'short' : 'mid'} back={() => go(step === 'forgot' ? 'login' : 'welcome')} />
    <div key={step} className={'au-body ' + (dir.current === 'fwd' ? 'in-fwd' : 'in-back') + (isSignup ? ' signup' : '')}>
      <BrandLine />
      <h1 className="au-title">{isLogin ? 'Welcome back !' : isSignup ? 'Create your account' : 'Reset password'}</h1>
      <p className="au-sub">{isLogin ? 'Log in to continue to your account' : isSignup ? 'Get started in a few steps' : 'We will email you a reset link'}</p>

      {isSignup && <>
        <Pill><input placeholder="Full name" autoComplete="name" value={f.name} onChange={set('name')} /></Pill>
        <Pill><input placeholder="Username" autoCapitalize="none" autoComplete="username" value={f.user} onChange={set('user')} /></Pill></>}
      <Pill><input placeholder={isLogin ? 'Email or Student ID' : 'Email'} autoCapitalize="none" autoComplete={isLogin ? 'username' : 'email'} value={f.id} onChange={set('id')}
        onKeyDown={(e) => e.key === 'Enter' && step === 'forgot' && forgot()} /></Pill>
      {step !== 'forgot' && <Pill>
        <input type={show ? 'text' : 'password'} placeholder="Password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={f.pw} onChange={set('pw')}
          onKeyDown={(e) => e.key === 'Enter' && (isLogin ? login() : signup())} />
        <button type="button" className="au-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button></Pill>}

      {isLogin && <div className="au-row">
        <label className="au-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Remember me</span></label>
        <button type="button" className="au-forgot" onClick={() => go('forgot')}>Forget password?</button></div>}

      {err && <div className="err center" role="alert">{err}</div>}{info && <div className="okmsg center">{info}</div>}

      <button type="button" className={'au-btn' + (isLogin ? ' ghost' : '')} disabled={busy} onClick={isLogin ? login : isSignup ? signup : forgot}>
        {busy ? 'Please wait' : isLogin ? 'Login' : isSignup ? 'Create account' : 'Send reset link'}</button>

      {isLogin ? <p className="au-new">New user? <button type="button" className="au-link" onClick={() => go('signup')}>Sign Up</button></p>
        : <p className="au-new">Already have an account? <button type="button" className="au-link" onClick={() => go('login')}>Log In</button></p>}

      {step !== 'forgot' && Social}
      {isLogin && <p className="au-hint">Student ID login works once an admin has verified your ID.</p>}
    </div></div>
}