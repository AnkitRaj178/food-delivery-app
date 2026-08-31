const DEFAULT_ALLOWED_CDN_HOSTS = ['res.cloudinary.com', 'images.unsplash.com', 's3.amazonaws.com']

function normalizeHost(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
}

export function allowedCdnHosts() {
  const fromEnv = process.env.ALLOWED_IMAGE_CDN_HOSTS
  if (!fromEnv) return DEFAULT_ALLOWED_CDN_HOSTS
  const parsed = fromEnv
    .split(',')
    .map(normalizeHost)
    .filter(Boolean)
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_CDN_HOSTS
}

export function isCdnImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) return false
    return allowedCdnHosts().includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function assertCdnImageUrl(url, label = 'imageUrl') {
  if (!isCdnImageUrl(url)) {
    throw Object.assign(new Error(`${label} must point to a configured image CDN URL`), {
      status: 400,
    })
  }
}
