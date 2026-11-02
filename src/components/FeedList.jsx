import { useEffect, useState } from 'react'
import { PenLine } from 'lucide-react'
import { feed, PAGE } from '../api'
import { useQuery, useInView } from '../ui/hooks'
import { Skeletons, PostSkeleton } from '../ui/Skeleton'
import { ErrorBox, Empty } from './ui'
import Post from './Post'

// Cursor-paged feed (infinite scroll). Used by Home, Channel, Events and Profile.
export default function FeedList({ rev, channelId, hot, events, past, authorId, boards, top, empty }) {
  const key = `feed:${channelId || ''}:${hot ? 1 : 0}:${events ? 1 : 0}:${past ? 1 : 0}:${authorId || ''}`
  const first = useQuery(key, () => feed.list({ channelId, hot, events, past, authorId, limit: events ? 30 : undefined }))
  const [extra, setExtra] = useState([]); const [done, setDone] = useState(false); const [more, setMore] = useState(false); const [moreErr, setMoreErr] = useState(null)
  useEffect(() => { setExtra([]); setDone(false); setMoreErr(null) }, [key])
  const posts = [...(first.data || []), ...extra.filter((e) => !(first.data || []).some((f) => f.id === e.id))]
  const hasMore = !hot && !events && !!first.data && first.data.length >= PAGE && !done
  const loadMore = async () => {
    if (more || !posts.length) return; setMore(true); setMoreErr(null)
    try { const r = await feed.list({ channelId, authorId, before: posts[posts.length - 1].created_at }); if (r.length < PAGE) setDone(true); setExtra((x) => [...x, ...r]) }
    catch (e) { setMoreErr(e) } finally { setMore(false) }
  }
  const sentinel = useInView(loadMore, hasMore && !more && !moreErr)
  const reload = () => { setExtra([]); setDone(false); first.reload() }
  useEffect(() => { if (rev) reload() }, [rev]) // eslint-disable-line

  return <>
    {top}
    {first.loading ? <Skeletons n={3} C={PostSkeleton} />
      : first.error && !first.data ? <ErrorBox error={first.error} retry={first.reload} />
      : !posts.length ? (empty || <Empty Icon={PenLine} title="Nothing here yet" hint="Be the first to post." />)
      : <>{posts.map((p) => <Post key={p.id} p={p} boards={boards} onChange={reload} />)}
        {hasMore && <div ref={sentinel}>{more ? <PostSkeleton /> : moreErr ? <ErrorBox compact error={moreErr} retry={loadMore} /> : null}</div>}
        {!hasMore && !hot && posts.length > PAGE && <p className="mute center small">You are all caught up.</p>}</>}
  </>
}
