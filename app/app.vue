<script setup lang="ts">
// while swiping between sections the swipe itself animates, so the page fade is skipped
const swipeNav = useState('tab-swipe-nav', () => false)
const pageTransition = computed(() => (swipeNav.value ? false : { name: 'page', mode: 'out-in' as const }))
</script>

<template>
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
  </NuxtLayout>
</template>
