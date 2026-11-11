/**
 * afterhours-media — private clip storage on R2.
 *
 *   POST   /upload?group=<id>|dm=<user> *   POST   /upload?group=<id>&name=<file>   (Bearer <supabase access token>, raw body)name=<file>   (Bearer <supabase access token>, raw body)
 *   POST   /sign    { keys: string[] }      (Bearer …) → short-lived playback URLs
 *   DELETE /object  { key }                 (Bearer …) → only the uploader can delete
 *   DELETE /group   { group }               (Bearer …) → owner wipes every file of a community
 *   GET    /m/<key>?exp=&sig=               → streams the object (Range supported)
 *
 * Who is allowed is decided by Supabase: the user's own token is checked against
 * auth + is_group_member(); playback links are signed and verified by Postgres
 * (media_sign / media_verify), so no secret lives in this Worker.
 */
interface Env {
  MEDIA: R2Bucket
  SUPABASE_URL: string
  SUPABASE_KEY: string
  ALLOWED_ORIGINS: string
}

const MAX_BYTES = 100 * 1024 * 1024
const TYPES = /^(video\/(mp4|webm|quicktime)|image\/(jpeg|png|webp|gif))$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const json = (data: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...extra } })

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  if (!allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

function rpc(env: Env, fn: string, body: unknown, bearer = env.SUPABASE_KEY) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Resolve the caller from their Supabase access token. */
async function userFrom(req: Request, env: Env): Promise<{ id: string; token: string } | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json<{ id?: string }>()
  return u.id ? { id: u.id, token } : null
}

async function isMember(group: string, token: string, env: Env) {
  if (!UUID.test(group)) return false
  const r = await rpc(env, 'is_group_member', { p_group: group }, token)
  return r.ok && (await r.json()) === true
}

/** verified links, memoised per isolate so video seeking doesn't hit Postgres every time */
const verified = new Map<string, number>()
async function verifyLink(env: Env, key: string, exp: number, sig: string) {
  const id = `${key}:${exp}:${sig}`
  const until = verified.get(id)
  if (until && until > Date.now() / 1000) return true
  const r = await rpc(env, 'media_verify', { p_key: key, p_exp: exp, p_sig: sig })
  const ok = r.ok && (await r.json()) === true
  if (ok) {
    if (verified.size > 5000) verified.clear()
    verified.set(id, exp)
  }
  return ok
}

async function upload(req: Request, env: Env, url: URL) {
  const user = await userFrom(req, env)
  if (!user) return json({ error: 'Sessão inválida' }, 401)
  const group = url.searchParams.get('group') || ''
  const dm = url.searchParams.get('dm') || ''
  let prefix: string
  if (dm) {
    // private message photo: only to someone you share a community with
    if (!UUID.test(dm)) return json({ error: 'Destinatário inválido' }, 400)
    const r = await rpc(env, 'can_message', { p_other: dm }, user.token)
    if (!r.ok || (await r.json()) !== true) return json({ error: 'Não podes enviar mensagens a esta pessoa' }, 403)
    prefix = `dm/${user.id}/${dm}`
  } else {
    if (!(await isMember(group, user.token, env))) return json({ error: 'Não pertences a esta comunidade' }, 403)
    prefix = `${group}/${user.id}`
  }
  const type = (req.headers.get('content-type') || '').split(';')[0]!.trim()
  if (!TYPES.test(type)) return json({ error: 'Tipo de ficheiro não suportado' }, 415)
  if (dm && !type.startsWith('image/')) return json({ error: 'Nas mensagens só dá para enviar fotos' }, 415)
  const size = Number(req.headers.get('content-length') || 0)
  if (!size) return json({ error: 'Tamanho em falta' }, 411)
  if (size > MAX_BYTES) return json({ error: 'Ficheiro acima de 100 MB' }, 413)
  const name = (url.searchParams.get('name') || 'clip').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80)
  const key = `${prefix}/${crypto.randomUUID()}-${name}`
  await env.MEDIA.put(key, req.body, { httpMetadata: { contentType: type, cacheControl: 'private, max-age=31536000, immutable' } })
  return json({ key })
}

