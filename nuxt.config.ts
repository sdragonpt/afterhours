// Absolute site URL for link previews (WhatsApp/Discord need absolute image URLs).
// Netlify sets URL at build time; fallback is the production domain.
const SITE_URL = (process.env.URL || 'https://afterhours-malta.netlify.app').replace(/\/$/, '')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  // Private, logged-in app: render in the browser and serve static files from the CDN edge.
  // No server round-trip (Netlify functions run in the US) and no login-page flash on reload.
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  // We handle auth redirects ourselves (middleware/auth.ts) so invite links survive the login step.
  supabase: { redirect: false },
  // instant swap + short enter fade (see .page-* in main.css)
  experimental: { viewTransition: false },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Afterhours',
      htmlAttrs: { lang: 'pt-PT' },
      meta: [
        { name: 'viewport', content: 'width=device-width,initial-scale=1,viewport-fit=cover' },
        { name: 'theme-color', content: '#0c0c0e' },
        { name: 'description', content: 'A tua malta: planos, jogos, contas e vibes, num só sítio.' },
        // iPhone "Adicionar ao ecrã principal" → opens fullscreen like a native app
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Afterhours' },
        // Link previews in WhatsApp / Discord / iMessage
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Afterhours' },
        { property: 'og:title', content: 'Afterhours — a tua malta' },
        { property: 'og:description', content: 'Planos, jogos, contas e vibes do grupo. Toca para entrar.' },
        { property: 'og:url', content: SITE_URL },
        { property: 'og:image', content: `${SITE_URL}/og.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:locale', content: 'pt_PT' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', href: '/icon-192.png' },
      ],
    },
  },
})
