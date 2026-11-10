// @nuxtjs/supabase v2 stores the JWT *claims* in useSupabaseUser(), not the User object.
// The user id lives in `sub`, so `useSupabaseUser().value.id` is always undefined.
// Use this composable everywhere you need the current user's id/email.
export const useMe = () => {
  const claims = useSupabaseUser()
  return computed(() => {
    if (!claims.value?.sub) return null
    return { id: claims.value.sub as string, email: (claims.value.email as string | undefined) || '' }
  })
}
