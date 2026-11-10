// Register the push service worker as soon as the app loads.
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('[sw] register failed', e))
})
