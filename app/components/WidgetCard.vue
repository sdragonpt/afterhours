<script setup lang="ts">
import { LayoutGrid, Copy, RefreshCw, Download } from 'lucide-vue-next'
import template from '~/assets/afterhours-widget.js?raw'

const supabase = useSupabaseClient()
const community = useCommunity()
const crew = useCrew()
const toast = useToast()
const token = ref('')
const busy = ref(false)
const site = typeof window !== 'undefined' ? window.location.origin : 'https://afterhours-malta.vercel.app'
const script = computed(() => token.value ? template.replace('__TOKEN__', token.value).replace('__SITE__', site) : '')

async function generate(rotate = false) {
  if (!community.value) return
  if (rotate && !confirm('Gerar um código novo? O widget antigo deixa de funcionar até colares o script novo.')) return
  busy.value = true
  const { data, error } = await supabase.rpc('widget_token', { p_group: community.value, p_rotate: rotate })
  busy.value = false
  if (error) return toast.error(error.message)
  token.value = data as string
  if (rotate) toast.ok('Código novo gerado')
}
async function copy() {
  await navigator.clipboard.writeText(script.value)
  toast.ok('Script copiado')
}
</script>

<template>
  <section class="panel p-4 flex flex-col gap-3">
    <div class="flex items-start gap-3">
      <span class="ico fill-sky"><LayoutGrid :size="20" /></span>
      <div class="flex-1 min-w-0">
        <strong class="block">Widget no iPhone</strong>
        <p class="m-0 muted text-sm">Próximo plano, lobbies abertos e o teu saldo do Tab, no ecrã principal. Usa a app gratuita <b>Scriptable</b>.</p>
      </div>
    </div>

    <button v-if="!token" class="btn btn-ghost btn-block" :disabled="busy" @click="generate()">{{ busy ? 'A preparar…' : 'Criar o meu widget' }}</button>

    <template v-else>
      <ol class="steps">
        <li>Instala o <a href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noopener"><b>Scriptable</b> <Download :size="12" class="inline" /></a> (grátis).</li>
        <li>Carrega em <b>Copiar script</b> aqui em baixo.</li>
        <li>No Scriptable: <b>+</b> (canto superior direito) → cola → dá-lhe o nome <b>Afterhours</b>.</li>
        <li>No ecrã principal: toque longo → <b>Editar</b> → <b>Adicionar widget</b> → <b>Scriptable</b> → escolhe o tamanho.</li>
        <li>Toque longo no widget → <b>Editar widget</b> → Script: <b>Afterhours</b>.</li>
      </ol>
      <button class="btn btn-primary btn-block" @click="copy"><Copy :size="16" /> Copiar script</button>
      <p class="faint text-xs m-0">
        Mostra dados de <b class="text-[var(--paper)]">{{ crew.group.value?.name }}</b>. O script tem um código pessoal: não o partilhes.
        <button class="underline" @click="generate(true)"><RefreshCw :size="11" class="inline" /> Gerar código novo</button>
      </p>
    </template>
  </section>
</template>

<style scoped>
.ico { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border: 2px solid #000; border-radius: 14px; box-shadow: 3px 3px 0 #000; }
.steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; color: var(--muted); font-size: 14px; }
.steps b { color: var(--paper); font-weight: 600; }
.steps a { color: var(--lime); text-decoration: underline; text-underline-offset: 3px; }
</style>
