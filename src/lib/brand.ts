import type { Organization } from '../types'

/** slate-900, the app's default primary colour. */
export const DEFAULT_ACCENT = '#0f172a'

const HEX = /^#[0-9a-f]{6}$/i

const setMeta = (name: string, content: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.setAttribute('content', content)

let defaultManifestHref: string | null = null
let defaultTouchIcon: string | null = null

/**
 * Points the PWA manifest and iOS home-screen tags at the restaurant's own icon/name so
 * "Add to Home Screen" installs a Francie's icon rather than the generic Shift Manager one.
 * Falls back to the built-in manifest when the org has no icon.
 */
function applyInstallBrand(org: Organization | null) {
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  const touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (!manifest || !touch) return
  defaultManifestHref ??= manifest.href
  defaultTouchIcon ??= touch.href

  const icon = org?.brand.iconUrl
  if (!icon) {
    manifest.href = defaultManifestHref
    touch.href = defaultTouchIcon
    setMeta('apple-mobile-web-app-title', 'Shift Manager')
    return
  }
  const name = orgLabel(org)
  const json = {
    name,
    short_name: name,
    description: 'Staff schedule, open shifts and swaps.',
    theme_color: accentOf(org),
    background_color: '#ffffff',
    display: 'standalone',
    start_url: `${location.origin}/`,
    scope: `${location.origin}/`,
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
  manifest.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(json))}`
  touch.href = icon
  setMeta('apple-mobile-web-app-title', name)
}

const accentOf = (org: Organization | null) => {
  const color = org?.brand.accentColor
  return color && HEX.test(color) ? color : DEFAULT_ACCENT
}

/** Applies the `--accent` CSS variable, theme colour, and install (manifest/icon) branding. */
export function applyBrand(org: Organization | null) {
  const accent = accentOf(org)
  document.documentElement.style.setProperty('--accent', accent)
  setMeta('theme-color', accent)
  applyInstallBrand(org)
}

export const orgLabel = (org: Organization | null) => (org ? org.brand.displayName || org.name : 'Shift Manager')
