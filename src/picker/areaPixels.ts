import {
  decodeChannel,
  encodeChannel,
  linearSrgbToLinearP3,
  oklchToLinearSrgb,
  ratioFromLuminance,
  withinUnitCube,
  type SrgbBytes,
} from './colourEngine.ts'

/** Size of the colour area's pixel grid. */
export const AREA_WIDTH = 288
export const AREA_HEIGHT = 216
/** Chroma at the right edge of the colour area. No screen shows much more. */
export const AREA_MAX_CHROMA = 0.37

/** A contrast threshold drawn across the colour area. */
export interface AreaLine {
  ratio: number
  dashed: boolean
}

/** What the colour area measures contrast against, and which thresholds to draw. */
export interface AreaContrast {
  /** Relative luminance of the colour each pixel is compared with. */
  against: number
  /** What a translucent pick is drawn over. Used only when `alpha` is below 1. */
  mixOver: SrgbBytes
  alpha: number
  lines: AreaLine[]
}

/* Pixel states: a pixel no screen can show, and the two sides of a contrast threshold. */
const EMPTY = 2
const PASSES = 1
const FAILS = 0

/** Hatching over colours only wide-gamut screens can show (a dark navy at about half strength). */
const HATCH: [number, number, number] = [10, 10, 16]

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const toByte = (linear: number): number => Math.round(clamp01(encodeChannel(clamp01(linear))) * 255)

/** Relative luminance of a pick at full strength, or mixed over `mixOver` when translucent. */
const shownLuminance = (srgb: [number, number, number], contrast: AreaContrast): number => {
  if (contrast.alpha >= 1) {
    return 0.2126 * clamp01(srgb[0]) + 0.7152 * clamp01(srgb[1]) + 0.0722 * clamp01(srgb[2])
  }
  const channel = (linear: number, under: number) =>
    decodeChannel(
      (clamp01(encodeChannel(clamp01(linear))) * 255 * contrast.alpha +
        under * (1 - contrast.alpha)) /
        255,
    )
  return (
    0.2126 * channel(srgb[0], contrast.mixOver[0]) +
    0.7152 * channel(srgb[1], contrast.mixOver[1]) +
    0.0722 * channel(srgb[2], contrast.mixOver[2])
  )
}

/**
 * The pixels of the colour area for one hue: lightness runs up the left edge, chroma across
 * the bottom. Returns RGBA bytes, `AREA_WIDTH` by `AREA_HEIGHT`.
 *
 * Colours every screen can show are painted plainly. Colours only a P3 screen can show are
 * hatched. Colours no screen can show are left clear. With `wide` set the bytes are Display P3
 * values (for a canvas that paints in P3), otherwise sRGB. When `contrast` is given, each
 * threshold is drawn as a white line with a dark edge, solid or dashed.
 */
export const computeArea = (
  hue: number,
  wide: boolean,
  contrast: AreaContrast | null,
): Uint8ClampedArray => {
  const w = AREA_WIDTH
  const h = AREA_HEIGHT
  const data = new Uint8ClampedArray(w * h * 4)
  const lines = contrast?.lines ?? []
  const states = lines.map(() => new Uint8Array(w * h))

  for (let y = 0; y < h; y += 1) {
    const l = 1 - y / (h - 1)
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      const srgb = oklchToLinearSrgb(l, (x / (w - 1)) * AREA_MAX_CHROMA, hue)
      const inSrgb = withinUnitCube(srgb)
      const p3 = inSrgb && !wide ? srgb : linearSrgbToLinearP3(srgb)
      if (!inSrgb && !withinUnitCube(linearSrgbToLinearP3(srgb))) {
        states.forEach((s) => (s[i] = EMPTY))
        continue
      }

      const shown = wide ? p3 : srgb
      let r = toByte(shown[0])
      let g = toByte(shown[1])
      let b = toByte(shown[2])
      if (!inSrgb && (x + y) % 7 < 2) {
        r = Math.round((r + HATCH[0]) / 2)
        g = Math.round((g + HATCH[1]) / 2)
        b = Math.round((b + HATCH[2]) / 2)
      }
      const o = i * 4
      data[o] = r
      data[o + 1] = g
      data[o + 2] = b
      data[o + 3] = 255

      if (contrast) {
        const ratio = ratioFromLuminance(shownLuminance(srgb, contrast), contrast.against)
        lines.forEach((line, k) => (states[k][i] = ratio >= line.ratio ? PASSES : FAILS))
      }
    }
  }

  lines.forEach((line, k) => drawLine(data, states[k], line.dashed))
  return data
}

/** Draws the edge between pixels that pass a threshold and pixels that fail it. */
const drawLine = (data: Uint8ClampedArray, state: Uint8Array, dashed: boolean): void => {
  const w = AREA_WIDTH
  const h = AREA_HEIGHT
  const onEdge = new Uint8Array(w * h)
  const differs = (a: number, b: number) => a !== EMPTY && b !== EMPTY && a !== b
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      if (
        (x + 1 < w && differs(state[i], state[i + 1])) ||
        (y + 1 < h && differs(state[i], state[i + w]))
      ) {
        if (!dashed || (x + y) % 12 < 7) onEdge[i] = 1
      }
    }
  }
  // A dark edge first, so the white line reads on light and dark colours alike.
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!onEdge[y * w + x]) continue
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const o = (ny * w + nx) * 4
        if (data[o + 3] === 0) continue
        data[o] = data[o] * 0.35
        data[o + 1] = data[o + 1] * 0.35
        data[o + 2] = data[o + 2] * 0.35
      }
    }
  }
  for (let i = 0; i < w * h; i += 1) {
    if (!onEdge[i]) continue
    const o = i * 4
    data[o] = 255
    data[o + 1] = 255
    data[o + 2] = 255
    data[o + 3] = 255
  }
}
