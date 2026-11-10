/**
 * Pending invite: remembered on this device when someone opens an invite link before
 * having an account, so it survives sign-up + email confirmation (which may land on
 * a different page) and is accepted on the first login.
 */
const KEY = 'ah-pending-invite'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function rememberInvite(fromUrlOrToken: string) {
  const token = fromUrlOrToken.match(UUID)?.[0]
  if (!token) return
  try { localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() })) } catch {}
}

export function takePendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { token, at } = JSON.parse(raw)
    if (Date.now() - at > 7 * 86400000) { localStorage.removeItem(KEY); return null } // invites expire in 7 days
    return token
  } catch { return null }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(KEY) } catch {}
}