async function sign(req: Request, env: Env, origin: string) {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sessão inválida' }, 401)
  const { keys } = await req.json<{ keys?: string[] }>().catch(() => ({ keys: [] as string[] }))
  // Postgres checks membership with the user's own token and signs only the allowed keys
  const r = await rpc(env, 'media_sign', { p_keys: (keys || []).slice(0, 200) }, auth.slice(7))
  if (!r.ok) return json({ error: 'Sessão inválida' }, 401)
  const signed = await r.json<Record<string, string>>()
  const urls: Record<string, string> = {}
  for (const [key, qs] of Object.entries(signed || {})) {
    urls[key] = `${origin}/m/${key.split('/').map(encodeURIComponent).join('/')}?${qs}`
  }
  return json({ urls })
}

async function remove(req: Request, env: Env) {
  const user = await userFrom(req, env)
  if (!user) return json({ error: 'Sessão inválida' }, 401)
  const { key } = await req.json<{ key?: string }>().catch(() => ({ key: '' }))
  if (!key || key.split('/')[1] !== user.id) return json({ error: 'Só quem enviou pode apagar' }, 403)
  await env.MEDIA.delete(key)
  return json({ ok: true })
}

/** Community owner is deleting it: remove every object under `<group>/`. */
async function removeGroup(req: Request, env: Env) {
  const user = await userFrom(req, env)
  if (!user) return json({ error: 'Sessão inválida' }, 401)
  const { group } = await req.json<{ group?: string }>().catch(() => ({ group: '' }))
  if (!group || !UUID.test(group)) return json({ error: 'Comunidade inválida' }, 400)
  const r = await rpc(env, 'owns_group', { p_group: group }, user.token)
  if (!r.ok || (await r.json()) !== true) return json({ error: 'Só o dono pode apagar a comunidade' }, 403)
  let removed = 0
  let cursor: string | undefined
  do {
    const page = await env.MEDIA.list({ prefix: `${group}/`, cursor, limit: 1000 })
    if (page.objects.length) { await env.MEDIA.delete(page.objects.map(o => o.key)); removed += page.objects.length }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return json({ ok: true, removed })
}

async function serve(req: Request, env: Env, url: URL) {
  const key = decodeURIComponent(url.pathname.slice(3))
  const exp = Number(url.searchParams.get('exp') || 0)
  const sig = url.searchParams.get('sig') || ''
  if (!key || !exp || exp < Date.now() / 1000) return new Response('Link expirado', { status: 403 })
  if (!sig || !(await verifyLink(env, key, exp, sig))) return new Response('Link inválido', { status: 403 })

  const obj = await env.MEDIA.get(key, { range: req.headers, onlyIf: req.headers })
  if (!obj) return new Response('Não encontrado', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  if (!('body' in obj)) return new Response(null, { status: 304, headers }) // conditional request matched
  const r = obj.range as { offset?: number; length?: number } | undefined
  if (req.headers.has('range') && r) {
    const start = r.offset ?? 0
    const end = start + (r.length ?? obj.size - start) - 1
    headers.set('content-range', `bytes ${start}-${end}/${obj.size}`)
    headers.set('content-length', String(end - start + 1))
    return new Response(obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(obj.size))
  return new Response(obj.body, { headers })
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const c = cors(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c })
    try {
      let res: Response
      if (req.method === 'POST' && url.pathname === '/upload') res = await upload(req, env, url)
      else if (req.method === 'POST' && url.pathname === '/sign') res = await sign(req, env, url.origin)
      else if (req.method === 'DELETE' && url.pathname === '/object') res = await remove(req, env)
      else if (req.method === 'DELETE' && url.pathname === '/group') res = await removeGroup(req, env)
      else if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/m/')) res = await serve(req, env, url)
      else res = new Response('afterhours-media', { status: 404 })
      for (const [k, v] of Object.entries(c)) res.headers.set(k, v)
      return res
    } catch (e: any) {
      return json({ error: e?.message || 'Erro' }, 500, c)
    }
  },
} satisfies ExportedHandler<Env>
