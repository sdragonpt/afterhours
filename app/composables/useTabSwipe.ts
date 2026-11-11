/**
 * Instagram-style swipe between the main sections (Hoje · Planos · Gaming · Tab).
 * The page follows the finger 1:1; let go past ~25% (or flick) and it slides out while
 * the next section slides in from the other side. Ends get a rubber band.
 * Horizontal gestures that belong to something else are left alone: the agenda,
 * videos, sliders, text fields, sheets, and rows that actually scroll sideways.
 */
export function useTabSwipe(target: Ref<HTMLElement | null>, routes: Ref<string[]>, enabled: Ref<boolean>) {
  const route = useRoute()
  let sx = 0, sy = 0, st = 0, dx = 0
  let locked: boolean | null = null
  let active = false
  let busy = false

  const index = () => routes.value.indexOf(route.path)

  function setX(x: number, ms = 0) {
    const el = target.value
    if (!el) return
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.22, 1, .36, 1), opacity ${ms}ms ease-out` : 'none'
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
    el.style.opacity = x ? String(Math.max(0.4, 1 - Math.abs(x) / (window.innerWidth * 1.6))) : ''
  }

  function blockedBy(el: HTMLElement | null): boolean {
    if (!el) return false
    if (el.closest('input, textarea, select, video, audio, .cal, .sheet, .sheet-wrap, [data-no-swipe], .ptr-active')) return true
    // a row that really scrolls sideways keeps its own swipe
    for (let n: HTMLElement | null = el; n && n !== target.value; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true
    }
    return false
  }

  function onStart(e: TouchEvent) {
    if (!enabled.value || busy || e.touches.length !== 1 || index() < 0) return
    if (document.querySelector('.sheet-wrap')) return // a sheet is open
    if (blockedBy(e.target as HTMLElement)) return
    const t = e.touches[0]!
    sx = t.clientX; sy = t.clientY; st = performance.now(); dx = 0; locked = null; active = true
  }
  function onMove(e: TouchEvent) {
    if (!active) return
    const t = e.touches[0]!
    const mx = t.clientX - sx, my = t.clientY - sy
    if (locked === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) locked = Math.abs(mx) > Math.abs(my) * 1.3
    if (locked === false) { active = false; return }
    if (!locked) return
    if (e.cancelable) e.preventDefault()
    const i = index()
    const atEnd = (mx > 0 && i === 0) || (mx < 0 && i === routes.value.length - 1)
    dx = atEnd ? mx * 0.2 : mx
    setX(dx)
  }
  async function onEnd() {
    if (!active) return
    active = false
    if (!locked) return
    const w = window.innerWidth
    const i = index()
    const dir = dx < 0 ? 1 : -1
    const next = routes.value[i + dir]
    const fast = Math.abs(dx) / Math.max(1, performance.now() - st) > 0.5
    if (!next || !(Math.abs(dx) > w * 0.25 || (fast && Math.abs(dx) > 40))) {
      setX(0, 240)
      setTimeout(() => { if (!active && target.value) target.value.style.transition = '' }, 260)
      return
    }
    busy = true
    setX(-dir * w, 180)                      // current section slides out
    await new Promise(r => setTimeout(r, 170))
    const el = target.value
    if (el) el.style.visibility = 'hidden'
    await navigateTo(next)
    await nextTick()
    setX(dir * w * 0.5)                      // next one waits on the other side…
    if (el) el.style.visibility = ''
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    setX(0, 260)                             // …and slides in
    setTimeout(() => { busy = false; const t = target.value; if (t) { t.style.transition = ''; t.style.opacity = '' } }, 280)
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
