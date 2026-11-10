export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  // We handle auth redirects ourselves (middleware/auth.ts) so invite links survive the login step.
  supabase: { redirect: false },
  app: {
    head: {
      title: 'Afterhours',
      htmlAttrs: { lang: 'pt-PT' },
      meta: [
        { name: 'viewport', content: 'width=device-width,initial-scale=1,viewport-fit=cover' },
        { name: 'theme-color', content: '#0b0c10' },
        // iPhone "Adicionar ao ecrã principal" → opens fullscreen like a native app
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Afterhours' },
        // Link previews in WhatsApp/Discord
        { property: 'og:title', content: 'Afterhours' },
        { property: 'og:description', content: 'A tua malta, fora do horário.' },
        { property: 'og:image', content: '/icon-512.png' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', href: '/icon-192.png' },
      ],
    },
  },
})
