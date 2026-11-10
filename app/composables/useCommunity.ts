/** Active community id — remembered across reloads. */
export const useCommunity = () => useCookie<string | null>('ah-community', { default: () => null, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
