<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })
const route = useRoute()
const supabase = useSupabaseClient()
const community = useCommunity()
const crew = useCrew()
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const status = ref('')
const busy = ref(false)
const joined = ref(false)

async function join() {
  if (!token.value.trim()) return
  // accept a pasted full link as well as the bare code
  const code = token.value.trim().match(/[0-9a-f-]{36}/i)?.[0] || token.value.trim()
  busy.value = true; status.value = ''
  const { data, error } = await supabase.rpc('join_group_by_invite', { p_token: code })
  busy.value = false
  if (error) { status.value = error.message.includes('invalid input syntax') ? 'Código inválido.' : error.message === 'Invalid or expired invite' ? 'Este convite expirou ou já foi usado. Pede um novo.' : error.message; return }
  community.value = data as string
  await crew.loadGroups()
  await crew.loadMembers(true)
  joined.value = true
  celebrate()
  setTimeout(() => navigateTo('/', { replace: true }), 1400)
}
onMounted(() => { if (token.value) join() })
</script>

<template>
  <main class="join">
    <Transition name="fade" mode="out-in">
      <section v-if="joined" key="ok" class="text-center">
        <h1 class="display h-xl">Tás dentro<span class="t-lime">.</span></h1>
        <p class="muted">Bem-vindo à malta.</p>
      </section>
      <section v-else-if="busy" key="busy" class="text-center"><h1 class="display h-lg">A entrar…</h1></section>
      <section v-else key="form" class="w-full max-w-sm flex flex-col gap-4">
        <p class="kicker">Convite</p>
        <h1 class="display h-lg m-0">Cola o link ou o código<span class="t-lime">.</span></h1>
        <form class="flex flex-col gap-3" @submit.prevent="join">
          <input v-model="token" class="field" required placeholder="https://…/join?token=…">
          <button class="btn btn-primary btn-block">Entrar</button>
        </form>
        <p v-if="status" class="t-coral font-bold m-0">{{ status }}</p>
        <NuxtLink to="/" class="muted text-center">Voltar</NuxtLink>
      </section>
    </Transition>
  </main>
</template>

<style scoped>
.join { min-height: 100dvh; display: grid; place-items: center; padding: 24px 18px; }
</style>
