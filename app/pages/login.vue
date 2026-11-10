<script setup lang="ts">
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const user = useMe()
const route = useRoute()
const email = ref('')
const password = ref('')
const mode = ref<'login' | 'signup'>('login')
const busy = ref(false)
const message = ref('')

// Only allow internal redirects (e.g. /join?token=...) to avoid open redirects.
const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/'
})
const isInvite = computed(() => redirectTo.value.startsWith('/join'))
if (isInvite.value) mode.value = 'signup'

watchEffect(() => { if (user.value) navigateTo(redirectTo.value, { replace: true }) })

async function submit() {
  busy.value = true; message.value = ''
  try {
    if (mode.value === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      if (error) throw error
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: { emailRedirectTo: `${window.location.origin}${redirectTo.value}` },
      })
      if (error) throw error
      if (!data.session) { message.value = 'Conta criada! Confirma o email e volta a abrir o link.'; return }
    }
    await navigateTo(redirectTo.value, { replace: true })
  } catch (e: any) {
    message.value = e.message === 'Invalid login credentials' ? 'Email ou password errados.' : (e.message ?? 'Ocorreu um erro.')
  } finally { busy.value = false }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <span class="brand-mark">A<span>.</span></span>
      <p class="eyebrow mt-6">YOUR PEOPLE. YOUR WORLD.</p>
      <h1 class="auth-title">AFTERHOURS<span class="accent-dot">.</span></h1>
      <p v-if="isInvite" class="notice success-notice mt-3">Foste convidado para uma comunidade. Cria conta (ou entra) para aceitar.</p>
      <p v-else class="page-subtitle mt-2">A tua malta, fora do horário.</p>

      <div class="auth-tabs">
        <button :class="{ selected: mode === 'login' }" type="button" @click="mode = 'login'">Entrar</button>
        <button :class="{ selected: mode === 'signup' }" type="button" @click="mode = 'signup'">Criar conta</button>
      </div>

      <form class="stack-form" @submit.prevent="submit">
        <label>Email<input v-model="email" class="field" type="email" required autocomplete="email" placeholder="tu@exemplo.com"></label>
        <label class="mt-3">Password<input v-model="password" class="field" type="password" minlength="6" required :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" placeholder="Mínimo 6 caracteres"></label>
        <button class="primary-button mt-5" :disabled="busy">{{ busy ? 'Aguarda…' : mode === 'login' ? 'Entrar' : 'Criar conta' }}</button>
      </form>
      <p v-if="message" role="status" class="form-error mt-3">{{ message }}</p>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% -10%,rgba(106,79,214,.18),transparent 50%),var(--bg)}
.auth-card{width:min(100%,400px);padding:28px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,#171a23,#12141b)}
.auth-title{margin:8px 0 0;font-family:'Space Grotesk',sans-serif;font-size:32px;letter-spacing:.02em}
.auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:22px 0 18px;padding:4px;border:1px solid var(--line);border-radius:10px;background:#0e1118}
.auth-tabs button{padding:9px;border:0;border-radius:7px;background:transparent;color:#8a90a1;font-size:12px;font-weight:700}
.auth-tabs button.selected{background:#a18bff20;color:#d0c5ff}
.auth-card .stack-form label{font-size:11px}
.auth-card .field{font-size:16px} /* 16px prevents iOS zoom on focus */
</style>
