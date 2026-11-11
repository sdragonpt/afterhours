<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
/** Owner-only: delete the active community and everything in it. */
const supabase = useSupabaseClient()
const community = useCommunity()
const crew = useCrew()
const media = useMedia()
const toast = useToast()
const open = ref(false)
const confirmText = ref('')
const busy = ref(false)
const step = ref('')

const name = computed(() => crew.group.value?.name || '')
const matches = computed(() => !!name.value && confirmText.value.trim().toLowerCase() === name.value.trim().toLowerCase())

watch(open, (v) => { if (v) confirmText.value = '' })

async function run() {
  const id = community.value
  if (!id || !matches.value || !crew.isOwner.value) return
  busy.value = true
  try {
    // 1) photos and clips (R2), while we're still the owner
    step.value = 'A apagar fotos e clips…'
    await media.removeGroup(id)
    // 2) everything else (posts, planos, lobbies, Tab, convites…) in one go
    step.value = 'A apagar a comunidade…'
    const { error } = await supabase.rpc('delete_group', { p_group: id, p_confirm_name: confirmText.value })
    if (error) throw error
    open.value = false
    const gone = name.value
    await crew.loadGroups()     // switches to the next community, if any
    await crew.loadMembers(true)
    if (crew.groups.value.length) prefetchAll()
    toast.ok(`"${gone}" foi apagada`)
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    const msg = e?.message || ''
    toast.error(msg.includes('does not match') ? 'O nome não bate certo.' : msg.includes('Only the owner') ? 'Só o dono pode apagar a comunidade.' : msg || 'Não foi possível apagar')
  } finally {
    busy.value = false; step.value = ''
  }
}
</script>

<template>
  <section>
    <button class="btn btn-ghost btn-block danger-btn" @click="open = true"><Trash2 :size="16" /> Apagar comunidade</button>
    <Sheet :open="open" kicker="Comunidade" :title="`Apagar ${name}?`" @close="open = false">
      <div class="flex flex-col gap-4">
        <div class="muted text-sm flex flex-col gap-2">
          <p class="m-0"><b>É apagado para todos ({{ crew.members.value.length }} {{ crew.members.value.length === 1 ? 'pessoa' : 'pessoas' }}):</b> posts, fotos e clips, comentários, sondagens, planos, lobbies, o Tab (despesas e pagamentos), convites, a ligação ao Discord e os widgets.</p>
          <p class="m-0">As contas da malta continuam, só deixam de ter esta comunidade.</p>
          <p class="m-0 t-coral font-bold">Não dá para desfazer.</p>
        </div>
        <label class="label" for="del-community">Escreve <b class="text-[var(--paper)]">{{ name }}</b> para confirmar</label>
        <input id="del-community" v-model="confirmText" class="field" autocomplete="off" :placeholder="name">
        <button class="btn btn-danger btn-block" :disabled="busy || !matches" @click="run">{{ busy ? step || 'A apagar…' : 'Apagar para sempre' }}</button>
      </div>
    </Sheet>
  </section>
</template>

<style scoped>
.danger-btn { color: var(--coral); border-color: #ff5a3655; }
b { color: var(--paper); font-weight: 600; }
</style>
