<script setup lang="ts">
import type { Vibe } from '~/composables/useCrew'
const props = withDefaults(defineProps<{ name: string; color?: string; size?: number; ring?: boolean; vibe?: string | null }>(), { color: 'lime', size: 40, ring: false, vibe: null })
const letter = computed(() => (props.name === 'Tu' ? 'Tu' : (props.name || '?').trim().slice(0, 1).toUpperCase()))
</script>

<template>
  <span class="av" :class="[`fill-${color}`, { ring }]" :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * (letter.length > 1 ? .34 : .44)) + 'px' }" :title="name">
    {{ letter }}
    <i v-if="vibe" class="av-vibe" :class="`fill-${VIBES[vibe as Vibe]?.color || 'lime'}`" />
  </span>
</template>

<style scoped>
.av { position: relative; display: inline-grid; place-items: center; flex: none; border: 2px solid #000; border-radius: 999px; font-family: var(--font-display); font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.av.ring { box-shadow: 0 0 0 2.5px var(--ink), 0 0 0 4.5px var(--lime); }
.av-vibe { position: absolute; right: -2px; bottom: -2px; width: 34%; height: 34%; min-width: 9px; min-height: 9px; border: 2px solid var(--ink); border-radius: 50%; }
</style>
