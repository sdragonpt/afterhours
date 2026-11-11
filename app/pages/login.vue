<script setup lang="ts">
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const user = useMe()
const route = useRoute()
const email = ref('')
const password = ref('')
const mode = ref<'login' | 'signup' | 'forgot'>('login')
const busy = ref(false)
const message = ref('')
const sent = ref<false | 'signup' | 'reset'>(false)
// bot check (Cloudflare Turnstile); Supabase verifies the token
const captcha = ref<{ reset: () => void; ready: (ms?: number) => Promise<string>; enabled: boolean } | null>(null)
const captchaToken = ref('')

// Only allow internal redirects (e.g. /join?token=...) to avoid open redirects.
const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/'
})
const isInvite = computed(() => redirectTo.value.startsWith('/join'))
if (isInvite.value) { mode.value = 'signup'; if (import.meta.client) rememberInvite(redirectTo.value) }

watchEffect(() => { if (user.value) navigateTo(redirectTo.value, { replace: true }) })

async function submit() {
  busy.value = true; message.value = ''
  try {
    // wait briefly for the bot check; without a token Supabase decides (rejects once CAPTCHA is enforced)
    const token = captcha.value?.enabled ? await captcha.value.ready(8000) : ''
    const captchaOpt = token ? { captchaToken: token } : {}
    if (mode.value === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo: `${window.location.origin}/reset`, ...captchaOpt })
      if (error) throw error
      sent.value = 'reset'; return
    }
    if (mode.value === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value, options: captchaOpt })
      if (error) throw error
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        // confirmation lands on /confirmed (always allowed); the invite is remembered on this device
        options: { emailRedirectTo: `${window.location.origin}/confirmed`, ...captchaOpt },
      })
      if (error) throw error
      if (!data.session) { sent.value = 'signup'; return }
    }
    await navigateTo(redirectTo.value, { replace: true })
  } catch (e: any) {
    message.value = friendlyAuthError(e)
  } finally {
    busy.value = false
    captcha.value?.reset() // tokens are single-use
  }
}

function friendlyAuthError(e: any) {
  const m = String(e?.message || '')
  if (m === 'captcha' || /captcha/i.test(m)) return 'Não deu para confirmar que és humano. Tenta outra vez.'
  if (m === 'Invalid login credentials') return 'Email ou password errados.'
  if (m === 'User already registered') return 'Já tens conta. Entra em vez disso.'
  if (m === 'Email not confirmed') return 'Confirma primeiro o email (vê a caixa de entrada e o spam).'
  if (e?.code === 'over_email_send_rate_limit' || /rate limit/i.test(m)) return 'Demasiados emails enviados agora. Tenta daqui a uns minutos.'
  if (e?.code === 'email_address_not_authorized') return 'O envio de emails ainda não está configurado. Fala com o dono da app.'
  return m || 'Ocorreu um erro.'
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
        <p v-if="sent === 'signup'" class="m-0 mt-2 font-semibold">Mandámos um link para <b>{{ email }}</b>. Abre-o neste telemóvel e entras logo{{ isInvite ? ' na comunidade' : '' }}.</p>
        <p v-else class="m-0 mt-2 font-semibold">Se existir uma conta com <b>{{ email }}</b>, recebes um link para escolher uma password nova. Vê também o spam.</p>
        <button class="btn btn-sm mt-4 back-btn" @click="sent = false; mode = 'login'">Voltar</button>
      </div>

      <form v-else class="card panel" @submit.prevent="submit">
        <p v-if="isInvite" class="invite-note fill-lime">Foste convidado. Cria conta para entrar.</p>
        <div v-if="mode === 'forgot'">
          <p class="display h-md m-0">Esqueceste-te?</p>
          <p class="muted m-0 mt-1 text-sm">Mete o teu email e mandamos um link para escolheres uma password nova.</p>
        </div>
        <div v-else class="seg">
          <button type="button" :class="{ on: mode === 'login' }" @click="mode = 'login'">Entrar</button>
          <button type="button" :class="{ on: mode === 'signup' }" @click="mode = 'signup'">Criar conta</button>
        </div>
        <input v-model="email" class="field" type="email" required autocomplete="email" placeholder="Email">
        <input v-if="mode !== 'forgot'" v-model="password" class="field" type="password" minlength="6" required :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" placeholder="Password (mín. 6)">
        <p v-if="message" role="alert" class="err">{{ message }}</p>
        <Turnstile ref="captcha" v-model="captchaToken" />
        <button class="btn btn-primary btn-block" :disabled="busy">{{ busy ? 'Aguarda…' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar link' : 'Criar conta' }}</button>
        <button v-if="mode === 'login'" type="button" class="link-btn" @click="mode = 'forgot'; message = ''">Esqueci-me da password</button>
        <button v-else-if="mode === 'forgot'" type="button" class="link-btn" @click="mode = 'login'; message = ''">Voltar ao login</button>
      </form>
      <p class="legal">{{ mode === 'signup' ? 'Ao criar conta aceitas a forma como tratamos os teus dados: ' : '' }}<NuxtLink to="/privacy">Privacidade</NuxtLink></p>
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
.link-btn { align-self: center; padding: 4px; border: 0; background: none; color: var(--muted); font-size: 14px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.link-btn:hover { color: var(--paper); }
.back-btn { background: var(--ink); color: var(--paper); border-color: #000; }
.legal { margin: 0; text-align: center; color: var(--faint); font-size: 12px; }
.legal a { color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
.err { margin: 0; color: var(--coral); font-weight: 700; font-size: 14px; }
</style>
