# Afterhours v1.0

Rede social privada para a malta: planos, gaming, contas e vibes. Nuxt 4 + Supabase, instalável no iPhone (PWA).
Online em https://afterhours-malta.netlify.app (deploy automático a cada push para `main`).

## O que tem
- **Hoje** — saudação, vibes da malta ("Bora sair", "A jogar", "Fome"…), próximo plano em contagem decrescente, saldo do Tab, feed com várias reações por post e sondagens.
- **Planos ("Bora?")** — pósteres com confirmação "Tô dentro / Talvez / Não dá", atalhos de data, mapa, partilha para WhatsApp.
- **Gaming ("Quem joga?")** — lobbies com lugares (CS2 às 22h — 3/5), clip da semana, biblioteca de clips por jogo.
- **The Tab** — quem paga a quem com o mínimo de transferências, "Paguei/Recebi" com confetti, badge "Caloteiro-mor", lembrete no Discord.
- **Malta** — membros, vibes, badges (Organizador, Influencer, Gamer, Novato), convites e ligação ao Discord.
- Botão **+** central para criar qualquer coisa; animações respeitam "Reduzir movimento".

## Design
"Flyer de noite": fundo tinta, verde-lima para ações, coral para dívidas, azul-céu para gaming, autocolantes com sombra dura, tipografia Bricolage Grotesque. Tokens em `app/assets/css/main.css`.

## Desenvolvimento
1. `cp .env.example .env` e preenche `SUPABASE_URL` e `SUPABASE_KEY` (chave publicável).
2. `npm install` → `npm run dev`.

## Base de dados (Supabase → SQL Editor, por ordem, uma vez cada)
`database/schema.sql` → `migrations/003` → … → `008`.

## Discord
Dono da comunidade: **Malta → Discord** → cola o URL de um webhook do canal. Planos, lobbies, clips e despesas novas aparecem lá.
