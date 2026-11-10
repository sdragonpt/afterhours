// @ts-expect-error — shared plain-JS module
import { calendarResponse } from '../../lib/ics.mjs'

interface Env { SUPABASE_URL: string; SUPABASE_KEY: string; SITE_URL: string }

export default {
  async fetch(req, env) {
    // lib/ics.mjs reads these from process.env; provide them for the Worker runtime
    ;(globalThis as any).process ??= { env: {} }
    Object.assign((globalThis as any).process.env, env)
    const m = new URL(req.url).pathname.match(/^\/cal\/([^/]+)(?:\/([^/]+))?\/?$/)
    if (!m) return new Response('afterhours-cal', { status: 404 })
    return calendarResponse({ token: m[1], event: m[2], origin: env.SITE_URL })
  },
} satisfies ExportedHandler<Env>
