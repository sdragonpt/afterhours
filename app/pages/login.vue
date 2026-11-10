<script setup lang="ts">
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const mode = ref<'login'|'signup'>('login')
const busy = ref(false)
const message = ref('')
async function submit() {
  busy.value = true; message.value = ''
  try {
    const result = mode.value === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      : await supabase.auth.signUp({ email: email.value, password: password.value })
    if (result.error) throw result.error
    if (mode.value === 'signup' && !result.data.session) message.value = 'Verifica o teu email para confirmar a conta.'
    else await navigateTo('/')
  } catch (e: any) { message.value = e.message ?? 'Ocorreu um erro.' }
  finally { busy.value = false }
}
</script>
<template>
  <main class="min-h-screen grid place-items-center p-6"><section class="panel w-full max-w-md space-y-5">
    <div><p class="text-violet-400 font-bold tracking-[.25em] text-xs">YOUR PEOPLE. YOUR WORLD.</p><h1 class="text-4xl font-extrabold mt-2">AFTERHOURS<span class="text-violet-400">.</span></h1><p class="text-zinc-400 mt-2">A tua comunidade, fora do horário.</p></div>
    <form class="space-y-3" @submit.prevent="submit"><input v-model="email" class="input" type="email" placeholder="Email" required autocomplete="email"><input v-model="password" class="input" type="password" placeholder="Password (mín. 6 caracteres)" minlength="6" required><button class="btn w-full" :disabled="busy">{{ busy ? 'Aguarda...' : mode === 'login' ? 'Entrar' : 'Criar conta' }}</button></form>
    <p v-if="message" role="status" class="text-sm text-violet-300">{{ message }}</p>
    <button class="text-sm text-zinc-400 hover:text-white" @click="mode = mode === 'login' ? 'signup' : 'login'">{{ mode === 'login' ? 'Ainda não tens conta? Regista-te' : 'Já tens conta? Entra' }}</button>
  </section></main>
</template>
