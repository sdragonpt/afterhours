/** @mentions use display names ("@Rita", "@João Pedro"). Longest names win so "@Ana Rita" isn't read as "@Ana". */
type Named = { user_id: string; name: string }

const byLength = (people: Named[]) => [...people].filter(p => p.name?.trim()).sort((a, b) => b.name.length - a.name.length)
const lower = (s: string) => s.toLocaleLowerCase('pt-PT')

/** user ids mentioned in a text */
export function mentionsIn(text: string, people: Named[]): string[] {
  const t = lower(text || '')
  if (!t.includes('@')) return []
  const out: string[] = []
  for (const p of byLength(people)) {
    if (t.includes('@' + lower(p.name.trim())) && !out.includes(p.user_id)) out.push(p.user_id)
  }
  return out
}

/** split a text into plain pieces and mention pieces, for highlighting */
export function splitMentions(text: string, people: Named[]): { text: string; id?: string }[] {
  if (!text || !text.includes('@')) return [{ text }]
  const names = byLength(people)
  const parts: { text: string; id?: string }[] = []
  let buf = ''
  let i = 0
  const low = lower(text)
  while (i < text.length) {
    if (text[i] === '@') {
      const hit = names.find(p => low.startsWith('@' + lower(p.name.trim()), i))
      if (hit) {
        if (buf) { parts.push({ text: buf }); buf = '' }
        const len = hit.name.trim().length + 1
        parts.push({ text: text.slice(i, i + len), id: hit.user_id })
        i += len
        continue
      }
    }
    buf += text[i]; i++
  }
  if (buf) parts.push({ text: buf })
  return parts
}
