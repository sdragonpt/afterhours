<script setup lang="ts">
import { Users, Copy, Check, Link2, ShieldCheck, UserPlus, LoaderCircle } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const community = useCommunity()
const members = ref<any[]>([])
const group = ref<any>(null)
const loading = ref(false)
const isOwner = computed(() => group.value?.owner_id === user.value?.id)
const error = ref('')
const invite = ref('')
const copied = ref(false)
async function load() {
  if (!community.value) { members.value = []; group.value = null; return }
  loading.value = true; error.value = ''
  const [groupResult, memberResult] = await Promise.all([
    supabase.from('groups').select('id,name,owner_id,created_at').eq('id',community.value).maybeSingle(),
    supabase.from('group_members').select('user_id,role,joined_at').eq('group_id',community.value).order('joined_at',{ascending:true}),
  ])
  if (groupResult.error) error.value = groupResult.error.message
  if (memberResult.error) error.value = memberResult.error.message
  group.value = groupResult.data
  const ids = (memberResult.data || []).map(m => m.user_id)
  const { data: people } = ids.length ? await supabase.from('profiles').select('id,display_name').in('id',ids) : { data: [] }
  members.value = (memberResult.data || []).map(m => ({ ...m, display_name: people?.find(p => p.id === m.user_id)?.display_name || (m.user_id === user.value?.id ? user.value.email : 'Member') }))
  loading.value = false
}
async function createInvite() {
  if (!community.value) return
  const { data, error: e } = await supabase.rpc('create_group_invite',{p_group:community.value})
  if (e) { error.value = e.message; return }
  invite.value = `${window.location.origin}/join?token=${data}`
}
async function copy() { await navigator.clipboard.writeText(invite.value); copied.value = true; setTimeout(()=>copied.value=false,1600) }
watch(community,load)
onMounted(load)
</script>
<template>
  <div class="content-page"><header class="content-header"><div><span class="eyebrow"><Users :size="13"/> THE CREW</span><h1>Your community<span class="accent-dot">.</span></h1><p>Small circle. Big lore.</p></div><button v-if="isOwner" class="primary-button" @click="createInvite"><UserPlus :size="15"/> Invite friends</button></header>
    <p v-if="error" class="notice error-notice">{{ error }}</p>
    <section class="community-banner"><div class="community-banner-icon">{{ group?.name?.slice(0,1).toUpperCase() || 'A' }}</div><div><span class="eyebrow">PRIVATE COMMUNITY</span><h2>{{ group?.name || 'Your space' }}</h2><p>{{ members.length }} members · Created {{ group?.created_at ? new Date(group.created_at).toLocaleDateString('pt-PT') : '—' }}</p></div><span class="private-tag"><ShieldCheck :size="13"/> PRIVATE</span></section>
    <section v-if="invite" class="invite-panel surface-card"><div><strong>Invite link created</strong><p class="text-muted">Anyone with this link can join until the invite expires or reaches its use limit.</p><code>{{ invite }}</code></div><button class="primary-button" @click="copy">{{ copied ? 'Copied!' : 'Copy link' }} <component :is="copied ? Check : Copy" :size="14"/></button></section>
    <div class="community-content"><section class="surface-card"><div class="section-head"><h2 class="surface-title">Members</h2><span class="pill">{{ members.length }} / 10+</span></div><div v-if="loading" class="loading-state"><LoaderCircle class="spin"/> Loading members...</div><div v-else class="member-grid"><article v-for="member in members" :key="member.user_id" class="member-card"><span class="avatar member-avatar">{{ member.display_name.slice(0,1).toUpperCase() }}</span><div><strong>{{ member.display_name }} <span v-if="member.user_id===user?.id" class="you-tag">YOU</span></strong><small>{{ member.role === 'owner' ? 'Community owner' : 'Member' }}</small></div><ShieldCheck v-if="member.role==='owner'" :size="15" class="owner-icon"/></article></div><p v-if="!loading && !members.length" class="empty-inline">No members yet.</p></section>
      <aside class="surface-card community-side"><span class="eyebrow">GROW THE CIRCLE</span><h3>Good people<br/>make good stories.</h3><p>Bring the rest of the crew in. One invite link and they're part of the space.</p><button v-if="isOwner" class="secondary-button w-full" @click="createInvite"><Link2 :size="14"/> Generate invite link</button><p v-else class="text-muted text-[10px]">Ask the community owner to generate an invite link.</p></aside></div>
  </div>
</template>
<style scoped>
.community-banner{display:flex;align-items:center;gap:15px;padding:20px;border:1px solid #a18bff25;border-radius:14px;background:radial-gradient(circle at 85% 0%,#8d75f022,transparent 45%),#171923;margin-bottom:16px}.community-banner-icon{display:grid;place-items:center;width:54px;height:54px;border-radius:15px;background:linear-gradient(145deg,#b5a3ff,#6c55d5);color:#171321;font-family:'Space Grotesk';font-size:24px;font-weight:800}.community-banner h2{margin:5px 0 3px;font-family:'Space Grotesk';font-size:20px}.community-banner p{margin:0;color:#7f8798;font-size:10px}.private-tag{display:flex;align-items:center;gap:5px;margin-left:auto;color:#9ce2c2;font-size:8px;font-weight:800;letter-spacing:.1em}.invite-panel{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:16px}.invite-panel strong{font-size:11px}.invite-panel p{margin:4px 0 7px;font-size:9px}.invite-panel code{color:#b8a6ff;font-size:9px;overflow-wrap:anywhere}.community-content{display:grid;grid-template-columns:minmax(0,1fr) 245px;gap:14px}.section-head{display:flex;align-items:center;justify-content:space-between}.section-head .surface-title{margin:0}.member-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:15px}.member-card{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#11141b}.member-avatar{width:34px;height:34px}.member-card>div{min-width:0;flex:1}.member-card strong,.member-card small{display:block}.member-card strong{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.member-card small{margin-top:3px;color:#747c8d;font-size:8px}.owner-icon{color:#b6a4ff}.community-side{background:radial-gradient(circle at 100% 0%,#8d75f020,transparent 45%),#171a23}.community-side h3{margin:12px 0 8px;font-family:'Space Grotesk';font-size:19px;line-height:1.15}.community-side p{margin:0 0 17px;color:#81899a;font-size:10px;line-height:1.6}.community-side button{display:flex;align-items:center;justify-content:center;gap:7px}@media(max-width:700px){.community-content{grid-template-columns:1fr}.member-grid{grid-template-columns:1fr 1fr}.invite-panel{align-items:flex-start;flex-direction:column}.community-banner{align-items:flex-start}.private-tag{font-size:7px}}@media(max-width:420px){.member-grid{grid-template-columns:1fr}}
</style>
