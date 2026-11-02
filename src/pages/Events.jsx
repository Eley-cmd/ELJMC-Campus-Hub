import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { PageTitle, Segmented, Empty } from '../components/ui'
import Composer from '../components/Composer'
import FeedList from '../components/FeedList'
import { useBoards } from './Home'

export default function Events() {
  const boards = useBoards(); const [tab, setTab] = useState('up'); const [rev, setRev] = useState(0)
  return <>
    <PageTitle>ELJMC Events</PageTitle>
    <Segmented value={tab} onChange={setTab} items={[['up', 'Upcoming'], ['past', 'Past']]} />
    <FeedList rev={rev} events past={tab === 'past'} boards={boards.map}
      top={tab === 'up' && <Composer boards={boards.list} startEvent onPosted={() => setRev((r) => r + 1)} />}
      empty={<Empty Icon={CalendarDays} title={tab === 'up' ? 'No upcoming events' : 'No past events'} hint={tab === 'up' ? 'Post an event and let people RSVP.' : undefined} />} />
  </>
}
