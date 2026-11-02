// Skeleton placeholders: shown on first load and on slow networks. No spinners.
export const Bar = ({ w = '100%', h = 12, r }) => <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
const Gap = ({ h = 8 }) => <div style={{ height: h }} />
export const Skeletons = ({ n = 3, C = PostSkeleton }) => Array.from({ length: n }, (_, i) => <C key={i} />)

export const PostSkeleton = () => (
  <div className="card post-sk"><div className="row"><div className="sk round" style={{ width: 44, height: 44 }} />
    <div className="grow"><Bar w="55%" /><Gap /><Bar w="30%" h={9} /></div></div>
    <Gap h={14} /><Bar /><Gap /><Bar w="85%" /><Gap h={12} /><div className="sk" style={{ height: 170, borderRadius: 12 }} />
    <Gap h={12} /><div className="row between"><Bar w="22%" h={14} /><Bar w="22%" h={14} /><Bar w="22%" h={14} /></div></div>
)
export const ChatRowSkeleton = () => (
  <div className="row pad"><div className="sk round" style={{ width: 48, height: 48 }} />
    <div className="grow"><div className="row between"><Bar w="40%" /><Bar w="12%" h={9} /></div><Gap /><Bar w="75%" h={10} /></div></div>
)
export const MessageSkeleton = () => (
  <div style={{ display: 'grid', gap: 12, padding: 16 }}>
    <div className="row"><div className="sk round" style={{ width: 32, height: 32 }} /><div className="sk" style={{ height: 38, width: '55%', borderRadius: 16 }} /></div>
    <div className="row" style={{ justifyContent: 'flex-end' }}><div className="sk" style={{ height: 52, width: '60%', borderRadius: 16 }} /></div>
    <div className="row"><div className="sk round" style={{ width: 32, height: 32 }} /><div className="sk" style={{ height: 38, width: '40%', borderRadius: 16 }} /></div>
  </div>
)
export const CommentSkeleton = () => (
  <div className="row top pad"><div className="sk round" style={{ width: 36, height: 36 }} />
    <div className="grow"><Bar w="35%" h={11} /><Gap /><Bar /><Gap /><Bar w="70%" /></div></div>
)
export const ListRowSkeleton = () => (
  <div className="row pad"><div className="sk" style={{ width: 40, height: 40, borderRadius: 12 }} />
    <div className="grow"><Bar w="50%" /><Gap /><Bar w="30%" h={9} /></div></div>
)
export const ProductSkeleton = () => (
  <div className="card prod"><div className="sk" style={{ height: 110, borderRadius: 12 }} /><Gap /><Bar w="70%" /><Gap /><Bar w="40%" h={10} /><Gap h={10} /><Bar h={34} r={10} /></div>
)
export const PetSkeleton = ProductSkeleton
export const ProfileSkeleton = () => (
  <div><div className="sk" style={{ height: 130, borderRadius: 0 }} />
    <div className="card" style={{ marginTop: -36 }}><div className="sk round" style={{ width: 76, height: 76, border: '4px solid var(--card)' }} />
      <Gap h={12} /><Bar w="45%" h={16} /><Gap /><Bar w="25%" h={10} /><Gap h={14} /><Bar h={10} /></div></div>
)
export const BannerSkeleton = () => <div className="sk" style={{ height: 150, margin: '0 12px 8px', borderRadius: 16 }} />
export const NotifSkeleton = ListRowSkeleton
