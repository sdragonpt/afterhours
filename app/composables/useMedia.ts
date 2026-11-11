/**
 * Media storage. New uploads go to Cloudflare R2 through the afterhours-media Worker
 * (stored in post_media.storage_path as "r2:<key>"); older files stay in Supabase Storage.
 */
const R2 = 'r2:'

export function useMedia() {
  const supabase = useSupabaseClient()
  const base = (useRuntimeConfig().public.mediaUrl as string || '').replace(/\/$/, '')

  async function token() {
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token
    if (!t) throw new Error('Sessão expirada. Entra outra vez.')
    return t
  }

  /** Upload to R2 with real progress (XHR, since fetch has no upload progress). */
  async function upload(file: File, group: string, onProgress?: (p: number) => void): Promise<string> {
    if (!base) throw new Error('Armazenamento de vídeos não configurado.')
    const t = await token()
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${base}/upload?group=${encodeURIComponent(group)}&name=${encodeURIComponent(file.name)}`)
      xhr.setRequestHeader('authorization', `Bearer ${t}`)
      xhr.setRequestHeader('content-type', file.type)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
      xhr.onload = () => {
        let body: any = {}
        try { body = JSON.parse(xhr.responseText) } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && body.key) resolve(R2 + body.key)
        else reject(new Error(body.error || `Falha no envio (${xhr.status})`))
      }
      xhr.onerror = () => reject(new Error('Sem ligação ao servidor de vídeos.'))
      xhr.send(file)
    })
  }

  /** storage_path → playable URL, for both R2 and legacy Supabase files. */
  async function sign(paths: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    const r2 = paths.filter(p => p.startsWith(R2))
    const legacy = paths.filter(p => !p.startsWith(R2))
    await Promise.all([
      (async () => {
        if (!r2.length || !base) return
        const res = await fetch(`${base}/sign`, {
          method: 'POST',
          headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
          body: JSON.stringify({ keys: r2.map(p => p.slice(R2.length)) }),
        })
        if (!res.ok) return
        const { urls } = await res.json() as { urls: Record<string, string> }
        for (const p of r2) { const u = urls[p.slice(R2.length)]; if (u) out[p] = u }
      })(),
      (async () => {
        if (!legacy.length) return
        const { data } = await supabase.storage.from('community-media').createSignedUrls(legacy, 3600)
        for (const s of data || []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl
      })(),
    ])
    return out
  }

  /** Best-effort delete (only the uploader is allowed by the Worker). */
  async function remove(path: string) {
    try {
      if (path.startsWith(R2) && base) {
        await fetch(`${base}/object`, { method: 'DELETE', headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' }, body: JSON.stringify({ key: path.slice(R2.length) }) })
      } else {
        await supabase.storage.from('community-media').remove([path])
      }
    } catch { /* orphaned file is harmless */ }
  }

  /**
   * Compress (videos: visually lossless re-encode; photos: ≤2560px JPEG) then upload.
   * Uses R2 when the media Worker is configured, otherwise Supabase Storage (50 MB cap).
   */
  async function send(
    f: File,
    group: string,
    userId: string,
    onStage?: (stage: 'compress' | 'upload', progress: number) => void,
  ): Promise<{ path: string; file: File; note: string }> {
    let out = f
    let note = ''
    if (f.type.startsWith('video/')) {
      onStage?.('compress', 0)
      const r = await compressClip(f, p => onStage?.('compress', p))
      out = r.file
      if (r.compressed) note = `${formatMB(r.before)} → ${formatMB(r.after)}`
    } else if (f.type.startsWith('image/')) {
      out = await compressImage(f)
    }
    if (out.size > MAX_UPLOAD_BYTES) throw new Error(`O ficheiro ficou com ${formatMB(out.size)} (máx. 100 MB). Corta-o um bocado.`)
    onStage?.('upload', 0)
    if (base) return { path: await upload(out, group, p => onStage?.('upload', p)), file: out, note }
    if (out.size > 50 * 1024 * 1024) throw new Error('Sem servidor de vídeos configurado: máximo 50 MB.')
    const path = `${group}/${userId}/${crypto.randomUUID()}-${out.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const { error } = await supabase.storage.from('community-media').upload(path, out, { contentType: out.type })
    if (error) throw error
    onStage?.('upload', 1)
    return { path, file: out, note }
  }

  /** Owner deleting a community: wipe all its photos/clips from R2 (the Worker checks ownership). */
  async function removeGroup(group: string) {
    if (!base) return
    const r = await fetch(`${base}/group`, { method: 'DELETE', headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' }, body: JSON.stringify({ group }) })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error(body.error || 'Não deu para apagar as fotos e clips')
    }
  }

  return { upload, send, sign, remove, removeGroup, enabled: !!base }
}
