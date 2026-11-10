const DAY = 86400000

export function ago(date: string | Date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d}d`
  return new Date(date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

/** "daqui a 2h 14m", "amanhã 21:00", "sáb 22:30" */
export function until(date: string | Date) {
  const t = new Date(date).getTime()
  const diff = t - Date.now()
  if (diff < 0) return diff > -3 * 3600000 ? 'a decorrer' : 'já foi'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `daqui a ${mins} min`
  if (mins < 6 * 60) return `daqui a ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
  const d = new Date(date)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.floor((d.getTime() - today.getTime()) / DAY)
  const hhmm = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  if (days === 0) return `hoje ${hhmm}`
  if (days === 1) return `amanhã ${hhmm}`
  if (days < 7) return `${d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')} ${hhmm}`
  return `${d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} ${hhmm}`
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 6) return 'Ainda acordado'
  if (h < 13) return 'Bom dia'
  if (h < 20) return 'Boa tarde'
  return 'Boa noite'
}

/** datetime-local value for a Date */
export function toLocalInput(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** next occurrence of hour:min — today if still ahead, else tomorrow */
export function nextAt(hour: number, minute = 0, dayOffset = 0) {
  const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hour, minute, 0, 0)
  if (dayOffset === 0 && d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  return d
}
/** next given weekday (0=Sun … 6=Sat) at hour */
export function nextWeekday(weekday: number, hour = 21) {
  const d = new Date(); const add = (weekday - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + add); d.setHours(hour, 0, 0, 0); return d
}

/** stable colour for an id (posters, lobbies) */
export function colorFor(id: string) {
  const palette = ['lime', 'coral', 'sky', 'pink', 'sun', 'mint']
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return palette[h % palette.length]!
}

/** poster colour by position: plans start coral, then cycle */
export const posterColor = (i: number) => ['coral', 'lime', 'sky', 'pink', 'sun', 'mint'][i % 6]!

export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** local YYYY-MM-DD key for grouping by day */
export const dayKey = (d: Date | string) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

/** "sábado, 14 nov" from a day key */
export const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  const x = new Date(y!, m! - 1, d!)
  const today = dayKey(new Date()); const tomorrow = dayKey(new Date(Date.now() + 86400000))
  if (key === today) return 'Hoje'
  if (key === tomorrow) return 'Amanhã'
  return capFirst(x.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }))
}

/** combine a day key + "HH:MM" into a Date */
export const atDay = (key: string, hhmm: string) => {
  const [y, m, d] = key.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number)
  return new Date(y!, m! - 1, d!, h!, mi!, 0, 0)
}

/** run after the page enter transition, so a sheet doesn't animate on top of a page swap */
export const afterPageEnter = (fn: () => void) => {
  if (typeof window === 'undefined') return fn()
  requestAnimationFrame(() => setTimeout(fn, 180))
}
