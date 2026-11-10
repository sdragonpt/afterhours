<script setup lang="ts">
import { Users, Copy, Check, ShieldCheck, UserPlus, LoaderCircle, Share2, MessageSquare } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
const supabase = useSupabaseClient()
const user = useMe()
const community = useCommunity()
const members = ref<any[]>([])
const group = ref<any>(null)
const loading = ref(false)
const isOwner = computed(() => !!user.value && group.value?.owner_id === user.value.id)
const error = ref('')
const success = ref('')
const invite = ref('')
const copied = ref(false)

const webhook = ref('')
const savingDiscord = ref(false)

async function load() {
  if (!community.value) { members.value = []; group.value = null; return }
  loading.value = true; error.value = ''; invite.value = ''
  const [groupResult, memberResult] = await Promise.all([
    supabase.from('groups').select('id,name,owner_id,created_at').eq('id', community.value).maybeSingle(),
    supabase.from('group_members').select('user_id,role,joined_at').eq('group_id', community.value).order('joined_at', { ascending: true }),
  ])
  if (groupResult.error) error.value = groupResult.error.message
  if (memberResult.error) error.value = memberResult.error.message
  group.value = groupResult.data
  const ids = (memberResult.data || []).map(m => m.user_id)
  const { data: people } = ids.length ? await supabase.from('profiles').select('id,display_name').in('id', ids) : { data: [] }
  members.value = (memberResult.data || []).map(m => ({ ...m, display_name: people?.find(p => p.id === m.user_id)?.display_name || 'Membro' }))
  if (isOwner.value) {
    const { data } = await supabase.from('group_integrations').select('discord_webhook_url').eq('group_id', community.value).maybeSingle()
    webhook.value = data?.discord_webhook_url || ''
  }
  loading.value = false
}

async function createInvite() {
  if (!community.value) return
  const { data, error: e } = await supabase.rpc('create_group_invite', { p_group: community.value })
  if (e) { error.value = e.message; return }
  invite.value = `${window.location.origin}/join?token=${data}`
}
async function copy() { await navigator.clipboard.writeText(invite.value); copied.value = true; setTimeout(() => copied.value = false, 1600) }
async function shareInvite() {
  await shareOut(`Junta-te à malta no Afterhours 🌙 (${group.value?.name})`, invite.value.replace(window.location.origin, ''))
}

async function saveDiscord() {
  if (!community.value) return
  savingDiscord.value = true; error.value = ''; success.value = ''
  const { error: e } = await supabase.from('group_integrations').upsert({
    group_id: community.value,
    discord_webhook_url: webhook.value.trim() || null,
    app_url: window.location.origin,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'group_id' })
  savingDiscord.value = false
  if (e) { error.value = e.message.includes('check constraint') ? 'Esse link não parece um webhook do Discord. Deve começar por https://discord.com/api/webhooks/' : e.message; return }
  success.value = webhook.value.trim() ? 'Discord ligado! Novos planos, clips e despesas vão aparecer no canal.' : 'Discord desligado.'
}

watch(community, load)
watch(() => user.value?.id, load)
onMounted(load)
</script>

