<script setup lang="ts">
/**
 * Pull-to-refresh for the home-screen app (iOS standalone has no reload button).
 * Pull down from the very top of the page → release past the threshold → onRefresh().
 */
const props = defineProps<{ onRefresh: () => Promise<unknown> }>()
const THRESHOLD = 72
const MAX = 120

const pull = ref(0)
const refreshing = ref(false)
let startY = 0
let startX = 0
let tracking = false
let vertical: boolean | null = null

const progress = computed(() => Math.min(1, pull.value / THRESHOLD))
const armed = computed(() => pull.value >= THRESHOLD)

function blocked() {
  // not when a sheet is open, or the page isn't scrolled to the very top
  return refreshing.value || !!document.querySelector('.sheet') || window.scrollY > 0
}
function onStart(e: TouchEvent) {
  if (blocked() || e.touches.length !== 1) { tracking = false; return }
  tracking = true
  vertical = null
  startY = e.touches[0]!.clientY
  startX = e.touches[0]!.clientX
}
function onMove(e: TouchEvent) {
  if (!tracking) return
  const dy = e.touches[0]!.clientY - startY
  const dx = e.touches[0]!.clientX - startX
  // sideways swipes (between sections) are not a pull
  if (vertical === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) vertical = Math.abs(dy) >= Math.abs(dx)
  if (vertical === false) { tracking = false; pull.value = 0; return }
  if (dy <= 0 || window.scrollY > 0) { pull.value = 0; return }
  // rubber-band resistance
  pull.value = Math.min(MAX, dy * 0.55)
}
async function onEnd() {
  if (!tracking) return
  tracking = false
  if (armed.value) {
    refreshing.value = true
    pull.value = THRESHOLD
    if ('vibrate' in navigator) navigator.vibrate?.(10)
    try { await props.onRefresh() } finally {
      setTimeout(() => { refreshing.value = false; pull.value = 0 }, 350)
    }
  } else {
    pull.value = 0
  }
}

onMounted(() => {
  window.addEventListener('touchstart', onStart, { passive: true })
  window.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onEnd, { passive: true })
  window.addEventListener('touchcancel', onEnd, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('touchstart', onStart)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onEnd)
  window.removeEventListener('touchcancel', onEnd)
})
</script>

<template>
  <div class="ptr" :class="{ live: pull > 0 || refreshing, settling: !tracking }" :style="{ transform: `translate3d(-50%, ${pull - 56}px, 0)`, opacity: Math.min(1, pull / 30) }" aria-hidden="true">
    <span class="ptr-mark" :class="{ spin: refreshing, armed }" :style="{ transform: refreshing ? undefined : `rotate(${progress * 300}deg) scale(${0.7 + progress * 0.3})` }">a<i /></span>
  </div>
</template>

<style scoped>
.ptr { position: fixed; top: calc(env(safe-area-inset-top) + 8px); left: 50%; z-index: 55; pointer-events: none; opacity: 0; }
.ptr.settling { transition: transform 260ms var(--ease-out), opacity 200ms; }
.ptr-mark { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border: 2px solid #000; border-radius: 14px; background: var(--ink-3); color: var(--paper); font-family: var(--font-display); font-weight: 800; font-size: 26px; line-height: 1; box-shadow: 0 6px 20px #0008; transition: background-color var(--fast), color var(--fast); }
.ptr-mark i { position: absolute; right: 7px; bottom: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); border: 1.5px solid #000; }
.ptr-mark.armed, .ptr-mark.spin { background: var(--lime); color: var(--on-color); }
.spin { animation: ptr-spin 700ms linear infinite; }
@keyframes ptr-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
