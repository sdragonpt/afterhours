<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Privacidade · Afterhours' })
const updated = '11 de novembro de 2026'
</script>

<template>
  <main class="privacy">
    <article>
      <NuxtLink to="/" class="back faint">← Afterhours</NuxtLink>
      <p class="kicker mt-6">Privacidade</p>
      <h1 class="display h-lg">Os teus dados<span class="t-lime">.</span></h1>
      <p class="muted">Afterhours é uma app privada para grupos de amigos. Não tem publicidade, não vende dados e não usa analytics nem rastreio. Atualizado a {{ updated }}.</p>

      <h2>O que guardamos</h2>
      <ul>
        <li><b>Conta:</b> email e password (guardada de forma cifrada).</li>
        <li><b>Perfil:</b> nome, cor do avatar e a tua "vibe" (que desaparece às 6h).</li>
        <li><b>O que publicas:</b> posts, fotos, clips, comentários, reações, votos em sondagens.</li>
        <li><b>Planos e jogos:</b> planos que crias, presenças, lobbies.</li>
        <li><b>The Tab:</b> despesas e pagamentos registados entre membros.</li>
        <li><b>Notificações e widget:</b> o endereço de push do teu dispositivo (se ativares) e o código do widget (se o criares).</li>
      </ul>
      <p>Tudo o que publicas numa comunidade só é visível para os membros dessa comunidade.</p>

      <h2>Onde ficam</h2>
      <ul>
        <li><b>Supabase</b> (base de dados e contas), servidores na Irlanda (UE).</li>
        <li><b>Cloudflare R2</b> (fotos e clips), Europa Ocidental; a Cloudflare também serve os links da agenda e do armazenamento.</li>
        <li><b>Vercel</b> (alojamento da app e funções de notificações e widget).</li>
        <li><b>Apple / Google / Mozilla</b>: só entregam as notificações push ao teu dispositivo, se as ativares.</li>
        <li><b>Discord</b>: só se o dono da comunidade ligar um canal; recebe avisos de planos e clips novos.</li>
        <li><b>Google (Gmail)</b>: envia os emails de confirmação e recuperação de password.</li>
      </ul>
      <p>As fontes e o resto da app são servidos pela própria app, sem pedidos a terceiros.</p>

      <h2>Cookies</h2>
      <p>Só usamos o estritamente necessário: a sessão de login e a comunidade que tens ativa. Não há cookies de publicidade nem de estatística, por isso não há banner de cookies.</p>

      <h2>Apagar os teus dados</h2>
      <p>Em <b>Perfil → Apagar a minha conta</b> apagas tudo de uma vez: email, password, posts, fotos, clips, comentários, planos, lobbies, notificações e widget. As despesas e pagamentos em que participaste ficam anónimos, como "Ex-membro", para que as contas dos outros continuem certas.</p>
      <p>Também podes desligar as notificações, gerar um código de widget novo, ou pedir ao dono da comunidade para te remover.</p>

      <h2>Contacto</h2>
      <p>Esta app é gerida pelo dono do teu grupo. Para qualquer pedido sobre os teus dados, fala diretamente com ele.</p>
    </article>
  </main>
</template>

<style scoped>
.privacy { min-height: 100dvh; padding: calc(24px + env(safe-area-inset-top)) 18px 60px; }
article { max-width: 640px; margin: 0 auto; }
h1 { margin: 6px 0 10px; }
h2 { margin: 28px 0 8px; font-family: var(--font-display); font-size: 22px; letter-spacing: -.02em; }
p, li { color: var(--muted); line-height: 1.6; }
b { color: var(--paper); font-weight: 600; }
ul { padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.back:hover { color: var(--paper); }
</style>
