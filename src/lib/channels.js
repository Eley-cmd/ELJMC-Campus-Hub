import { BookOpen, CalendarDays, GraduationCap, ShieldAlert, Car, MessagesSquare, Hash } from 'lucide-react'
import { titleCase } from './format'
// channels.category is free text in the database; map known words to a label and icon
export function categoryMeta(cat = '') {
  const c = cat.toLowerCase()
  if (/academ/.test(c)) return { label: 'Academics', Icon: BookOpen }
  if (/event/.test(c)) return { label: 'ELJMC Events', Icon: CalendarDays }
  if (/course|prof/.test(c)) return { label: 'Course and Professor Hub', Icon: GraduationCap }
  if (/safe|emerg/.test(c)) return { label: 'Campus Safety', Icon: ShieldAlert }
  if (/ride|commute|transit/.test(c)) return { label: 'Ride and Commute', Icon: Car }
  if (/general|chat/.test(c)) return { label: 'General', Icon: MessagesSquare }
  return { label: titleCase(cat) || 'Other', Icon: Hash }
}
