type Toast = { id: number; text: string; kind: 'ok' | 'error' }

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])
  function show(text: string, kind: Toast['kind'] = 'ok') {
    const id = Date.now() + Math.random()
    toasts.value = [...toasts.value.slice(-2), { id, text, kind }]
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, kind === 'error' ? 4500 : 2600)
  }
  return { toasts, ok: (t: string) => show(t, 'ok'), error: (t: string) => show(t, 'error') }
}

/** Celebration burst in the app's palette. Respects reduced motion. */
export async function celebrate(origin?: { x: number; y: number }) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const confetti = (await import('canvas-confetti')).default
  confetti({
    particleCount: 90, spread: 75, startVelocity: 38, ticks: 140, scalar: 1.05,
    origin: origin || { x: 0.5, y: 0.75 },
    colors: ['#d4ff3a', '#ff5a36', '#5cc8ff', '#ff8ad8', '#ffd23f', '#f4f1ea'],
    disableForReducedMotion: true,
  })
  if ('vibrate' in navigator) navigator.vibrate?.(12)
}

/** Origin for confetti from a click event. */
export const originFrom = (e?: MouseEvent) =>
  e ? { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } : undefined
