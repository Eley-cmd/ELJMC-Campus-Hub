import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ScrollText, Megaphone, Heart, MessageCircle } from 'lucide-react'
import { feed } from '../api'
import { BANNERS, RULES } from '../config'
import { useQuery } from '../ui/hooks'
import { BannerSkeleton } from '../ui/Skeleton'

// Freedom-wall header: auto-swaps the top trending posts, then the campus rules, in a loop
export default function Banner() {
  const nav = useNavigate()
  const { data, loading } = useQuery('banner', feed.banner)
  const [i, setI] = useState(0); const [paused, setPaused] = useState(false)
  const slides = [...(data || []).map((p) => ({ type: 'post', p })), { type: 'rules' }]
  useEffect(() => { if (paused || slides.length < 2) return; const t = setInterval(() => setI((x) => (x + 1) % slides.length), 5200); return () => clearInterval(t) }, [paused, slides.length])
  if (loading) return <BannerSkeleton />
  const s = slides[i % slides.length]
  return <div className="banner" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
    <div className="banner-bg" style={{ backgroundImage: `url(${BANNERS[i % BANNERS.length]})` }} />
    <div className="banner-shade" />
    <div className="banner-body" key={i}>
      {s.type === 'post' ? <button className="banner-post" onClick={() => nav(`/post/${s.p.id}`)}>
        <span className="chip-lite"><Flame size={14} /> Trending #{i + 1}</span>
        <p>{(s.p.content || 'Photo post').slice(0, 120)}</p>
        <span className="row tight small"><Heart size={13} /> {s.p.likes} <MessageCircle size={13} style={{ marginLeft: 8 }} /> {s.p.commentCount}</span></button>
        : <div className="banner-post"><span className="chip-lite"><ScrollText size={14} /> Campus rules</span>
          <ul>{RULES.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul></div>}
    </div>
    <div className="dots">{slides.map((_, k) => <button key={k} aria-label={`Slide ${k + 1}`} className={k === i % slides.length ? 'on' : ''} onClick={() => setI(k)} />)}</div>
  </div>
}
