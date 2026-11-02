import { supabase } from './supabase'
import { functionError } from './errors'
// Shrink in the browser first (max 1600px, JPEG 0.82) to save free-tier bandwidth
async function compress(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file); const r = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.82))
  } catch { return file }
}
// Signed upload: the Cloudinary secret stays in the cloudinary-sign Edge Function
export async function uploadImage(file, max = 1600) {
  const { data: sig, error } = await supabase.functions.invoke('cloudinary-sign')
  if (error) throw await functionError(error)
  const fd = new FormData()
  fd.append('file', await compress(file, max)); fd.append('api_key', sig.api_key); fd.append('timestamp', sig.timestamp)
  fd.append('signature', sig.signature); fd.append('folder', sig.folder)
  let res
  try { res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: 'POST', body: fd }) }
  catch { throw new Error('Image upload failed. Check your connection and try again.') }
  if (!res.ok) throw new Error('Image upload failed. Check your connection and try again.')
  return (await res.json()).secure_url
}
// Cloudinary delivery transform (auto format, auto quality, width). Other URLs pass through untouched.
export const img = (url, w = 800) => (url && url.includes('/upload/') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`) : url)
