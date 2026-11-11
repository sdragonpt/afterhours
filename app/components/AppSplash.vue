<script setup lang="ts">
/**
 * Same splash as app/spa-loading-template.html (shown before the JS loads), kept on screen
 * while the layout boots (invite, communities, members). If the HTML splash was already
 * visible, skip the entrance animation so the hand-off is invisible.
 */
const LINES = ['A chamar a malta…', 'A aquecer o lobby…', 'A contar quem deve a quem…', 'A escolher o bar…', 'A acordar o grupo…', 'A carregar os clips…']
const w = (import.meta.client ? window : {}) as any
const continued = !!w.__ahSplashLine
const line = w.__ahSplashLine || LINES[Math.floor(Math.random() * LINES.length)]
</script>

<template>
  <div class="ah-splash" :class="{ 'is-continued': continued }" role="status" aria-live="polite">
    <img class="ah-splash-logo" src="/icon-192.png" alt="" width="96" height="96">
    <p class="ah-splash-word">afterhours<span>.</span></p>
    <div class="ah-splash-bar" />
    <p class="ah-splash-line">{{ line }}</p>
  </div>
</template>

<style>
.ah-splash { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  padding: env(safe-area-inset-top) 24px env(safe-area-inset-bottom); background: #0c0c0e; color: #f4f1ea;
  font-family: 'Bricolage Grotesque Variable', ui-rounded, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
.ah-splash-logo { width: 96px; height: 96px; border: 3px solid #000; border-radius: 26px; box-shadow: 5px 5px 0 #000; transform: rotate(-6deg);
  animation: ah-pop 520ms cubic-bezier(.34, 1.56, .64, 1) both, ah-bob 2.4s 520ms ease-in-out infinite; }
.ah-splash-word { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.04em; animation: ah-fade 400ms 180ms ease-out both; }
.ah-splash-word span { color: #d4ff3a; }
.ah-splash-bar { position: relative; width: 132px; height: 6px; overflow: hidden; border-radius: 99px; background: #1c1c21; animation: ah-fade 400ms 260ms ease-out both; }
.ah-splash-bar::after { content: ''; position: absolute; inset: 0; width: 40%; border-radius: 99px; background: #d4ff3a; animation: ah-slide 1.1s cubic-bezier(.65, 0, .35, 1) infinite; }
.ah-splash-line { margin: 0; min-height: 18px; color: #8f8d96; font-size: 14px; font-weight: 600; animation: ah-fade 400ms 340ms ease-out both; }
/* continuing from the HTML splash: no second entrance */
.ah-splash.is-continued .ah-splash-logo { animation: ah-bob 2.4s ease-in-out infinite; }
.ah-splash.is-continued .ah-splash-word, .ah-splash.is-continued .ah-splash-bar, .ah-splash.is-continued .ah-splash-line { animation: none; }
@keyframes ah-pop { from { transform: scale(.4) rotate(-30deg); opacity: 0; } }
@keyframes ah-bob { 50% { transform: translateY(-6px) rotate(-2deg); } }
@keyframes ah-fade { from { opacity: 0; transform: translateY(6px); } }
@keyframes ah-slide { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
.splash-leave-active { transition: opacity 280ms ease-out, transform 280ms ease-out; }
.splash-leave-to { opacity: 0; transform: scale(1.04); }
@media (prefers-reduced-motion: reduce) { .ah-splash *, .ah-splash *::after { animation: none !important; } .splash-leave-active { transition: opacity 150ms; } .splash-leave-to { transform: none; } }
</style>
