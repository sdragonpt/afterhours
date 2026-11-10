<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })
const route = useRoute()
const supabase = useSupabaseClient()
const community = useCommunity()
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const status = ref('')
const busy = ref(false)

async function join() {
  if (!token.value.trim()) return
  busy.value = true; status.value = ''
  const { data, error } = await supabase.rpc('join_group_by_invite', { p_token: token.value.trim() })
  busy.value = false
  if (error) { status.value = error.message.includes('invalid input syntax') ? 'Código de convite inválido.' : error.message === 'Invalid or expired invite' ? 'Este convite expirou ou já foi usado demasiadas vezes. Pede um novo.' : error.message; return }
  community.value = data as string
  await navigateTo('/', { replace: true })
}

// Invite links opened from WhatsApp/Discord join straight away — one tap.
onMounted(() => { if (token.value) join() })
</script>

<template>
  <main class="join-page">
    <div class="surface-card join-card">
      <span class="eyebrow">CONVITE</span>
      <h1>Entrar numa comunidade<span class="accent-dot">.</span></h1>
      <p v-if="busy" class="text-muted">A entrar…</p>
      <template v-else>
        <p class="text-muted">Cola aqui o código ou o link que recebeste.</p>
        <form class="stack-form" @submit.prevent="join">
          <input v-model="token" class="field" required placeholder="Código de convite">
          <button class="primary-button mt-3" :disabled="busy">Entrar</button>
        </form>
        <p v-if="status" class="form-error">{{ status }}</p>
      </template>
      <NuxtLink to="/" class="text-link mt-4">← Voltar</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.join-page{min-height:100dvh;display:grid;place-items:center;padding:24px}
.join-card{width:min(100%,420px);padding:26px}
.join-card h1{margin:8px 0 6px;font-family:'Space Grotesk';font-size:24px}
.join-card p{font-size:12px}
.join-card .field{font-size:16px}
</style>
