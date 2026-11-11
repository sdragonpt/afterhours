<script setup lang="ts">
/**
 * Clip player that shows the first frame as a preview instead of a black box.
 * iOS Safari doesn't paint a frame with preload="metadata" until play; the media
 * fragment "#t=0.1" makes it fetch just the start (Range request) and render it.
 */
const props = defineProps<{ src?: string | null }>()
const withFrame = computed(() => (props.src ? (props.src.includes('#') ? props.src : `${props.src}#t=0.1`) : undefined))
</script>

<template>
  <video :src="withFrame" controls playsinline preload="metadata" />
</template>
