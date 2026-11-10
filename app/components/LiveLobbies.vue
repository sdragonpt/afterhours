<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
/** "Hoje" banner: lobbies that are live now or start within the next hour. */
const supabase = useSupabaseClient()
const me = useMe()
const toast = useToast()
const gaming = useGamingData()

const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => { tick = setInterval(() => (now.value = Date.now()), 30_000) })
onBeforeUnmount(() => clearInterval(tick))

const active = computed(() => gaming.data.value.lobbies.filter((l: any) => {
  const start = new Date(l.starts_at).getTime()
  return start - 3600000 <= now.value && now.value < start + LOBBY_MS
}).slice(0, 2))

const live = (l: any) => new Date(l.starts_at).getTime() <= now.value
const label = (l: any) => live(l) ? 'a decorrer' : `às ${new Date(l.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
const inLobby = (l: any) => l.players.includes(me.value?.id)
const full = (l: any) => l.players.length >= l.slots

async function join(l: any, e: MouseEvent) {
  if (!me.value || inLobby(l) || full(l)) return
  l.players = [...l.players, me.value.id]
  celebrate(originFrom(e))
  const { error } = await supabase.from('game_call_players').insert({ call_id: l.id, user_id: me.value.id })
  if (error) { toast.error(error.message); gaming.refresh() }
  else toast.ok(`Tás no lobby de ${l.game}!`)
}
</script>

<template>
  <TransitionGroup name="list" tag="div" class="flex flex-col gap-2 relative">
    <div v-for="l in active" :key="l.id" class="live-lobby">
      <NuxtLink to="/gaming" class="main">
        <span class="dot" :class="{ soon: !live(l) }" />
        <span class="min-w-0">
          <strong class="block truncate">🎮 {{ l.game }}</strong>
          <small>{{ label(l) }} · {{ l.players.length }}/{{ l.slots }}{{ full(l) ? ' · cheio' : '' }}</small>
        </span>
      </NuxtLink>
      <button v-if="!inLobby(l) && !full(l)" class="btn btn-sm join" @click="join(l, $event)">Entrar</button>
      <NuxtLink v-else to="/gaming" class="in">{{ inLobby(l) ? 'Tás dentro' : 'Ver' }} <ChevronRight :size="15" /></NuxtLink>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.live-lobby { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; border: 2px solid #000; border-radius: 999px; background: var(--sky); color: var(--on-color); box-shadow: 3px 3px 0 #000; }
.main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.main strong { font-size: 15px; }
.main small { font-size: 12px; font-weight: 700; opacity: .7; }
.dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: var(--coral); border: 2px solid #000; animation: live 1.6s ease-in-out infinite; }
.dot.soon { background: var(--sun); animation: none; }
@keyframes live { 50% { transform: scale(1.35); } }
.join { background: var(--ink); color: var(--paper); border-color: #000; }
.in { display: inline-flex; align-items: center; gap: 2px; padding: 0 6px; font-size: 13px; font-weight: 800; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
</style>
