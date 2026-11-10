<script setup lang="ts">
/** Horizontal agenda: next N days, with coloured dots for days that already have plans. */
const props = withDefaults(defineProps<{ modelValue?: string | null; marks?: Record<string, string[]>; days?: number; compact?: boolean }>(), { modelValue: null, marks: () => ({}), days: 21, compact: false })
const emit = defineEmits<{ 'update:modelValue': [value: string]; pick: [value: string] }>()

const list = computed(() => {
  const out: { key: string; wd: string; day: number; month: string | null; today: boolean; weekend: boolean }[] = []
  const d = new Date(); d.setHours(12, 0, 0, 0)
  for (let i = 0; i < props.days; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i)
    out.push({
      key: dayKey(x),
      wd: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : x.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', ''),
      day: x.getDate(),
      month: i === 0 || x.getDate() === 1 ? x.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '') : null,
      today: i === 0,
      weekend: x.getDay() === 5 || x.getDay() === 6,
    })
  }
  return out
})
const scroller = ref<HTMLElement | null>(null)
function choose(key: string) { emit('update:modelValue', key); emit('pick', key) }
watch(() => props.modelValue, async (v) => {
  await nextTick()
  const el = scroller.value?.querySelector<HTMLElement>(`[data-day="${v}"]`)
  el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
})
</script>

<template>
  <div ref="scroller" class="strip" :class="{ compact }" role="listbox" aria-label="Escolher dia">
    <button
      v-for="d in list" :key="d.key" :data-day="d.key" type="button" role="option" :aria-selected="modelValue === d.key"
      class="day" :class="{ on: modelValue === d.key, today: d.today, weekend: d.weekend, busy: marks[d.key]?.length }"
      @click="choose(d.key)"
    >
      <span class="month">{{ d.month || '' }}</span>
      <span class="wd">{{ d.wd }}</span>
      <span class="num display">{{ d.day }}</span>
      <span class="dots"><i v-for="(c, i) in (marks[d.key] || []).slice(0, 3)" :key="i" :class="`fill-${c}`" /></span>
    </button>
  </div>
</template>

<style scoped>
.strip { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 4px 16px 8px; scroll-snap-type: x proximity; scrollbar-width: none; }
.strip::-webkit-scrollbar { display: none; }
.day { position: relative; display: flex; flex-direction: column; align-items: center; flex: none; width: 62px; padding: 6px 0 8px; border: 1.5px solid var(--line); border-radius: 18px; background: var(--ink-2); color: var(--muted); scroll-snap-align: center; transition: transform var(--fast) var(--ease-out), background-color var(--fast), border-color var(--fast), color var(--fast); }
.compact .day { width: 54px; }
.day:active { transform: scale(.93); }
.day.weekend { border-color: var(--line-strong); }
.day.today { border-color: var(--lime); }
.day.busy { color: var(--paper); }
.day.on { background: var(--paper); border-color: #000; color: var(--on-color); box-shadow: 3px 3px 0 #000; transform: translateY(-2px); }
.month { height: 12px; font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--lime); }
.day.on .month { color: var(--on-color); }
.wd { font-size: 11px; font-weight: 700; text-transform: capitalize; white-space: nowrap; }
.num { margin-top: 2px; font-size: 26px; line-height: 1; }
.dots { display: flex; gap: 3px; height: 8px; margin-top: 6px; }
.dots i { width: 7px; height: 7px; border: 1.5px solid #000; border-radius: 50%; }
</style>
