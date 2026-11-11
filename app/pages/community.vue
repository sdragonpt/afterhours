<script setup lang="ts">
import { UserPlus, Share2, Copy, Check, MessageSquare, ChevronDown, Crown, Settings2, Send } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const community = useCommunity()
const crew = useCrew()
const ledger = useLedger()
const toast = useToast()

const stats = ref<Record<string, { posts: number; plans: number; lobbies: number }>>({})
const invite = ref('')
const copied = ref(false)
const showDiscord = ref(false)
const webhook = ref('')
const savingHook = ref(false)

type Badge = { label: string; color: string }
const badges = computed(() => {
  const out: Record<string, Badge[]> = {}
  const add = (id: string | null, b: Badge) => { if (id) (out[id] ||= []).push(b) }
  const top = (k: 'posts' | 'plans' | 'lobbies') => {
    let best: string | null = null, n = 0
    for (const [id, s] of Object.entries(stats.value)) if (s[k] > n) { best = id; n = s[k] }
    return best
  }
  add(top('plans'), { label: 'Organizador', color: 'coral' })
  add(top('posts'), { label: 'Influencer', color: 'pink' })
  add(top('lobbies'), { label: 'Gamer', color: 'sky' })
  add(ledger.topDebtor.value, { label: 'Caloteiro-mor', color: 'sun' })
  for (const m of crew.members.value) if (Date.now() - new Date(m.joined_at).getTime() < 7 * 86400000) add(m.user_id, { label: 'Novato', color: 'mint' })
  return out
})

async function load() {
  if (!community.value) return
  await crew.loadMembers(true)
  ledger.load()
  const [p, e, l] = await Promise.all([
    supabase.from('posts').select('author_id').eq('group_id', community.value),
    supabase.from('events').select('created_by').eq('group_id', community.value),
    supabase.from('game_calls').select('created_by').eq('group_id', community.value),
  ])
  const s: typeof stats.value = {}
  const bump = (id: string, k: 'posts' | 'plans' | 'lobbies') => { (s[id] ||= { posts: 0, plans: 0, lobbies: 0 })[k]++ }
  for (const r of p.data || []) bump(r.author_id, 'posts')
  for (const r of e.data || []) bump(r.created_by, 'plans')
  for (const r of l.data || []) bump(r.created_by, 'lobbies')
  stats.value = s
  if (crew.isOwner.value) {
    const { data } = await supabase.from('group_integrations').select('discord_webhook_url').eq('group_id', community.value).maybeSingle()
    webhook.value = data?.discord_webhook_url || ''
  }
}

// owner: edit name, features and filter
const showEdit = ref(false)
const editDraft = ref<CommunityDraft>({ name: '', features: { ...DEFAULT_FEATURES }, filter: false })
const savingEdit = ref(false)
function openEdit() {
  const g = crew.group.value
  if (!g) return
  editDraft.value = { name: g.name, features: { ...crew.features.value }, filter: !!g.filter_messages }
  showEdit.value = true
}
async function saveEdit(e?: Event) {
  const d = editDraft.value
  savingEdit.value = true
  const { error } = await supabase.rpc('update_group', { p_group: community.value, p_name: d.name.trim(), p_features: d.features, p_filter: d.filter })
  savingEdit.value = false
  if (error) return toast.error(error.message)
  crew.groups.value = crew.groups.value.map(g => g.id === community.value ? { ...g, name: d.name.trim(), features: { ...d.features }, filter_messages: d.filter } : g)
  showEdit.value = false
  toast.ok('Comunidade atualizada')
}

async function makeInvite() {
  const { data, error } = await supabase.rpc('create_group_invite', { p_group: community.value })
  if (error) return toast.error(error.message)
  invite.value = `${window.location.origin}/join?token=${data}`
}
async function copy() { await navigator.clipboard.writeText(invite.value); copied.value = true; setTimeout(() => (copied.value = false), 1500) }
function shareInvite() { shareOut(`Entra na malta "${crew.group.value?.name}" no Afterhours 🌙`, invite.value.replace(window.location.origin, '')) }

async function saveDiscord() {
  savingHook.value = true
  const { error } = await supabase.from('group_integrations').upsert({ group_id: community.value, discord_webhook_url: webhook.value.trim() || null, app_url: window.location.origin, updated_at: new Date().toISOString() }, { onConflict: 'group_id' })
  savingHook.value = false
  if (error) return toast.error(error.message.includes('check constraint') ? 'Isso não é um webhook do Discord.' : error.message)
  toast.ok(webhook.value.trim() ? 'Discord ligado!' : 'Discord desligado')
}

watch(community, load)
onMounted(load)
</script>

