<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })
const route = useRoute()
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const status = ref('')
const busy = ref(false)
const supabase = useSupabaseClient()
async function join() {
  busy.value = true; status.value = ''
  const { error } = await supabase.rpc('join_group_by_invite', { p_token: token.value.trim() })
  busy.value = false
  if (error) status.value = error.message
  else await navigateTo('/')
}
</script>
<template><main class="min-h-screen grid place-items-center p-6"><div class="panel w-full max-w-md space-y-4"><h1 class="text-2xl font-bold">Entrar numa comunidade</h1><p class="text-zinc-400 text-sm">Insere o código de convite fornecido por um membro.</p><form class="space-y-3" @submit.prevent="join"><input v-model="token" class="input" required placeholder="Código de convite"><button class="btn w-full" :disabled="busy">Entrar</button></form><p v-if="status" class="text-red-300">{{ status }}</p><NuxtLink to="/" class="text-violet-300 text-sm">Voltar ao feed</NuxtLink></div></main></template>
