// Absolute site URL for link previews (WhatsApp/Discord need absolute image URLs).
// SITE_URL (set on Vercel) wins; Netlify sets URL; Vercel also exposes the production host.
const SITE_URL = (
  process.env.SITE_URL
  || process.env.URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  || 'https://afterhours-malta.vercel.app'
).replace(/\/$/, '')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  // Private, logged-in app: render in the browser and serve static files from the CDN edge.
  // No server round-trip (Netlify functions run in the US) and no login-page flash on reload.
  ssr: false,
  spaLoadingTemplate: 'spa-loading-template.html',
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  // fonts are bundled with the app (no request to Google → no IP sent to third parties)
  css: ['@fontsource-variable/bricolage-grotesque/standard.css', '@fontsource-variable/dm-sans/standard.css', '~/assets/css/main.css'],
  // We handle auth redirects ourselves (middleware/auth.ts) so invite links survive the login step.
  // SPA: keep the session in localStorage (persistent) instead of an 8h cookie,
  // so friends don't get logged out every day.
  supabase: { redirect: false, useSsrCookies: false },
  // Clip storage Worker (Cloudflare R2). Empty → uploads fall back to Supabase Storage.
  runtimeConfig: {
    public: {
      mediaUrl: process.env.MEDIA_URL || '',
      calUrl: process.env.CAL_URL || 'https://afterhours-cal.sergionunoribeiro.workers.dev',
      // public half of the VAPID pair (private key lives only in Vercel env)
      privacyContact: process.env.PRIVACY_CONTACT || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BHgr8VJsmDRU-PAM76rasSuL8KlxjuzvStKLhcD-krzVgTclG3HXmaUEmOm5S0u79yGMKHx0XPR-OaHU57gjYDM',
    },
  },
  // emit /tab.html (not /tab/index.html) so Netlify serves /tab without a 301 to /tab/
  nitro: { prerender: { autoSubfolderIndex: false } },
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
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32 64x64' },
        { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon-64.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
      ],
    },
  },
})
