/**
 * Share text (+ optional link) the way the crew actually communicates.
 * On iPhone this opens the native share sheet (WhatsApp, Discord, Messages…).
 * On desktop it falls back to WhatsApp Web.
 */
export async function shareOut(text: string, path?: string) {
  const url = path && typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : undefined
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try { await navigator.share({ text, url }); return } catch (e: any) { if (e?.name === 'AbortError') return }
  }
  window.open(whatsappLink(url ? `${text}\n${url}` : text), '_blank', 'noopener')
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
