<script setup lang="ts">
/**
 * Shows matching members while the text ends with "@something"; tapping one completes
 * it to "@Name ". Works with any input/textarea bound to the same v-model.
 */
const model = defineModel<string>({ required: true })
const crew = useCrew()
const me = useMe()

const query = computed(() => {
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(model.value || '')
  return m ? m[2]!.toLocaleLowerCase('pt-PT') : null
})
const matches = computed(() => {
  if (query.value === null) return []
  return crew.members.value
    .filter(m => m.user_id !== me.value?.id && m.name.toLocaleLowerCase('pt-PT').includes(query.value!))
    .slice(0, 6)
})
function pick(name: string) {
  model.value = model.value.replace(/@([^\s@]{0,30})$/, `@${name} `)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="matches.length" class="suggest" role="listbox" aria-label="Mencionar">
      <button v-for="m in matches" :key="m.user_id" type="button" class="pick" role="option" @mousedown.prevent @click="pick(m.name)">
        <Avatar :name="m.name" :color="m.color" :size="24" />
        <span class="truncate">{{ m.name }}</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.suggest { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 4px; scrollbar-width: none; }
.suggest::-webkit-scrollbar { display: none; }
.pick { display: flex; align-items: center; gap: 6px; flex: none; max-width: 180px; height: 36px; padding: 0 12px 0 5px; border: 1.5px solid var(--line-strong); border-radius: 999px; background: var(--ink-3); color: var(--paper); font-size: 14px; font-weight: 700; }
.pick:active { transform: scale(.95); }
</style>
