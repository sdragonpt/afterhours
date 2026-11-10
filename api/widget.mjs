// Vercel Function — data for the iPhone widget (Scriptable): /api/widget?t=<personal token>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request) {
  const t = new URL(request.url).searchParams.get('t') || ''
  if (!UUID.test(t)) return Response.json({ error: 'Código inválido' }, { status: 400 })
  const { SUPABASE_URL: url, SUPABASE_KEY: key } = process.env
  const r = await fetch(`${url}/rest/v1/rpc/widget_data`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: t }),
  })
  if (!r.ok) return Response.json({ error: 'Indisponível' }, { status: 502 })
  const data = await r.json()
  if (!data) return Response.json({ error: 'Código expirado. Gera um novo no Perfil do Afterhours.' }, { status: 404 })
  return Response.json(data, { headers: { 'cache-control': 'private, max-age=60' } })
}
