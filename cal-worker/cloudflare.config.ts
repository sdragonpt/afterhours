import { bindings, defineConfig } from 'cf/config'

import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

// Calendar files on a different origin than the app: in an iPhone home-screen app,
// same-origin .ics links open inside the app (blank page); cross-origin ones open
// Safari's sheet, which shows the native "Add to Calendar".
export default defineConfig({
  worker: {
    name: 'afterhours-cal',
    compatibilityDate: '2026-11-01',
    entrypoint,
    workersDev: true,
    env: {
      SUPABASE_URL: bindings.text('https://mxgmllafsltirzpemmtn.supabase.co'),
      SUPABASE_KEY: bindings.text('sb_publishable_rBkv0UggqBdyN_Qhu1wXMw_7GhP8V1s'),
      SITE_URL: bindings.text('https://afterhours-malta.vercel.app'),
    },
  },
})
