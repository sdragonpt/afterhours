export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  supabase: { redirect: false },
  app: { head: { title: 'Afterhours', meta: [{ name: 'theme-color', content: '#101014' }, { name: 'viewport', content: 'width=device-width,initial-scale=1' }] } },
  runtimeConfig: { supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY }
})