<template>
  <div class="content-page">
    <header class="content-header">
      <div><span class="eyebrow"><Users :size="13"/> A MALTA</span><h1>{{ group?.name || 'A tua comunidade' }}<span class="accent-dot">.</span></h1><p>Círculo pequeno. Muita lore.</p></div>
      <button v-if="isOwner" class="primary-button" @click="createInvite"><UserPlus :size="15"/> Convidar</button>
    </header>
    <p v-if="error" class="notice error-notice">{{ error }}</p>
    <p v-if="success" class="notice success-notice">{{ success }}</p>

    <section v-if="invite" class="invite-panel surface-card">
      <div class="min-w-0"><strong>Link de convite criado</strong><p class="text-muted">Válido 7 dias, até 10 pessoas. Quem abrir entra logo (depois de criar conta).</p><code>{{ invite }}</code></div>
      <div class="flex gap-2">
        <button class="primary-button" @click="shareInvite"><Share2 :size="14"/> Enviar</button>
        <button class="secondary-button flex items-center gap-1" @click="copy"><component :is="copied ? Check : Copy" :size="13"/> {{ copied ? 'Copiado' : 'Copiar' }}</button>
      </div>
    </section>

    <div class="community-content">
      <section class="surface-card">
        <div class="section-head"><h2 class="surface-title">Membros</h2><span class="pill">{{ members.length }}</span></div>
        <div v-if="loading" class="loading-state"><LoaderCircle class="spin"/> A carregar…</div>
        <div v-else class="member-grid">
          <article v-for="member in members" :key="member.user_id" class="member-card">
            <span class="avatar member-avatar">{{ member.display_name.slice(0,1).toUpperCase() }}</span>
            <div><strong>{{ member.display_name }} <span v-if="member.user_id === user?.id" class="you-tag">TU</span></strong><small>{{ member.role === 'owner' ? 'Dono da comunidade' : 'Membro' }}</small></div>
            <ShieldCheck v-if="member.role === 'owner'" :size="15" class="owner-icon"/>
          </article>
        </div>
      </section>

      <aside class="flex flex-col gap-3">
        <section class="surface-card community-side">
          <span class="eyebrow"><MessageSquare :size="12"/> DISCORD</span>
          <h3>Avisos no vosso servidor.</h3>
          <template v-if="isOwner">
            <p>No Discord: <b>Editar canal → Integrações → Webhooks → Novo webhook → Copiar URL</b>. Cola aqui e o Afterhours avisa quando há planos, clips ou despesas novas.</p>
            <form @submit.prevent="saveDiscord">
              <input v-model="webhook" class="field" placeholder="https://discord.com/api/webhooks/…" autocomplete="off">
              <button class="secondary-button w-full mt-2" :disabled="savingDiscord">{{ savingDiscord ? 'A guardar…' : webhook ? 'Guardar' : 'Desligar' }}</button>
            </form>
          </template>
          <p v-else>Só o dono da comunidade pode ligar o Discord.</p>
        </section>
        <section class="surface-card community-side">
          <span class="eyebrow">CONVITES</span>
          <h3>Traz o resto da malta.</h3>
          <p v-if="isOwner">Gera um link e manda no grupo do WhatsApp. Um toque e estão dentro.</p>
          <button v-if="isOwner" class="secondary-button w-full" @click="createInvite"><UserPlus :size="14"/> Gerar link</button>
          <p v-else>Pede ao dono da comunidade para gerar um link.</p>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.invite-panel{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:16px}.invite-panel strong{font-size:12px}.invite-panel p{margin:4px 0 7px;font-size:10px}.invite-panel code{color:#b8a6ff;font-size:10px;overflow-wrap:anywhere}
.community-content{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px}
.member-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:15px}.member-card{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#11141b}.member-avatar{width:34px;height:34px}.member-card>div{min-width:0;flex:1}.member-card strong,.member-card small{display:block}.member-card strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.member-card small{margin-top:3px;color:#747c8d;font-size:9px}.owner-icon{color:#b6a4ff}
.community-side{background:radial-gradient(circle at 100% 0%,#8d75f020,transparent 45%),#171a23}.community-side h3{margin:10px 0 8px;font-family:'Space Grotesk';font-size:17px;line-height:1.15}.community-side p{margin:0 0 12px;color:#81899a;font-size:11px;line-height:1.6}.community-side p b{color:#c5b7ff;font-weight:600}.community-side button{display:flex;align-items:center;justify-content:center;gap:7px}.community-side .field{font-size:16px;margin-top:0}
@media(max-width:800px){.community-content{grid-template-columns:1fr}.invite-panel{align-items:flex-start;flex-direction:column}}
@media(max-width:420px){.member-grid{grid-template-columns:1fr}}
</style>
