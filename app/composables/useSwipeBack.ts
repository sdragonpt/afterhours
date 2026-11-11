/**
 * Instagram-style "swipe right to go back" for the home-screen app (iOS gives standalone
 * web apps no back gesture). The element follows the finger; let go past ~30% of the
 * screen (or flick) and it slides out and goes back, otherwise it springs back.
 */
export function useSwipeBack(target: Ref<HTMLElement | null>, fallback: string) {
  const router = useRouter()
  let sx = 0, sy = 0, st = 0, dx = 0
  let locked: boolean | null = null
  let active = false

  function setX(x: number, animate: boolean) {
    const el = target.value
    if (!el) return
    el.style.transition = animate ? 'transform 260ms cubic-bezier(.22, 1, .36, 1), box-shadow 260ms' : 'none'
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
    el.style.boxShadow = x ? '-18px 0 40px #000c' : ''
  }

  function goBack() {
    const back = (window.history.state as any)?.back
    if (back) router.back()
    else navigateTo(fallback, { replace: true })
  }

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1) return
    const t = e.touches[0]!
    // leave text selection / sheets alone
    if ((e.target as HTMLElement)?.closest('textarea, input, .sheet, .sheet-wrap, [data-no-swipe]')) return
    sx = t.clientX; sy = t.clientY; st = performance.now(); dx = 0; locked = null; active = true
  }
  function onMove(e: TouchEvent) {
    if (!active) return
    const t = e.touches[0]!
    const mx = t.clientX - sx, my = t.clientY - sy
    if (locked === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) locked = mx > 0 && Math.abs(mx) > Math.abs(my) * 1.4
    if (locked === false) { active = false; return }
    if (!locked) return
    if (e.cancelable) e.preventDefault()
    dx = Math.max(0, mx)
    setX(dx, false)
  }
  function onEnd() {
    if (!active) return
    active = false
    if (!locked) return
    const w = window.innerWidth
    const speed = dx / Math.max(1, performance.now() - st) // px/ms
    if (dx > w * 0.3 || (speed > 0.6 && dx > 40)) {
      setX(w, true)
      setTimeout(() => { goBack(); setTimeout(() => setX(0, false), 50) }, 200)
    } else {
      setX(0, true)
    }
  }

  onMounted(() => {
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('touchstart', onStart)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
    document.removeEventListener('touchcancel', onEnd)
  })
}
