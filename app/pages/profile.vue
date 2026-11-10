<script setup lang="ts">
import { UserRound, Save, LogOut, ShieldCheck, LoaderCircle } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })
const supabase = useSupabaseClient()
const user = useMe()
const displayName = ref('')
const loading = ref(false)
const initialLoading = ref(true)
const error = ref('')
const success = ref('')
onMounted(async () => {
  if (!user.value) { initialLoading.value = false; return }
  const { data, error: e } = await supabase.from('profiles').select('display_name').eq('id', user.value.id).maybeSingle()
  if (e) error.value = `${e.message}${e.code ? ` (${e.code})` : ''}`
  displayName.value = data?.display_name || user.value.email?.split('@')[0] || ''
  initialLoading.value = false
})
async function save() {
  if (!user.value || !displayName.value.trim()) return
  loading.value = true; error.value = ''; success.value = ''
  const { error: e } = await supabase.from('profiles').upsert({ id: user.value.id, display_name: displayName.value.trim() }, { onConflict: 'id' })
  loading.value = false
  if (e) { error.value = `${e.message}${e.code ? ` (${e.code})` : ''}`; return }
  success.value = 'Nome atualizado com sucesso.'
}
async function signOut() { await supabase.auth.signOut(); await navigateTo('/login') }
</script>
<template>
  <div class="content-page profile-page"><header class="content-header"><div><span class="eyebrow"><UserRound :size="13"/> YOUR IDENTITY</span><h1>Profile settings<span class="accent-dot">.</span></h1><p>Make yourself at home.</p></div></header>
    <p v-if="error" class="notice error-notice">{{ error }}</p><p v-if="success" class="notice success-notice">{{ success }}</p>
    <section class="surface-card profile-card"><div class="profile-avatar"><UserRound :size="30"/></div><div class="profile-form"><h2>Personal details</h2><p class="text-muted">This is how your crew sees you around Afterhours.</p><form @submit.prevent="save"><label>Display name<input v-model="displayName" class="field" maxlength="40" required placeholder="Your name"/></label><label>Email address<input :value="user?.email || ''" class="field" disabled/></label><button class="primary-button" :disabled="loading || initialLoading"><LoaderCircle v-if="loading" class="spin" :size="14"/><Save v-else :size="14"/> {{ loading ? 'A guardar...' : 'Guardar alterações' }}</button></form></div></section>
    <section class="surface-card security-card"><div><ShieldCheck :size="19"/><div><strong>Account security</strong><p class="text-muted">Your account is protected by Supabase authentication.</p></div></div><button class="secondary-button" @click="signOut"><LogOut :size="14"/> Sign out</button></section>
  </div>
</template>
<style scoped>
.profile-card{display:flex;gap:23px;max-width:680px;padding:24px}.profile-avatar{display:grid;place-items:center;width:66px;height:66px;flex:none;border:1px solid #a18bff35;border-radius:20px;background:#a18bff18;color:#b9a7ff}.profile-form{flex:1}.profile-form h2{margin:0;font-family:'Space Grotesk';font-size:17px}.profile-form>p{margin:5px 0 18px;font-size:10px}.profile-form form{display:flex;flex-direction:column;gap:13px}.profile-form label{color:#a7adbc;font-size:10px;font-weight:700}.profile-form .field{margin-top:7px}.profile-form .field:disabled{opacity:.55}.profile-form .primary-button{align-self:flex-start;margin-top:5px}.security-card{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:680px;margin-top:13px}.security-card>div{display:flex;align-items:center;gap:12px;color:#b9a7ff}.security-card strong{color:#e4e6ee;font-size:11px}.security-card p{margin:4px 0 0;font-size:9px}@media(max-width:550px){.profile-card{flex-direction:column;padding:17px}.security-card{align-items:flex-start;flex-direction:column}}
</style>
