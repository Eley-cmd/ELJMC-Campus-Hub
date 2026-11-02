// Calendar export, fully client-side
const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
export function googleCalendarUrl(title, start) {
  const end = new Date(new Date(start).getTime() + 3600e3)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(start)}/${f(end)}`
}
export function downloadIcs(title, start) {
  const end = new Date(new Date(start).getTime() + 3600e3)
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ELJMC Campus Hub//EN', 'BEGIN:VEVENT', `UID:${f(start)}-${Math.random().toString(36).slice(2)}@eljmc`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${title.replace(/\n/g, ' ').slice(0, 120)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = 'event.ics'; a.click(); URL.revokeObjectURL(a.href)
}
