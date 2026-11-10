// Vercel Function — sends Web Push notifications queued by Postgres.
// Postgres posts {id, token}; we redeem them with push_take() (one-time, 10 min),
// send to every subscription with our VAPID key, and report dead endpoints back.
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const SITE = (process.env.SITE_URL || 'https://afterhours-malta.vercel.app').replace(/\/$/, '')

function rpc(fn, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function POST(request) {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env
  if (!pub || !priv || !SUPABASE_URL || !SUPABASE_KEY) return Response.json({ error: 'not configured' }, { status: 500 })

  let id, token
  try { ({ id, token } = await request.json()) } catch { return Response.json({ error: 'bad request' }, { status: 400 }) }
  if (typeof id !== 'string' || typeof token !== 'string' || token.length > 100) return Response.json({ error: 'bad request' }, { status: 400 })

  const r = await rpc('push_take', { p_id: id, p_token: token })
  if (!r.ok) return Response.json({ error: 'redeem failed' }, { status: 502 })
  const job = await r.json()
  if (!job) return Response.json({ error: 'unknown or used' }, { status: 404 })

  webpush.setVapidDetails(SITE, pub, priv)
  const payload = JSON.stringify({ ...job.payload, icon: '/icon-192.png', badge: '/favicon-64.png' })
  const dead = []
  let sent = 0
  await Promise.all((job.subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6, urgency: 'high' })
      sent++
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint) // unsubscribed / app removed
      else console.warn('[push] send failed', e?.statusCode || '', e?.body || e?.message || e)
    }
  }))
  if (dead.length) await rpc('push_report', { p_id: id, p_token: token, p_dead: dead })
  return Response.json({ sent, removed: dead.length })
}
