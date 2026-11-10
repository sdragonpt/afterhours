// Calendar feed for iPhone / Google Calendar.
//   /cal/<token>          → whole community agenda (subscribe with webcal://)
//   /cal/<token>/<event>  → a single plan ("Pôr na agenda")
// The token is the community's secret calendar_token; the data comes from the
// calendar_feed() RPC, callable with the public (anon) key.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DURATION_MS = 3 * 60 * 60 * 1000 // plans are open-ended; assume 3h

const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** fold lines to 75 octets as RFC 5545 requires */
const fold = (line) => {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const out = []; let i = 0
  while (i < bytes.length) {
    let end = Math.min(i + (out.length ? 74 : 75), bytes.length)
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end-- // don't split a UTF-8 char
    out.push((out.length ? ' ' : '') + bytes.subarray(i, end).toString('utf8'))
    i = end
  }
  return out.join('\r\n')
}

export default async (req, context) => {
  const { token, event } = context.params || {}
  if (!token || !UUID.test(token) || (event && !UUID.test(event))) return new Response('Not found', { status: 404 })

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY
  if (!url || !key) return new Response('Calendar not configured', { status: 500 })

  const res = await fetch(`${url}/rest/v1/rpc/calendar_feed`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_event: event || null }),
  })
  if (!res.ok) return new Response('Calendar unavailable', { status: 502 })
  const all = await res.json()
  // the RPC returns one row with null id when the community has no plans (keeps the group name)
  const rows = all.filter((r) => r.id)
  if (event && !rows.length) return new Response('Not found', { status: 404 })

  const site = (process.env.URL || new URL(req.url).origin).replace(/\/$/, '')
  const group = all[0]?.group_name || 'Afterhours'
  const now = stamp(Date.now())
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Afterhours//Planos//PT', 'CALSCALE:GREGORIAN',
    event ? 'METHOD:PUBLISH' : 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(event ? rows[0].title : `Afterhours · ${group}`)}`,
    'X-WR-TIMEZONE:Europe/Lisbon',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ]
  for (const e of rows) {
    const start = new Date(e.starts_at)
    const desc = [e.description, `Responde no Afterhours: ${site}/plans`].filter(Boolean).join('\n\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@afterhours`,
      `DTSTAMP:${now}`,
      `CREATED:${stamp(e.created_at)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(start.getTime() + DURATION_MS)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      `DESCRIPTION:${esc(desc)}`,
      `URL:${site}/plans`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'TRIGGER:-PT1H', 'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${event ? 'plano' : 'afterhours'}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}

export const config = { path: ['/cal/:token', '/cal/:token/:event'] }
