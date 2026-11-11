<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Privacidade · Afterhours' })
const updated = '12 de novembro de 2026'
// who runs the app (data controller) and how to reach them
const OPERATOR = 'a equipa da Afterhours'
const CONTACT = (useRuntimeConfig().public.privacyContact as string) || ''
</script>

<template>
  <main class="privacy">
    <article>
      <NuxtLink to="/" class="back faint">← Afterhours</NuxtLink>
      <p class="kicker mt-6">Privacidade</p>
      <h1 class="display h-lg">Os teus dados<span class="t-lime">.</span></h1>
      <p class="muted">A Afterhours é uma app onde qualquer pessoa pode criar conta e criar comunidades privadas para o seu grupo. Não tem publicidade, não vende dados e não usa analytics nem rastreio. Atualizado a {{ updated }}.</p>

      <h2>Quem é responsável</h2>
      <p>A app é criada e gerida por <b>{{ OPERATOR }}</b>, que é o responsável pelo tratamento dos dados de todas as contas e comunidades.<template v-if="CONTACT"> Contacto: <a :href="`mailto:${CONTACT}`" class="t-lime">{{ CONTACT }}</a>.</template><template v-else> Para qualquer pedido, usa o contacto indicado no fim desta página.</template></p>
      <p><b>Donos de comunidades:</b> quem cria uma comunidade gere essa comunidade: convida e remove pessoas, escolhe as funcionalidades (Planos, Gaming, Tab), liga ou desliga o filtro de palavrões e o Discord, e pode apagá-la. Não tem acesso às tuas mensagens privadas nem aos dados de outras comunidades.</p>

      <h2>O que guardamos</h2>
      <ul>
        <li><b>Conta:</b> email e password (guardada de forma cifrada).</li>
        <li><b>Perfil:</b> nome, cor do avatar e a tua "vibe" (que desaparece às 6h).</li>
        <li><b>O que publicas numa comunidade:</b> posts, fotos, clips, comentários, menções (@), reações, votos em sondagens.</li>
        <li><b>Planos e jogos:</b> planos que crias, presenças, lobbies (apagados 3h depois de começarem).</li>
        <li><b>The Tab:</b> despesas e pagamentos registados entre membros.</li>
        <li><b>Mensagens privadas:</b> o texto, quem enviou, para quem, quando, e se já foi vista.</li>
        <li><b>Notificações e widget:</b> o endereço de push do teu dispositivo (se ativares) e o código do widget (se o criares).</li>
      </ul>

      <h2>Quem vê o quê</h2>
      <ul>
        <li>O que publicas numa comunidade só é visível para os membros dessa comunidade.</li>
        <li>As mensagens privadas só são visíveis para ti e para a outra pessoa. Só podes trocar mensagens com quem partilha pelo menos uma comunidade contigo.</li>
        <li>Fotos e clips são servidos por links temporários que só funcionam para membros da comunidade.</li>
        <li>A equipa da Afterhours não lê o teu conteúdo. Só acede a dados quando é preciso para manter a app a funcionar, responder a um pedido teu, tratar uma denúncia de abuso ou cumprir a lei.</li>
      </ul>

      <h2>Filtro de palavrões</h2>
      <p>Se o dono da comunidade o ligar, as asneiras em posts, comentários, sondagens e planos são escondidas automaticamente no servidor (por exemplo, "c******") antes de serem guardadas. As mensagens privadas não são filtradas.</p>

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

      <h2>Porque tratamos os dados</h2>
      <p>Para te dar o serviço que pediste ao criar conta (execução do contrato): mostrar e guardar o que publicas, enviar notificações, manter as contas certas no Tab. A segurança (limites contra abuso, proteção das contas) é feita com base no interesse legítimo de manter a app segura para todos.</p>

      <h2>Cookies</h2>
      <p>Só usamos o estritamente necessário: a sessão de login e a comunidade que tens ativa. Não há cookies de publicidade nem de estatística, por isso não há banner de cookies.</p>

      <h2>Quanto tempo</h2>
      <p>Guardamos os teus dados enquanto tiveres conta. Lobbies desaparecem 3h depois de começarem e a vibe às 6h. Quando uma comunidade é apagada pelo dono, tudo o que lá estava é apagado, incluindo fotos e clips.</p>

      <h2>Os teus direitos</h2>
      <p>Podes pedir acesso, correção, cópia (portabilidade) ou eliminação dos teus dados, e opor-te ao seu tratamento. Em <b>Perfil → Apagar a minha conta</b> apagas tudo de uma vez: email, password, posts, fotos, clips, comentários, mensagens privadas, planos, lobbies, notificações e widget. As despesas e pagamentos em que participaste ficam anónimos, como "Ex-membro", para que as contas dos outros continuem certas.</p>
      <p>Também podes desligar as notificações, gerar um código de widget novo, ou sair de uma comunidade pedindo ao dono para te remover. Se achares que os teus dados não estão a ser bem tratados, podes queixar-te à <b>CNPD</b> (Comissão Nacional de Proteção de Dados).</p>

      <h2>Idade mínima</h2>
      <p>Precisas de ter pelo menos 13 anos para criar conta.</p>

      <h2>Contacto</h2>
      <p v-if="CONTACT">Para qualquer pedido sobre os teus dados: <a :href="`mailto:${CONTACT}`" class="t-lime">{{ CONTACT }}</a>. Respondemos no prazo de um mês.</p>
      <p v-else>Para qualquer pedido sobre os teus dados, contacta a equipa da Afterhours. Respondemos no prazo de um mês.</p>
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
