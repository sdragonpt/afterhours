/**
 * Instagram-style swipe between the main sections (Hoje · Planos · Gaming · Tab).
 * The page follows the finger 1:1; let go past ~25% (or flick) and it slides out while
 * the next section slides in from the other side. Ends get a rubber band.
 * Horizontal gestures that belong to something else are left alone: the agenda,
 * videos, sliders, text fields, sheets, and rows that actually scroll sideways.
 */
export function useTabSwipe(target: Ref<HTMLElement | null>, routes: Ref<string[]>, enabled: Ref<boolean>) {
  const route = useRoute()
  const swipeNav = useState('tab-swipe-nav', () => false)
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
    el.style.opacity = x ? String(Math.max(0.75, 1 - Math.abs(x) / (window.innerWidth * 3))) : ''
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
    swipeNav.value = true                       // no page fade: the swipe is the animation
    const el = target.value
    el?.classList.add('tab-swiping')            // and no pop-in of the new page's cards
    const out = -dir * Math.max(Math.abs(dx), w * 0.42)
    setX(out, 130)                              // current section moves on a bit further…
    await new Promise(r => setTimeout(r, 120))
    // swap: the old page is still on screen until the new one renders (already preloaded),
    // and the new one is placed off to the other side before the browser paints it
    await navigateTo(next)
    await nextTick()
    setX(dir * w * 0.32)                        // next section starts just off the other side
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    setX(0, 230)                                // …and glides in
    setTimeout(() => {
      busy = false
      swipeNav.value = false
      if (el) { el.style.transition = ''; el.style.opacity = ''; }
    }, 250)
  }

  // load the neighbouring sections ahead of time so the swap is instant
  function preloadNeighbours() {
    const i = index()
    for (const r of [routes.value[i - 1], routes.value[i + 1]]) if (r) preloadRouteComponents(r).catch(() => {})
  }
  watch(() => route.path, () => {
    if (!import.meta.client) return
    preloadNeighbours()
    // a normal navigation (tap) gets the usual entrance animations back
    if (!swipeNav.value) target.value?.classList.remove('tab-swiping')
  })

  onMounted(() => {
    preloadNeighbours()
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
