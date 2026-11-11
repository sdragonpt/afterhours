<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const is404 = computed(() => props.error?.statusCode === 404)
useHead({ title: is404.value ? 'Página perdida · Afterhours' : 'Ups · Afterhours' })

const LINES = [
  'Esta página foi para outra festa.',
  'Procurámos debaixo do sofá. Nada.',
  'Nem o lobby encontrou isto.',
  'Este link já deu o que tinha a dar.',
]
const line = LINES[Math.floor(Math.random() * LINES.length)]
function home() { clearError({ redirect: '/' }) }
function back() { if (history.length > 1) { clearError(); history.back() } else home() }
</script>

<template>
  <main class="err">
    <div class="stack">
      <div class="code display" aria-hidden="true">
        <span class="d d1">4</span><span class="d d0 sticker fill-lime">0</span><span class="d d2">4</span>
      </div>
      <p class="kicker">{{ is404 ? 'Página não encontrada' : 'Algo correu mal' }}</p>
      <h1 class="display h-lg">{{ is404 ? line : 'Ups, isto partiu-se.' }}</h1>
      <p v-if="!is404" class="muted">Tenta outra vez daqui a nada. Se continuar, avisa a malta.</p>
      <div class="actions">
        <button class="btn btn-primary" @click="home">Voltar ao início</button>
        <button class="btn btn-ghost" @click="back">Página anterior</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.err { display: grid; place-items: center; min-height: 100dvh; padding: calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); background: var(--ink); text-align: center; }
.stack { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 460px; }
.code { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; font-size: clamp(88px, 28vw, 150px); line-height: 1; letter-spacing: -.06em; }
.d { display: inline-block; }
.d1 { animation: wobble 2.8s ease-in-out infinite; }
.d2 { animation: wobble 2.8s ease-in-out .4s infinite; }
.d0 { display: grid; place-items: center; width: .82em; height: .96em; border-radius: .28em; color: var(--on-color); transform: rotate(-8deg); animation: pop-in 520ms cubic-bezier(.34, 1.56, .64, 1) both, spin 6s ease-in-out 600ms infinite; }
h1 { margin: 0; }
.actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 16px; }
@keyframes wobble { 50% { transform: translateY(-8px) rotate(-3deg); } }
@keyframes spin { 0%, 70% { transform: rotate(-8deg); } 85% { transform: rotate(352deg); } 100% { transform: rotate(352deg); } }
@media (prefers-reduced-motion: reduce) { .d, .d0 { animation: none !important; } }
</style>
