// Vercel Function — calendar feed. Reached through vercel.json rewrites:
//   /cal/<token>          → whole community agenda (webcal subscription)
//   /cal/<token>/<event>  → a single plan ("Pôr na agenda")
import { calendarResponse } from '../lib/ics.mjs'

export async function GET(request) {
  const url = new URL(request.url)
  return calendarResponse({
    token: url.searchParams.get('token') || '',
    event: url.searchParams.get('event') || undefined,
    origin: url.origin,
  })
}
