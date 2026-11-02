import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Home as House, Hash, MessageCircle, ShoppingBag, UserRound, Bell, Coins, WifiOff, Ban, CalendarDays, Ghost, QrCode, PawPrint, ReceiptText, Store, Shield, Settings as Gear, GraduationCap } from 'lucide-react'
import { auth } from './api'
import { AppProvider, useApp } from './app/context'
import { useOnline } from './ui/hooks'
import { PostSkeleton } from './ui/Skeleton'
import { LOGO } from './config'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import PostPage from './pages/PostPage'
import Channels, { ChannelPage } from './pages/Channels'
import Events from './pages/Events'
import { Thread, ChatsPage } from './pages/Chats'
import { MyProfile, UserProfile } from './pages/Profile'
import Notifications from './pages/Notifications'
import Shop, { ShopPage, Orders } from './pages/Shop'
import Pets from './pages/Pets'
import { ProductPage, CartPage } from './pages/Product'
const Settings = lazy(() => import('./pages/Settings'))
const Friends = lazy(() => import('./pages/Friends'))
const Anonymous = lazy(() => import('./pages/Anonymous'))
const Merchant = lazy(() => import('./pages/Merchant'))
const Admin = lazy(() => import('./pages/Admin'))

const MAIN = [['/', House, 'Home', true], ['/channels', Hash, 'Channels'], ['/chat', MessageCircle, 'Chat'], ['/shop', ShoppingBag, 'Shop'], ['/profile', UserRound, 'Profile']]
const MORE = [['/events', CalendarDays, 'Events'], ['/anonymous', Ghost, 'Anonymous chat'], ['/friends', QrCode, 'Friends and QR'], ['/pets', PawPrint, 'Pets and points'], ['/orders', ReceiptText, 'My orders'], ['/merchant', Store, 'My shop'], ['/settings', Gear, 'Settings']]

function Brand() {
  const [bad, setBad] = useState(false)
  return <Link to="/" className="brand">{bad ? <span className="brand-ico"><GraduationCap size={20} /></span> : <img src={"public/assets/logo.png"} alt="" onError={() => setBad(true)} />}<b>ELJMC Hub</b></Link>
}

function Shell() {
  const { me, unread, isAdmin, suspension } = useApp(); const online = useOnline(); const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <div className="shell">
    <aside className="side"><Brand />
      <nav>{MAIN.concat(MORE, isAdmin ? [['/admin', Shield, 'Admin']] : []).map(([to, I, l, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'on' : '')}><I size={20} /> {l}</NavLink>)}</nav></aside>
    <div className="main">
      <header className="topbar"><div className="mobile-brand"><Brand /></div><div className="grow" />
        <Link to="/pets" className="ptschip" aria-label="Points"><Coins size={16} /> {me ? me.points_balance : <span className="sk" style={{ width: 28, height: 12, display: 'inline-block' }} />}</Link>
        <Link to="/notifications" className="ibtn bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell size={22} />{unread > 0 && <i className="bellcount">{unread > 99 ? '99+' : unread}</i>}</Link></header>
      {!online && <div className="banner-top warn"><WifiOff size={15} /> No connection. Showing what loaded so far.</div>}
      {suspension && <div className="banner-top bad"><Ban size={15} /> Your account is suspended{suspension.expires_at ? ` until ${new Date(suspension.expires_at).toLocaleDateString()}` : ''}. You can read, but not post. Reason: {suspension.reason}</div>}
      <main className="page">
        <Suspense fallback={<PostSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/post/:id" element={<PostPage />} />
            <Route path="/channels" element={<Channels />} /><Route path="/channel/:id" element={<ChannelPage />} />
            <Route path="/events" element={<Events />} />
            <Route path="/chat" element={<ChatsPage />} /><Route path="/chat/:id" element={<Thread />} />
            <Route path="/anonymous" element={<Anonymous />} />
            <Route path="/product/:id" element={<ProductPage />} /><Route path="/cart" element={<CartPage />} />
            <Route path="/shop" element={<Shop />} /><Route path="/shop/:id" element={<ShopPage />} />
            <Route path="/orders" element={<Orders />} /><Route path="/merchant" element={<Merchant />} />
            <Route path="/pets" element={<Pets />} /><Route path="/points" element={<Navigate to="/pets" replace />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<MyProfile />} /><Route path="/profile/:username" element={<UserProfile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="bottomnav">{MAIN.map(([to, I, l, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'on' : '')}><I size={22} /><span>{l}</span></NavLink>)}</nav>
    </div></div>
}

function Gate() {
  const { me, session } = useApp()
  const key = 'eljmc.onboarded.' + session.user.id
  const [done, setDone] = useState(!!localStorage.getItem(key))
  if (!done && me && !me.avatar_url && Date.now() - new Date(me.created_at) < 864e5) return <Onboarding done={() => { localStorage.setItem(key, '1'); setDone(true) }} />
  return <Shell />
}

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => { auth.session().then(setSession).catch(() => setSession(null)); const s = auth.onChange(setSession); return () => s.unsubscribe() }, [])
  if (session === undefined) return <div className="auth splash"><div className="sk round" style={{ width: 84, height: 84 }} /></div>
  if (!session) return <Auth />
  return <AppProvider session={session} key={session.user.id}><Gate /></AppProvider>
}
