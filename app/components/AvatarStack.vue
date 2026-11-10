<script setup lang="ts">
const props = withDefaults(defineProps<{ ids: string[]; size?: number; max?: number }>(), { size: 28, max: 5 })
const { nameOf, colorOf } = useCrew()
const shown = computed(() => props.ids.slice(0, props.max))
const extra = computed(() => props.ids.length - shown.value.length)
</script>

<template>
  <span class="stack">
    <Avatar v-for="id in shown" :key="id" :name="nameOf(id)" :color="colorOf(id)" :size="size" />
    <span v-if="extra > 0" class="more" :style="{ width: size + 'px', height: size + 'px' }">+{{ extra }}</span>
  </span>
</template>

<style scoped>
.stack { display: inline-flex; align-items: center; }
.stack > * + * { margin-left: -9px; }
.more { display: inline-grid; place-items: center; border: 2px solid #000; border-radius: 999px; background: var(--paper); color: var(--on-color); font-size: 11px; font-weight: 800; }
</style>
