import type { Organization } from '../types'

/** slate-900, the app's default primary colour. */
export const DEFAULT_ACCENT = '#0f172a'

const HEX = /^#[0-9a-f]{6}$/i

/** Sets the `--accent` CSS variable the primary button/nav/brand tile use. */
export function applyBrand(org: Organization | null) {
  const color = org?.brand.accentColor
  document.documentElement.style.setProperty('--accent', color && HEX.test(color) ? color : DEFAULT_ACCENT)
}

export const orgLabel = (org: Organization | null) => (org ? org.brand.displayName || org.name : 'Shift Manager')
