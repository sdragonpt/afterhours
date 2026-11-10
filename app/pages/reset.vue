<script setup lang="ts">
// Landing page of the "Esqueci-me da password" email. Supabase puts a recovery
// session in the URL; the client picks it up, then we let the user set a new password.
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const user = useMe()
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const message = ref('')
const done = ref(false)
const waited = ref(false)

onMounted(() => setTimeout(() => (waited.value = true), 2500))
const mismatch = computed(() => !!confirm.value && password.value !== confirm.value)

async function save() {
  if (password.value.length < 6 || mismatch.value) return
  busy.value = true; message.value = ''
  const { error } = await supabase.auth.updateUser({ password: password.value })
  busy.value = false
  if (error) { message.value = error.message.includes('different from the old') ? 'A password nova tem de ser diferente da antiga.' : error.message; return }
  done.value = true
  celebrate()
  setTimeout(() => navigateTo('/', { replace: true }), 1400)
}
</script>

<template>
  <main class="reset">
    <section class="w-full max-w-sm flex flex-col gap-4">
      <p class="kicker">Conta</p>
      <template v-if="done">
        <h1 class="display h-lg m-0">Password nova guardada<span class="t-lime">.</span></h1>
        <p class="muted m-0">A entrar…</p>
      </template>
      <template v-else-if="user">
        <h1 class="display h-lg m-0">Escolhe uma password nova<span class="t-lime">.</span></h1>
        <form class="flex flex-col gap-3" @submit.prevent="save">
          <input v-model="password" class="field" type="password" minlength="6" required autocomplete="new-password" placeholder="Password nova (mín. 6)">
          <input v-model="confirm" class="field" type="password" minlength="6" required autocomplete="new-password" placeholder="Repete a password">
          <p v-if="mismatch" class="t-coral font-bold m-0 text-sm">As passwords não coincidem.</p>
          <p v-if="message" role="alert" class="t-coral font-bold m-0 text-sm">{{ message }}</p>
          <button class="btn btn-primary btn-block" :disabled="busy || mismatch || password.length < 6">{{ busy ? 'A guardar…' : 'Guardar password' }}</button>
        </form>
      </template>
      <template v-else-if="waited">
        <h1 class="display h-lg m-0">Este link já não serve<span class="t-coral">.</span></h1>
        <p class="muted m-0">Os links de recuperação expiram ao fim de pouco tempo e só funcionam uma vez. Pede um novo.</p>
        <NuxtLink to="/login" class="btn btn-primary btn-block">Pedir link novo</NuxtLink>
      </template>
      <h1 v-else class="display h-lg m-0">A verificar o link…</h1>
    </section>
  </main>
</template>

<style scoped>
.reset { min-height: 100dvh; display: grid; place-items: center; padding: 24px 18px; }
</style>
