// App-wide constants. Everything here mirrors a rule that already exists in the database.
import { Heart } from 'lucide-react'

export const TERMS_VERSION = import.meta.env.VITE_TERMS_VERSION || '2026-01'

// Posts have one reaction: the heart. It is stored as 'love' (older rows or a database that only accepts 'like' fall back to 'like').
export const REACTIONS = [{ key: 'love', label: 'Love', Icon: Heart, color: '#e5484d' }]
export const reactionOf = () => REACTIONS[0]

// Requests that need an admin. They are filed as reports (no database change) and shown in their own Admin tabs.
export const VERIFY_REASON = 'Student ID verification request'
export const SHOP_DELETE_REASON = 'Shop deletion request'

export const ROLE_LABEL = { student: 'Student', teacher: 'Teacher', faculty: 'Faculty Staff', admin: 'Admin' }
export const ROLES = ['student', 'teacher', 'faculty', 'admin']

// Order statuses (same flow the trigger enforces)
export const ORDER_FLOW = { pending: ['confirmed', 'cancelled'], confirmed: ['ready_for_pickup', 'cancelled'], ready_for_pickup: ['completed', 'cancelled'] }
export const ORDER_LABEL = { pending: 'Pending', confirmed: 'Confirmed', ready_for_pickup: 'Ready for pickup', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' }
export const ORDER_ACTION = { confirmed: 'Confirm', ready_for_pickup: 'Mark ready', completed: 'Complete', cancelled: 'Cancel order' }

export const REPORT_REASONS = ['Spam', 'Harassment or bullying', 'Inappropriate content', 'Misinformation', 'Safety concern', 'Other']

export const ACCENTS = ['#1677ff', '#0ea5a4', '#7c3aed', '#e11d48', '#ea580c', '#16a34a']

// Pictures: put your own files in /public. Missing files fall back to gradients and icons.
export const LOGO = '/assets/eljmc-logo.png'
export const BANNERS = ['/assets/eljmc-banner-1.jpg', '/assets/eljmc-banner-2.jpg', '/assets/eljmc-banner-3.jpg']
export const COVER = '/assets/eljmc-cover.jpg'
export const TAGLINE = 'Discover. Attend. Make Memories.'

export const RULES = [
  'Be respectful. No bullying, hate or harassment.',
  'Anonymous posts are still traceable by moderators.',
  'No spam, scams or selling outside Shop Nav.',
  'Report anything unsafe. It helps everyone on campus.',
]

// Who can delete a post? Admins always can. Set this to true if authors may also delete their OWN posts.
// Everyone else can only Hide a post (for themselves) or Report it.
export const ALLOW_AUTHOR_DELETE = false