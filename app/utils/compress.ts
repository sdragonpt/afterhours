/**
 * Visually-lossless clip compression in the browser (WebCodecs via Mediabunny).
 *
 * Game recorders (ShadowPlay/OBS/Medal) save at 40–100 Mbps. Re-encoding to H.264
 * at a sane bitrate for the clip's resolution/fps keeps it indistinguishable to the eye
 * and is typically 4–6× smaller. Resolution and frame rate are kept as-is.
 * Anything that can't be improved (photos, already-efficient clips, unsupported
 * browsers, failures) is returned untouched.
 */
export type CompressResult = { file: File; compressed: boolean; before: number; after: number; reason?: string }

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
const BUDGET_BYTES = 95 * 1024 * 1024

/** bitrate that looks identical for gameplay at this size/fps (H.264) */
function targetBitrate(height: number, fps: number) {
  const hi = fps > 40
  if (height <= 720) return hi ? 7e6 : 5e6
  if (height <= 1080) return hi ? 12e6 : 8e6
  if (height <= 1440) return hi ? 20e6 : 14e6
  return hi ? 35e6 : 25e6
}

export async function compressClip(file: File, onProgress?: (p: number) => void): Promise<CompressResult> {
  const keep = (reason: string): CompressResult => ({ file, compressed: false, before: file.size, after: file.size, reason })
  if (!file.type.startsWith('video/')) return keep('not-video')
  if (typeof window === 'undefined' || !('VideoEncoder' in window)) return keep('no-webcodecs')

  try {
    const mb = await import('mediabunny')
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
    const track = await input.getPrimaryVideoTrack()
    if (!track) return keep('no-video-track')

    const duration = await input.computeDuration()
    const stats = await track.computePacketStats(240)
    const fps = stats.averagePacketRate || 30
    const height = Math.min(track.displayWidth, track.displayHeight) // portrait-safe
    const sourceBitrate = duration > 0 ? (file.size * 8) / duration : stats.averageBitrate

    // what fits in the upload budget (leave room for audio + container)
    const budget = duration > 0 ? ((BUDGET_BYTES * 8) / duration) * 0.92 - 192e3 : Infinity
    const bitrate = Math.max(1.5e6, Math.min(targetBitrate(height, fps), budget))

    // already lean and small enough → don't touch it
    if (sourceBitrate <= bitrate * 1.15 && file.size <= BUDGET_BYTES) return keep('already-efficient')

    const ok = await mb.canEncodeVideo('avc', { width: track.displayWidth, height: track.displayHeight, bitrate })
    if (!ok) return keep('encoder-unavailable')

    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
    const conversion = await mb.Conversion.init({ input, output, video: { codec: 'avc', bitrate } })
    if (!conversion.isValid) return keep('cannot-convert')
    conversion.onProgress = (p) => onProgress?.(p)
    await conversion.execute()

    const buffer = output.target.buffer
    if (!buffer || buffer.byteLength >= file.size) return keep('no-gain')
    const name = file.name.replace(/\.[^.]+$/, '') + '.mp4'
    const out = new File([buffer], name, { type: 'video/mp4' })
    return { file: out, compressed: true, before: file.size, after: out.size }
  } catch (e) {
    console.warn('[compress] falling back to original', e)
    return keep('error')
  }
}

export const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`

/** Photos: downscale to ≤2560px and re-save as high-quality JPEG (GIFs untouched). */
export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type === 'image/jpeg') return file
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.86))
    if (!blob || (blob.size >= file.size && file.type === 'image/jpeg')) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
