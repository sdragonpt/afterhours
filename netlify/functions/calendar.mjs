// Netlify Function — same calendar feed as api/cal.mjs (kept so the Netlify site keeps working).
import { calendarResponse } from '../../lib/ics.mjs'

export default async (req, context) => {
  const { token, event } = context.params || {}
  return calendarResponse({ token, event, origin: process.env.URL || new URL(req.url).origin })
}

export const config = { path: ['/cal/:token', '/cal/:token/:event'] }
