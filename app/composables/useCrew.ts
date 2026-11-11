export type Vibe = 'sair' | 'jogar' | 'casa' | 'ocupado' | 'fome'
export type Member = {
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  name: string
  color: string
  vibe: Vibe | null
  vibe_note: string | null
}

export const VIBES: Record<Vibe, { label: string; short: string; color: string }> = {
  sair: { label: 'Bora sair', short: 'Bora sair', color: 'lime' },
  jogar: { label: 'A jogar', short: 'A jogar', color: 'sky' },
  fome: { label: 'Com fome', short: 'Fome', color: 'sun' },
  casa: { label: 'Em casa', short: 'Em casa', color: 'pink' },
  ocupado: { label: 'Ocupado', short: 'Ocupado', color: 'coral' },
}
export type Features = { plans: boolean; gaming: boolean; tab: boolean }
export const DEFAULT_FEATURES: Features = { plans: true, gaming: true, tab: true }
export type CommunityDraft = { name: string; features: Features; filter: boolean }
export type Group = { id: string; name: string; owner_id: string; calendar_token?: string; features?: Partial<Features>; filter_messages?: boolean }
export const AVATAR_COLORS = ['lime', 'coral', 'sky', 'pink', 'sun', 'mint'] as const

/**
 * Members + profiles of the active community, shared by every page.
 * Loaded once per community and refreshed on demand.
 */
export function useCrew() {
  const supabase = useSupabaseClient()
  const community = useCommunity()
  const me = useMe()
  const members = useState<Member[]>('crew-members', () => [])
  const groups = useState<Group[]>('crew-groups', () => [])
  const loadedFor = useState<string | null>('crew-loaded-for', () => null)
  const loading = useState('crew-loading', () => false)

  const group = computed(() => groups.value.find(g => g.id === community.value) || null)
  /** which tabs this community uses (Hoje is always on) */
  const features = computed<Features>(() => ({ ...DEFAULT_FEATURES, ...(group.value?.features || {}) }))
  const isOwner = computed(() => !!me.value && group.value?.owner_id === me.value.id)
  const byId = computed(() => new Map(members.value.map(m => [m.user_id, m])))
  const meMember = computed(() => (me.value ? byId.value.get(me.value.id) : undefined))

  const nameOf = (id?: string | null) => {
    if (!id) return 'Alguém'
    if (id === me.value?.id) return 'Tu'
    return byId.value.get(id)?.name || 'Ex-membro'
  }
  const colorOf = (id?: string | null) => (id && byId.value.get(id)?.color) || 'lime'

  async function loadGroups() {
    if (!me.value) return
    const { data } = await supabase.from('groups').select('id,name,owner_id,calendar_token,features,filter_messages').order('created_at', { ascending: true })
    groups.value = data || []
    if (!groups.value.some(g => g.id === community.value)) community.value = groups.value[0]?.id || null
  }

  async function loadMembers(force = false) {
    if (!community.value || !me.value) { members.value = []; return }
    if (!force && loadedFor.value === community.value && members.value.length) return
    loading.value = true
    const { data: rows } = await supabase.from('group_members').select('user_id,role,joined_at').eq('group_id', community.value).order('joined_at')
    const ids = (rows || []).map(r => r.user_id)
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id,display_name,avatar_color,vibe,vibe_note,vibe_until').in('id', ids)
      : { data: [] as any[] }
    const now = Date.now()
    members.value = (rows || []).map((r: any) => {
      const p = profiles?.find((x: any) => x.id === r.user_id)
      const vibeActive = p?.vibe && p?.vibe_until && new Date(p.vibe_until).getTime() > now
      return {
        user_id: r.user_id, role: r.role, joined_at: r.joined_at,
        name: p?.display_name || 'Membro',
        color: p?.avatar_color || 'lime',
        vibe: vibeActive ? p.vibe : null,
        vibe_note: vibeActive ? p.vibe_note : null,
      }
    })
    loadedFor.value = community.value
    loading.value = false
  }

  return { members, groups, group, features, isOwner, meMember, loading, nameOf, colorOf, loadGroups, loadMembers }
}
