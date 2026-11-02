import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Coins, Check, PawPrint, History, TrendingUp, TrendingDown } from 'lucide-react'
import { points } from '../api'
import { useQuery } from '../ui/hooks'
import { PetSkeleton, Skeletons, ListRowSkeleton } from '../ui/Skeleton'
import { PetImg, Segmented, Empty, ErrorBox } from '../components/ui'
import { useApp } from '../app/context'
import { dateTime } from '../lib/format'
import { errText } from '../lib/errors'

export default function Pets() {
  const nav = useNavigate(); const { me, reloadMe, toast } = useApp(); const [tab, setTab] = useState('pets')
  const all = useQuery('pets', points.pets); const mine = useQuery('mypets', points.myPets); const hist = useQuery('pthist', points.history)
  const [busy, setBusy] = useState('')
  const owned = Object.fromEntries((mine.data || []).map((u) => [u.pet_id, u]))
  const act = async (id, fn, msg) => { setBusy(id); try { await fn(id); toast(msg); await Promise.all([mine.reload(), reloadMe(), hist.reload()]) } catch (e) { toast(errText(e), 'err') } finally { setBusy('') } }
  const bal = me?.points_balance ?? 0
  return <>
    <div className="page-title"><button className="ibtn" onClick={() => nav(-1)} aria-label="Back"><ChevronLeft /></button><h1>Pets and points</h1></div>
    <div className="card row balance"><Coins size={26} /><div><b className="big">{bal}</b><div className="mute small">points to spend</div></div></div>
    <Segmented value={tab} onChange={setTab} items={[['pets', 'Pet shop'], ['hist', 'History']]} />
    {tab === 'pets' ? (all.loading || mine.loading ? <div className="grid2">{Array.from({ length: 4 }, (_, i) => <PetSkeleton key={i} />)}</div>
      : all.error && !all.data ? <ErrorBox error={all.error} retry={all.reload} />
      : !all.data?.length ? <Empty Icon={PawPrint} title="No pets in the shop yet" />
      : <div className="grid2">{all.data.map((p) => { const o = owned[p.id]; const cost = p.store_cost_points
        return <div key={p.id} className={'card pet' + (o?.is_equipped ? ' eq' : '')}><PetImg p={p} size={104} /><b>{p.name}</b>
          <div className="mute small">x{Number(p.point_multiplier)} points on every reward</div>
          {o ? (o.is_equipped ? <button className="btn sm ghost" disabled><Check size={15} /> Equipped</button> : <button className="btn sm" disabled={busy === p.id} onClick={() => act(p.id, points.equipPet, `${p.name} equipped`)}>Equip</button>)
            : <button className="btn sm" disabled={busy === p.id || bal < cost} onClick={() => act(p.id, points.buyPet, `${p.name} is yours`)}><Coins size={15} /> {cost}</button>}
          {!o && bal < cost && <div className="mute small">Need {cost - bal} more</div>}</div> })}</div>)
      : hist.loading ? <div className="card flush"><Skeletons n={6} C={ListRowSkeleton} /></div> : hist.error && !hist.data ? <ErrorBox error={hist.error} retry={hist.reload} />
      : !hist.data?.length ? <Empty Icon={History} title="No point activity yet" hint="Check in daily, post, and get trending to earn points." />
      : <div className="card flush">{hist.data.map((t) => <div key={t.id} className="row pad"><span className={'chico ' + (t.amount > 0 ? 'up' : 'down')}>{t.amount > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span>
        <div className="grow"><b>{t.reason}</b><div className="mute small">{dateTime(t.created_at)}</div></div><b className={t.amount > 0 ? 'okc' : 'dngc'}>{t.amount > 0 ? '+' : ''}{t.amount}</b></div>)}</div>}
  </>
}
