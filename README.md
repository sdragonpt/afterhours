# Afterhours v0.5

Rede social privada para a malta — Nuxt 4, Vue 3, Tailwind CSS e Supabase. Web app instalável no iPhone (PWA), sem App Store.

## Novidades na v0.5

**Bug crítico corrigido** — o `@nuxtjs/supabase` v2 guarda as *claims* do JWT em `useSupabaseUser()`, não o objeto `User`. O id está em `sub`, por isso `user.value.id` era sempre `undefined` (posts, perfil, reações, despesas e convites falhavam). Agora usa-se `useMe()` (`app/composables/useMe.ts`), que devolve `{ id, email }`.

**The Tab v2**
- "Quem paga a quem" com o mínimo de transferências (`app/utils/settle.ts`).
- Qualquer membro pode ser quem pagou ("o João pagou o jantar").
- "Marcar como pago" num toque, por quem deve ou por quem recebe.
- Apagar despesas/pagamentos registados por engano.
- Divisão ao cêntimo justa (os cêntimos que sobram são distribuídos, não vão todos para um).
- Partilhar o resumo das dívidas no WhatsApp e "Lembrar no Discord".

**Discord e WhatsApp**
- Notificações automáticas num canal do Discord através de um **webhook** (sem bot, sem servidor): novos planos, clips, despesas e acertos. O próprio Postgres envia o pedido (`pg_net`).
- Botão "Partilhar" nos planos, no The Tab e nos convites. No iPhone abre a folha de partilha nativa (WhatsApp, Discord, Mensagens…); no PC abre o WhatsApp Web.

**Convites que funcionam** — um amigo sem conta abre o link → cria conta → entra logo na comunidade (antes o token perdia-se no login).

**PWA** — manifest, ícones e meta tags para "Adicionar ao ecrã principal" no iPhone, e preview de links no WhatsApp/Discord.

## Instalação

1. `cp .env.example .env` e preenche `SUPABASE_URL` e `SUPABASE_KEY` (publishable/anon). Nunca ponhas a service role key no browser.
2. `npm install`
3. No Supabase → SQL Editor, corre **por esta ordem** (cada um uma vez):
   - Projeto novo: `database/schema.sql` → `migrations/003_…` → `004_…` → `005_…` → `006_…`
   - Já tens a v0.4: `004_…` (se ainda não correu), `005_…` e `006_…`
4. `npm run dev` → http://localhost:3000

> Se criares conta e o Supabase pedir confirmação por email, em **Authentication → URL Configuration** adiciona `http://localhost:3000/**` (e o domínio final) aos *Redirect URLs*.

## Ligar o Discord

1. No Discord: **Editar canal → Integrações → Webhooks → Novo webhook → Copiar URL do webhook**.
2. Na app, como dono da comunidade: **Malta → Discord** → cola o URL → Guardar.
3. O link nos avisos aponta para o domínio onde guardaste (por isso guarda-o já no domínio final depois do deploy).

## No iPhone

Abrir o site no **Safari → Partilhar → Adicionar ao ecrã principal**. Abre em ecrã inteiro como uma app.

## Deploy

Vercel ou Netlify funcionam diretamente com Nuxt. Define `SUPABASE_URL` e `SUPABASE_KEY` nas variáveis de ambiente do projeto.

## Tipos da base de dados

`app/types/database.types.ts` tem um placeholder (`any`). Para tipos reais:
`npx supabase gen types typescript --project-id <id> > app/types/database.types.ts`
