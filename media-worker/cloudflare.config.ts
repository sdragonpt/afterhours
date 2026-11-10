import { bindings, defineConfig } from 'cf/config'

import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'afterhours-media',
    compatibilityDate: '2026-11-01',
    entrypoint,
    workersDev: true,
    env: {
      MEDIA: bindings.r2({ name: 'afterhours-clips' }),
      SUPABASE_URL: bindings.text('https://mxgmllafsltirzpemmtn.supabase.co'),
      // public (publishable) key — safe to ship, RLS does the protecting
      SUPABASE_KEY: bindings.text('sb_publishable_rBkv0UggqBdyN_Qhu1wXMw_7GhP8V1s'),
      ALLOWED_ORIGINS: bindings.text('https://afterhours-malta.vercel.app,https://afterhours-malta.netlify.app,http://localhost:3123,http://localhost:3000'),
    },
  },
})
