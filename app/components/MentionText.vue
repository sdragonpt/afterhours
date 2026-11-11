<script setup lang="ts">
/** Text with @mentions of community members highlighted (no v-html). */
const props = defineProps<{ text: string }>()
const crew = useCrew()
const me = useMe()
const parts = computed(() => splitMentions(props.text, crew.members.value))
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"><span v-if="p.id" class="mention" :class="{ me: p.id === me?.id }">{{ p.text }}</span><template v-else>{{ p.text }}</template></template>
</template>

<style scoped>
.mention { padding: 0 3px; border-radius: 6px; background: #d4ff3a26; color: var(--lime); font-weight: 700; }
.mention.me { background: var(--lime); color: var(--on-color); }
</style>
