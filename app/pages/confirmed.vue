<script setup lang="ts">
// Landing page of the sign-up confirmation email. Supabase puts the session in the URL;
// the client picks it up. If something went wrong, Supabase sends ?error / #error_description.
definePageMeta({ layout: false })
const user = useMe()
const route = useRoute()
const waited = ref(false)

const errorText = computed(() => {
  const hash = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)) : new URLSearchParams()
  const code = (route.query.error_code as string) || hash.get('error_code') || ''
  const desc = (route.query.error_description as string) || hash.get('error_description') || ''
  if (!code && !desc) return ''
  if (code === 'otp_expired' || /expired/i.test(desc)) return 'Este link de confirmação expirou ou já foi usado.'
  return desc.replace(/\+/g, ' ')
})
const standalone = computed(() => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone))

onMounted(() => {
  setTimeout(() => (waited.value = true), 2000)
  if (!errorText.value) celebrate()
})
function enter() { navigateTo('/', { replace: true }) }
</script>

<template>
  <main class="confirmed">
    <section class="w-full max-w-sm flex flex-col gap-4">
      <p class="kicker">Conta</p>

      <template v-if="errorText">
        <h1 class="display h-lg m-0">Ups<span class="t-coral">.</span></h1>
        <p class="muted m-0">{{ errorText }}</p>
        <p class="muted m-0">Se já confirmaste antes, é só entrares com o teu email e password.</p>
        <NuxtLink to="/login" class="btn btn-primary btn-block">Ir para o login</NuxtLink>
      </template>

      <template v-else>
        <h1 class="display h-lg m-0">Conta confirmada<span class="t-lime">.</span></h1>
        <template v-if="user">
          <p class="muted m-0">Estás dentro. Bem-vindo à malta.</p>
          <button class="btn btn-primary btn-block" @click="enter">Entrar na app</button>
        </template>
        <template v-else-if="waited">
          <p class="muted m-0">Já podes entrar com o email e a password que escolheste.</p>
          <NuxtLink to="/login" class="btn btn-primary btn-block">Entrar</NuxtLink>
        </template>
        <p v-else class="muted m-0">A entrar…</p>

        <div v-if="!standalone" class="tip">
          <strong>Tens a app no ecrã principal do iPhone?</strong>
          <p class="m-0">Abre-a e entra lá com o mesmo email e password. O Safari e a app instalada não partilham a sessão.</p>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped>
.confirmed { min-height: 100dvh; display: grid; place-items: center; padding: 24px 18px; }
.tip { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--ink-2); font-size: 14px; color: var(--muted); }
.tip strong { color: var(--paper); }
</style>
