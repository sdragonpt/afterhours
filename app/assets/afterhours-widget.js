// Afterhours — widget para o iPhone (app gratuita "Scriptable")
// Tamanhos: pequeno, médio e grande. Toca no widget para abrir o Afterhours.
const TOKEN = '__TOKEN__'
const SITE = '__SITE__'

const C = {
  ink: new Color('#0c0c0e'), ink2: new Color('#1c1c21'), paper: new Color('#f4f1ea'),
  muted: new Color('#8f8d96'), lime: new Color('#d4ff3a'), coral: new Color('#ff5a36'), sky: new Color('#5cc8ff'),
}
const family = config.widgetFamily || 'medium'

function until(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0) return 'a decorrer'
  const m = Math.round(ms / 60000)
  if (m < 60) return 'daqui a ' + m + ' min'
  const h = Math.round(m / 60)
  if (h < 24) return 'daqui a ' + h + 'h'
  const d = Math.round(h / 24)
  return d === 1 ? 'amanhã' : 'daqui a ' + d + ' dias'
}
function hhmm(iso) {
  const d = new Date(iso)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
function euros(v) {
  return Math.abs(v).toFixed(2).replace('.', ',') + ' €'
}
function text(stack, value, size, color, weight) {
  const t = stack.addText(value)
  t.font = weight === 'heavy' ? Font.heavySystemFont(size) : weight === 'bold' ? Font.boldSystemFont(size) : Font.mediumSystemFont(size)
  t.textColor = color
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  return t
}
function header(w, group) {
  const row = w.addStack()
  row.centerAlignContent()
  text(row, 'afterhours', 13, C.paper, 'heavy')
  text(row, '.', 13, C.lime, 'heavy')
  row.addSpacer()
  if (family !== 'small') text(row, group || '', 11, C.muted)
}
function pill(stack, value, bg, fg) {
  const p = stack.addStack()
  p.backgroundColor = bg
  p.cornerRadius = 9
  p.setPadding(3, 8, 3, 8)
  text(p, value, 11, fg, 'bold')
}
function planBlock(stack, plan, big) {
  const b = stack.addStack()
  b.layoutVertically()
  text(b, 'PRÓXIMO PLANO', 9, C.coral, 'bold')
  b.addSpacer(2)
  const t = text(b, plan.title, big ? 22 : 18, C.paper, 'heavy')
  t.lineLimit = 2
  b.addSpacer(2)
  text(b, until(plan.starts_at) + ' · ' + hhmm(plan.starts_at), 12, C.muted)
  b.addSpacer(4)
  pill(b, plan.me_going ? '✓ Tás dentro · ' + plan.going + ' vão' : plan.going + ' vão', plan.me_going ? C.lime : C.ink2, plan.me_going ? C.ink : C.paper)
}
function balanceLine(stack, balance) {
  if (Math.abs(balance) < 0.01) return pill(stack, 'Tab: estás limpo', C.ink2, C.muted)
  if (balance < 0) return pill(stack, 'Deves ' + euros(balance), C.coral, C.ink)
  return pill(stack, 'Tens ' + euros(balance) + ' a receber', C.lime, C.ink)
}
function lobbyLine(stack, l) {
  const r = stack.addStack()
  r.centerAlignContent()
  text(r, '🎮 ' + l.game, 13, C.paper, 'bold')
  r.addSpacer(6)
  text(r, hhmm(l.starts_at) + ' · ' + l.players + '/' + l.slots, 12, C.sky, 'bold')
}

async function build() {
  const w = new ListWidget()
  w.backgroundColor = C.ink
  w.setPadding(14, 14, 14, 14)
  w.url = SITE
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)

  let data
  try {
    data = await new Request(SITE + '/api/widget?t=' + TOKEN).loadJSON()
  } catch (e) {
    data = { error: 'Sem ligação' }
  }
  header(w, data && data.group)
  w.addSpacer(8)

  if (!data || data.error) {
    text(w, data && data.error ? data.error : 'Erro', 13, C.coral, 'bold').lineLimit = 3
    return w
  }

  const plan = (data.plans || [])[0]
  const lobbies = data.lobbies || []

  if (family === 'small') {
    if (plan) planBlock(w, plan, false)
    else text(w, 'Nenhum plano à vista. Bora?', 15, C.paper, 'heavy').lineLimit = 3
    w.addSpacer()
    balanceLine(w, data.balance)
    return w
  }

  if (family === 'medium') {
    const row = w.addStack()
    const left = row.addStack()
    left.layoutVertically()
    if (plan) planBlock(left, plan, false)
    else text(left, 'Nenhum plano à vista', 16, C.paper, 'heavy')
    row.addSpacer(10)
    const right = row.addStack()
    right.layoutVertically()
    text(right, 'QUEM JOGA?', 9, C.sky, 'bold')
    right.addSpacer(4)
    if (lobbies.length) lobbies.slice(0, 2).forEach(l => { lobbyLine(right, l); right.addSpacer(3) })
    else text(right, 'Sem lobbies', 12, C.muted)
    w.addSpacer()
    balanceLine(w, data.balance)
    return w
  }

  // large
  text(w, 'PLANOS', 9, C.coral, 'bold')
  w.addSpacer(4)
  if (!(data.plans || []).length) text(w, 'Nenhum plano à vista. Bora?', 16, C.paper, 'heavy')
  ;(data.plans || []).forEach((p, i) => {
    if (i === 0) { planBlock(w, p, true) } else {
      const r = w.addStack()
      r.centerAlignContent()
      text(r, p.title, 14, C.paper, 'bold')
      r.addSpacer()
      text(r, until(p.starts_at), 12, C.muted)
    }
    w.addSpacer(6)
  })
  w.addSpacer(4)
  text(w, 'QUEM JOGA?', 9, C.sky, 'bold')
  w.addSpacer(4)
  if (lobbies.length) lobbies.forEach(l => { lobbyLine(w, l); w.addSpacer(3) })
  else text(w, 'Sem lobbies abertos', 12, C.muted)
  w.addSpacer()
  balanceLine(w, data.balance)
  return w
}

const widget = await build()
if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()
