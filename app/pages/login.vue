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
const sent = ref(false)

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
      if (!data.session) { sent.value = true; return }
    }
    await navigateTo(redirectTo.value, { replace: true })
  } catch (e: any) {
    message.value = e.message === 'Invalid login credentials' ? 'Email ou password errados.' : e.message === 'User already registered' ? 'Já tens conta. Entra em vez disso.' : (e.message ?? 'Ocorreu um erro.')
  } finally { busy.value = false }
}
</script>

<template>
  <main class="auth">
    <div class="poster-stack" aria-hidden="true">
      <span class="chip-deco fill-coral" style="--r:-8deg;top:8%;left:-4%">Bora sair</span>
      <span class="chip-deco fill-sky" style="--r:6deg;top:14%;right:-6%">CS às 22h?</span>
      <span class="chip-deco fill-sun" style="--r:-4deg;bottom:22%;right:-2%">Deves 12€</span>
      <span class="chip-deco fill-pink" style="--r:7deg;bottom:30%;left:-6%">🔥 4</span>
    </div>

    <section class="auth-inner">
      <h1 class="display wordmark">after<br>hours<span class="t-lime">.</span></h1>
      <p class="tagline">A tua malta. Os vossos planos, clips e contas, num só sítio.</p>

      <div v-if="sent" class="card sticker fill-lime">
        <p class="display h-md m-0">Vê o teu email.</p>
        <p class="m-0 mt-2 font-semibold">Mandámos um link para <b>{{ email }}</b>. Abre-o neste telemóvel e entras logo{{ isInvite ? ' na comunidade' : '' }}.</p>
      </div>

      <form v-else class="card panel" @submit.prevent="submit">
        <p v-if="isInvite" class="invite-note fill-lime">Foste convidado. Cria conta para entrar.</p>
        <div class="seg">
          <button type="button" :class="{ on: mode === 'login' }" @click="mode = 'login'">Entrar</button>
          <button type="button" :class="{ on: mode === 'signup' }" @click="mode = 'signup'">Criar conta</button>
        </div>
        <input v-model="email" class="field" type="email" required autocomplete="email" placeholder="Email">
        <input v-model="password" class="field" type="password" minlength="6" required :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" placeholder="Password (mín. 6)">
        <p v-if="message" role="alert" class="err">{{ message }}</p>
        <button class="btn btn-primary btn-block" :disabled="busy">{{ busy ? 'Aguarda…' : mode === 'login' ? 'Entrar' : 'Criar conta' }}</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.auth { position: relative; min-height: 100dvh; overflow: hidden; display: grid; place-items: center; padding: 24px 18px; }
.poster-stack { position: absolute; inset: 0; pointer-events: none; }
.chip-deco { position: absolute; padding: 10px 16px; border: 2px solid #000; border-radius: 999px; font-family: var(--font-display); font-weight: 800; font-size: 18px; box-shadow: 4px 4px 0 #000; transform: rotate(var(--r)); animation: float-in 600ms var(--ease-spring) both; opacity: .9; }
.chip-deco:nth-child(2) { animation-delay: 80ms; } .chip-deco:nth-child(3) { animation-delay: 160ms; } .chip-deco:nth-child(4) { animation-delay: 240ms; }
@keyframes float-in { from { opacity: 0; transform: translateY(30px) rotate(0deg) scale(.8); } }
.auth-inner { position: relative; z-index: 1; width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 18px; }
.wordmark { margin: 0; font-size: clamp(76px, 25vw, 120px); line-height: .82; }
.tagline { margin: 0; color: var(--muted); font-size: 17px; font-weight: 500; text-wrap: balance; }
.card { display: flex; flex-direction: column; gap: 12px; padding: 18px; }
.invite-note { margin: 0; padding: 10px 14px; border: 2px solid #000; border-radius: 12px; font-weight: 800; }
.seg { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border: 1.5px solid var(--line-strong); border-radius: 999px; }
.seg button { height: 40px; border: 0; border-radius: 999px; background: none; color: var(--muted); font-weight: 700; transition: background-color var(--fast), color var(--fast); }
.seg button.on { background: var(--paper); color: var(--on-color); }
.err { margin: 0; color: var(--coral); font-weight: 700; font-size: 14px; }
</style>
