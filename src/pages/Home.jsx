import { useState } from 'react'
import { Flame } from 'lucide-react'
import { channels } from '../api'
import { useQuery } from '../ui/hooks'
import { PageTitle } from '../components/ui'
import Banner from '../components/Banner'
import Composer from '../components/Composer'
import FeedList from '../components/FeedList'
import { categoryMeta } from '../lib/channels'

export const useBoards = () => {
  const q = useQuery('channels', channels.list)
  const list = q.data || []
  return { list, map: Object.fromEntries(list.map((c) => [c.id, c.name])), ...q }
}

// Home is the feed. Chats live in their own tab in the bottom nav.
export default function Home() {
  const [rev, setRev] = useState(0)
  const boards = useBoards(); const [chId, setCh] = useState(''); const [hot, setHot] = useState(false)
  return <>
    <PageTitle>Community</PageTitle>
    <>
      <Banner />
      <div className="chips" role="tablist" aria-label="Boards">
        <button className={hot ? 'on' : ''} onClick={() => setHot(!hot)}><Flame size={14} /> Hot</button>
        <button className={!chId ? 'on' : ''} onClick={() => setCh('')}>All</button>
        {boards.list.map((c) => <button key={c.id} className={chId === c.id ? 'on' : ''} onClick={() => setCh(c.id)} title={categoryMeta(c.category).label}>{c.name}</button>)}
      </div>
      <FeedList rev={rev} channelId={chId || undefined} hot={hot} boards={boards.map}
        top={!hot && <Composer boards={boards.list} channelId={chId} onPosted={() => setRev((r) => r + 1)} />} />
    </>
  </>
}
