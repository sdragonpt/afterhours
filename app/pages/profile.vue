<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const me = useMe()
const crew = useCrew()
const toast = useToast()
const name = ref('')
const color = ref('lime')
const saving = ref(false)

watchEffect(() => {
  if (crew.meMember.value && !name.value) { name.value = crew.meMember.value.name; color.value = crew.meMember.value.color }
})

async function save(e: MouseEvent) {
  if (!me.value || !name.value.trim()) return
  saving.value = true
  const { error } = await supabase.from('profiles').upsert({ id: me.value.id, display_name: name.value.trim(), avatar_color: color.value }, { onConflict: 'id' })
  saving.value = false
  if (error) return toast.error(error.message)
  await crew.loadMembers(true)
  celebrate(originFrom(e))
  toast.ok('Perfil atualizado')
}
async function signOut() { await supabase.auth.signOut(); navigateTo('/login') }
</script>

<template>
  <div class="profile">
    <div class="hero">
      <Transition name="fade" mode="out-in">
        <Avatar :key="color + name" :name="name || '?'" :color="color" :size="120" />
      </Transition>
      <p class="kicker mt-4">{{ me?.email }}</p>
    </div>

    <section class="flex flex-col gap-5">
      <div>
        <label class="label" for="name">Nome</label>
        <input id="name" v-model="name" class="field name-field" maxlength="40" placeholder="Como te chamam">
      </div>
      <div>
        <span class="label">Cor</span>
        <div class="swatches">
          <button v-for="c in AVATAR_COLORS" :key="c" class="swatch" :class="[`fill-${c}`, { on: color === c }]" :aria-label="c" @click="color = c" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" :disabled="saving || !name.trim()" @click="save">{{ saving ? 'A guardar…' : 'Guardar' }}</button>
    </section>

    <NotifyCard />

    <section class="panel p-4">
      <p class="kicker m-0 mb-3">A tua vibe agora</p>
      <VibePicker />
    </section>

    <button class="btn btn-ghost btn-block" @click="signOut"><LogOut :size="17" /> Sair da conta</button>
  </div>
</template>

<style scoped>
.profile { display: flex; flex-direction: column; gap: 26px; }
.hero { display: flex; flex-direction: column; align-items: center; padding-top: 16px; }
.name-field { font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: -.02em; }
.swatches { display: flex; gap: 12px; flex-wrap: wrap; }
.swatch { width: 46px; height: 46px; border: 2px solid #000; border-radius: 999px; box-shadow: 3px 3px 0 #000; transition: transform var(--base) var(--ease-spring); }
.swatch:active { transform: scale(.9); }
.swatch.on { transform: scale(1.12) rotate(-6deg); outline: 3px solid var(--paper); outline-offset: 3px; }
</style>