<template>
  <div class="malta">
    <header class="pt-2">
      <p class="kicker">A malta · {{ crew.members.value.length }}</p>
      <h1 class="display h-xl crew-name">{{ crew.group.value?.name }}<span class="t-lime">.</span></h1>
      <div v-if="crew.isOwner.value" class="flex flex-wrap gap-2 mt-3">
        <button class="btn btn-sm btn-ghost" @click="openEdit"><Settings2 :size="15" /> Editar comunidade</button>
        <span v-if="crew.group.value?.filter_messages" class="chip">🛡️ Filtro ligado</span>
      </div>
    </header>

    <Sheet :open="showEdit" kicker="Comunidade" title="Editar" @close="showEdit = false">
      <CommunityForm v-model="editDraft" submit-label="Guardar" :busy="savingEdit" @submit="saveEdit" />
    </Sheet>

    <!-- invite -->
    <section v-if="crew.isOwner.value" class="invite sticker fill-lime">
      <div v-if="!invite" class="flex items-center gap-4">
        <div class="flex-1"><p class="display h-md m-0">Falta alguém?</p><p class="m-0 mt-1 font-semibold opacity-75">Um link, um toque, estão dentro.</p></div>
        <button class="btn btn-ink" @click="makeInvite"><UserPlus :size="17" /> Convidar</button>
      </div>
      <div v-else class="flex flex-col gap-3">
        <p class="display h-md m-0">Link pronto.</p>
        <code class="invite-link">{{ invite }}</code>
        <div class="flex gap-2">
          <button class="btn btn-ink flex-1" @click="shareInvite"><Share2 :size="16" /> Enviar no WhatsApp</button>
          <button class="btn btn-ink" :aria-label="copied ? 'Copiado' : 'Copiar'" @click="copy"><component :is="copied ? Check : Copy" :size="16" /></button>
        </div>
        <p class="text-xs font-semibold opacity-70 m-0">Válido 7 dias, até 10 pessoas.</p>
      </div>
    </section>
    <p v-else class="muted">Só o dono da comunidade pode gerar convites.</p>

    <!-- members -->
    <section class="stagger flex flex-col">
      <div v-for="m in crew.members.value" :key="m.user_id" class="member">
        <Avatar :name="m.name" :color="m.color" :vibe="m.vibe" :size="52" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2"><strong class="truncate text-lg">{{ m.name }}</strong><Crown v-if="m.role === 'owner'" :size="15" class="t-lime" /><span v-if="m.user_id === me?.id" class="faint text-sm">(tu)</span></div>
          <p v-if="m.vibe" class="m-0 text-sm"><span class="tag" :class="`fill-${VIBES[m.vibe].color}`">{{ VIBES[m.vibe].label }}</span><span v-if="m.vibe_note" class="muted ml-2">{{ m.vibe_note }}</span></p>
          <div class="flex flex-wrap gap-1 mt-2">
            <span v-for="b in badges[m.user_id] || []" :key="b.label" class="tag badge" :class="`fill-${b.color}`">{{ b.label }}</span>
          </div>
        </div>
        <NuxtLink v-if="m.user_id !== me?.id" :to="`/messages/${m.user_id}`" class="icon-btn msg-btn" :aria-label="`Mensagem para ${m.name}`"><Send :size="16" /></NuxtLink>
        <div class="stat-col">
          <span><b class="num">{{ stats[m.user_id]?.posts || 0 }}</b> posts</span>
          <span><b class="num">{{ stats[m.user_id]?.plans || 0 }}</b> planos</span>
        </div>
      </div>
    </section>

    <!-- discord -->
    <section v-if="crew.isOwner.value" class="panel">
      <button class="discord-toggle" @click="showDiscord = !showDiscord">
        <MessageSquare :size="18" class="t-sky" />
        <span class="flex-1 text-left"><b>Discord</b> <span class="muted text-sm">{{ webhook ? '· ligado' : '· desligado' }}</span></span>
        <ChevronDown :size="18" :style="{ transform: showDiscord ? 'rotate(180deg)' : '', transition: 'transform 200ms' }" />
      </button>
      <Transition name="fade">
        <div v-if="showDiscord" class="px-4 pb-4 flex flex-col gap-3">
          <p class="muted text-sm m-0">No Discord: <b class="text-[var(--paper)]">Editar canal → Integrações → Webhooks → Novo → Copiar URL</b>. O canal recebe os planos e clips novos.</p>
          <input v-model="webhook" class="field" placeholder="https://discord.com/api/webhooks/…" autocomplete="off">
          <button class="btn btn-ghost" :disabled="savingHook" @click="saveDiscord">{{ savingHook ? 'A guardar…' : 'Guardar' }}</button>
        </div>
      </Transition>
    </section>

    <DeleteCommunity v-if="crew.isOwner.value" />
  </div>
</template>

<style scoped>
.malta { display: flex; flex-direction: column; gap: 22px; }
.crew-name { margin: 6px 0 0; overflow-wrap: anywhere; }
.invite { padding: 20px; transform: rotate(-.8deg); }
.btn-ink { background: var(--ink); color: var(--paper); border-color: #000; }
.invite-link { display: block; padding: 10px 12px; border: 2px solid #000; border-radius: 12px; background: #ffffff66; font-size: 12px; overflow-wrap: anywhere; }
.member { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1.5px solid var(--line); }
.badge { border: 1.5px solid #000; transform: rotate(-2deg); }
.badge:nth-child(even) { transform: rotate(2deg); }
.msg-btn { flex: none; }
.stat-col { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: var(--muted); font-size: 12px; white-space: nowrap; }
.stat-col b { color: var(--paper); font-size: 15px; }
.discord-toggle { display: flex; align-items: center; gap: 12px; width: 100%; padding: 16px; background: none; border: 0; }
</style>
