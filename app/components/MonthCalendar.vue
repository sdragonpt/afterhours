<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
/**
 * Month agenda grid (Mon→Sun). Dots = plans that day. Past days are dimmed and,
 * with `disablePast`, not selectable.
 */
const props = withDefaults(defineProps<{ modelValue?: string | null; marks?: Record<string, string[]>; disablePast?: boolean }>(), { modelValue: null, marks: () => ({}), disablePast: false })
const emit = defineEmits<{ 'update:modelValue': [value: string]; pick: [value: string] }>()

const today = dayKey(new Date())
const startMonth = () => { const base = props.modelValue ? new Date(props.modelValue + 'T12:00') : new Date(); return new Date(base.getFullYear(), base.getMonth(), 1) }
const month = ref(startMonth())
const dir = ref<'next' | 'prev'>('next')
watch(() => props.modelValue, (v) => {
  if (!v) return
  const d = new Date(v + 'T12:00')
  if (d.getMonth() !== month.value.getMonth() || d.getFullYear() !== month.value.getFullYear()) {
    dir.value = d > month.value ? 'next' : 'prev'
    month.value = new Date(d.getFullYear(), d.getMonth(), 1)
  }
})

const title = computed(() => capFirst(month.value.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })))
const isCurrentMonth = computed(() => { const n = new Date(); return month.value.getFullYear() === n.getFullYear() && month.value.getMonth() === n.getMonth() })
const cells = computed(() => {
  const y = month.value.getFullYear(), m = month.value.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7 // Monday-first
  const days = new Date(y, m + 1, 0).getDate()
  const out: ({ key: string; day: number; past: boolean; weekend: boolean } | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d)
    const key = dayKey(date)
    out.push({ key, day: d, past: key < today, weekend: date.getDay() === 0 || date.getDay() === 6 })
  }
  return out
})
function go(delta: number) {
  dir.value = delta > 0 ? 'next' : 'prev'
  month.value = new Date(month.value.getFullYear(), month.value.getMonth() + delta, 1)
}
// swipe left/right to change month, like a carousel: the grid follows the finger 1:1,
// slides out, and the next month slides in from the other side
const gx = ref(0)            // grid offset (px)
const gAnim = ref(false)     // animate the next offset change
const swiping = ref(false)   // skip the arrow-button transition while swiping
const gridEl = ref<HTMLElement | null>(null)
let sx = 0, sy = 0, st = 0, tracking = false, horizontal: boolean | null = null, busy = false
const blockedPrev = () => props.disablePast && isCurrentMonth.value
function onStart(e: TouchEvent) {
  if (busy) return
  const t = e.touches[0]!; sx = t.clientX; sy = t.clientY; st = performance.now(); tracking = true; horizontal = null
}
function onMove(e: TouchEvent) {
  if (!tracking) return
  const t = e.touches[0]!, dx = t.clientX - sx, dy = t.clientY - sy
  if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
  if (!horizontal) return
  if (e.cancelable) e.preventDefault()
  gAnim.value = false
  gx.value = dx > 0 && blockedPrev() ? dx * 0.2 : dx // rubber band where you can't go
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
async function onEnd() {
  if (!tracking) return
  tracking = false
  if (!horizontal) return
  const dx = gx.value
  const w = gridEl.value?.offsetWidth || 320
  const fast = Math.abs(dx) / Math.max(1, performance.now() - st) > 0.45
  const commit = (Math.abs(dx) > w * 0.25 || (fast && Math.abs(dx) > 30)) && !(dx > 0 && blockedPrev())
  gAnim.value = true
  if (!commit) { gx.value = 0; return }
  busy = true
  const d = dx < 0 ? 1 : -1
  gx.value = -d * w                 // current month slides out
  await wait(170)
  swiping.value = true
  gAnim.value = false
  go(d)
  gx.value = d * w * 0.6            // next month waits just off the other side
  await frame()
  gAnim.value = true
  gx.value = 0                      // …and slides in
  await wait(240)
  swiping.value = false
  busy = false
}
function choose(c: { key: string; past: boolean }) {
  if (props.disablePast && c.past) return
  emit('update:modelValue', c.key); emit('pick', c.key)
}
</script>

<template>
  <div class="cal" @touchstart.passive="onStart" @touchmove="onMove" @touchend="onEnd" @touchcancel="onEnd">
    <header class="cal-head">
      <button type="button" class="nav" aria-label="Mês anterior" :disabled="disablePast && isCurrentMonth" @click="go(-1)"><ChevronLeft :size="18" /></button>
      <Transition :name="`month-${dir}`" mode="out-in"><strong :key="title" class="display">{{ title }}</strong></Transition>
      <button type="button" class="nav" aria-label="Mês seguinte" @click="go(1)"><ChevronRight :size="18" /></button>
    </header>
    <div class="wd"><span v-for="(w, i) in ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']" :key="i">{{ w }}</span></div>
    <div class="grid-clip">
    <Transition :name="swiping ? 'none' : `month-${dir}`" mode="out-in">
      <div :key="title" ref="gridEl" class="grid" role="grid" :class="{ anim: gAnim }" :style="gx ? { transform: `translate3d(${gx}px, 0, 0)`, opacity: Math.max(.35, 1 - Math.abs(gx) / 700) } : undefined">
        <template v-for="(c, i) in cells" :key="i">
          <span v-if="!c" />
          <button
            v-else type="button" class="d" role="gridcell" :aria-selected="modelValue === c.key" :aria-label="dayLabel(c.key)"
            :class="{ on: modelValue === c.key, today: c.key === today, past: c.past, off: disablePast && c.past, weekend: c.weekend, busy: marks[c.key]?.length }"
            :disabled="disablePast && c.past" @click="choose(c)"
          >
            <span class="n">{{ c.day }}</span>
            <span class="dots"><i v-for="(col, j) in (marks[c.key] || []).slice(0, 3)" :key="j" :class="`fill-${col}`" /></span>
          </button>
        </template>
      </div>
    </Transition>
    </div>
  </div>
</template>

<style scoped>
.cal { touch-action: pan-y; padding: 14px; border: 1.5px solid var(--line); border-radius: var(--r-lg); background: var(--ink-2); }
.cal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.cal-head strong { font-size: 22px; }
.nav { display: grid; place-items: center; width: 36px; height: 36px; border: 1.5px solid var(--line-strong); border-radius: 999px; background: var(--ink); color: var(--paper); transition: transform var(--fast) var(--ease-out); }
.nav:active { transform: scale(.9); }
.nav:disabled { opacity: .25; }
.wd, .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.wd span { padding: 4px 0; text-align: center; color: var(--faint); font-size: 11px; font-weight: 800; letter-spacing: .08em; }
.d { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; aspect-ratio: 1; min-height: 40px; border: 1.5px solid transparent; border-radius: 14px; background: transparent; color: var(--paper); transition: background-color var(--fast), transform var(--fast) var(--ease-out); }
.d:hover { background: var(--ink-3); }
.d:active { transform: scale(.9); }
.n { font-family: var(--font-display); font-size: 18px; font-weight: 800; line-height: 1; }
.d.weekend .n { color: #c9c6bf; }
.d.past { color: var(--faint); }
.d.past .n { color: var(--faint); font-weight: 600; }
.d.off { cursor: default; }
.d.off:hover { background: transparent; }
.d.today { border-color: var(--lime); }
.d.busy:not(.on) { background: var(--ink-3); }
.d.on { background: var(--paper); color: var(--on-color); border: 2px solid #000; box-shadow: 3px 3px 0 #000; }
.d.on .n { color: var(--on-color); }
.dots { position: absolute; bottom: 5px; display: flex; gap: 2px; }
.dots i { width: 6px; height: 6px; border: 1px solid #000; border-radius: 50%; }
.grid-clip { overflow: hidden; margin: 0 -14px; padding: 0 14px; }
.grid { will-change: transform; }
.grid.anim { transition: transform 230ms cubic-bezier(.22, 1, .36, 1), opacity 230ms ease-out; }
.month-next-enter-active, .month-next-leave-active, .month-prev-enter-active, .month-prev-leave-active { transition: opacity 140ms ease-out, transform 160ms var(--ease-out); }
.month-next-enter-from { opacity: 0; transform: translateX(14px); }
.month-next-leave-to { opacity: 0; transform: translateX(-14px); }
.month-prev-enter-from { opacity: 0; transform: translateX(-14px); }
.month-prev-leave-to { opacity: 0; transform: translateX(14px); }
</style>
