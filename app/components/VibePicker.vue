<script setup lang="ts">
import type { Vibe } from '~/composables/useCrew'
const emit = defineEmits<{ done: [] }>()
const supabase = useSupabaseClient()
const me = useMe()
const crew = useCrew()
const toast = useToast()
const current = computed(() => crew.meMember.value?.vibe || null)
const note = ref(crew.meMember.value?.vibe_note || '')
const saving = ref(false)

async function set(vibe: Vibe | null, e?: MouseEvent) {
  if (!me.value) return
  saving.value = true
  // vibes last until 6am next morning — no stale "bora sair" from last week
  const until = new Date(); if (until.getHours() >= 6) until.setDate(until.getDate() + 1); until.setHours(6, 0, 0, 0)
  const { error } = await supabase.from('profiles').upsert({
    id: me.value.id, vibe, vibe_note: vibe ? (note.value.trim() || null) : null, vibe_until: vibe ? until.toISOString() : null,
  }, { onConflict: 'id' })
  saving.value = false
  if (error) return toast.error(error.message)
  await crew.loadMembers(true)
  if (vibe === 'sair' || vibe === 'jogar') celebrate(originFrom(e))
  toast.ok(vibe ? `Vibe: ${VIBES[vibe].label}` : 'Vibe limpa')
  emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="vibes stagger">
      <button v-for="(v, key) in VIBES" :key="key" class="vibe" :class="[`fill-${v.color}`, { picked: current === key }]" :disabled="saving" @click="set(key as Vibe, $event)">
        {{ v.label }}
      </button>
    </div>
    <div>
      <label class="label" for="vibe-note">Nota (opcional)</label>
      <input id="vibe-note" v-model="note" class="field" maxlength="60" placeholder="CS às 22h? Alguém para um fino?">
    </div>
    <button v-if="current" class="btn btn-ghost btn-block" :disabled="saving" @click="set(null)">Limpar a minha vibe</button>
    <p class="faint text-xs text-center m-0">A vibe desaparece sozinha às 6h da manhã.</p>
  </div>
</template>

<style scoped>
.vibes { display: flex; flex-wrap: wrap; gap: 10px; }
.vibe { padding: 14px 18px; border: 2px solid #000; border-radius: 999px; font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: -.02em; box-shadow: 3px 3px 0 #000; transition: transform var(--fast) var(--ease-out), box-shadow var(--fast) var(--ease-out); }
.vibe:nth-child(odd) { transform: rotate(-1.5deg); }
.vibe:nth-child(even) { transform: rotate(1.5deg); }
.vibe:active { transform: scale(.94); box-shadow: 1px 1px 0 #000; }
.vibe.picked { outline: 3px solid var(--paper); outline-offset: 3px; }
</style>
