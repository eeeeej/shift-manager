const LOGO_MAX = 512
const ICON_SIZE = 512
/** Fraction of the icon tile the artwork may fill (rest is padding). */
const ICON_FILL = 0.86

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png'))
}

/** Trims fully transparent edges so a logo with baked-in margins is padded consistently. */
function trim(src: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  let top = c.height, left = c.width, right = -1, bottom = -1
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
  if (right < 0) return c
  const out = document.createElement('canvas')
  out.width = right - left + 1
  out.height = bottom - top + 1
  out.getContext('2d')!.drawImage(c, left, top, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export interface BrandImages {
  /** Trimmed, transparent, at most 512px on the long side — shown in the header. */
  logo: Blob
  /** 512×512 on a solid background with padding — the home-screen icon. */
  icon: Blob
}

/** Derives the header logo and a square app icon from one uploaded image. */
export async function processBrandImage(file: Blob, background: string): Promise<BrandImages> {
  const art = trim(await loadImage(file))

  const scale = Math.min(1, LOGO_MAX / Math.max(art.width, art.height))
  const logoCanvas = document.createElement('canvas')
  logoCanvas.width = Math.max(1, Math.round(art.width * scale))
  logoCanvas.height = Math.max(1, Math.round(art.height * scale))
  logoCanvas.getContext('2d')!.drawImage(art, 0, 0, logoCanvas.width, logoCanvas.height)

  const iconCanvas = document.createElement('canvas')
  iconCanvas.width = ICON_SIZE
  iconCanvas.height = ICON_SIZE
  const ctx = iconCanvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE)
  const fit = (ICON_SIZE * ICON_FILL) / Math.max(art.width, art.height)
  const w = art.width * fit
  const h = art.height * fit
  ctx.drawImage(art, (ICON_SIZE - w) / 2, (ICON_SIZE - h) / 2, w, h)

  const [logo, icon] = await Promise.all([toBlob(logoCanvas), toBlob(iconCanvas)])
  return { logo, icon }
}
