import {
  decodeChannel,
  encodeChannel,
  linearSrgbToLinearP3,
  mapToSrgb,
  oklchToLinearSrgb,
  ratioFromLuminance,
  SRGB_TO_P3,
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

/* Where a colour sits: every screen, only wide-gamut (P3) screens, or no screen. */
const SRGB = 0
const P3_ONLY = 1
const NONE = 2

/** Sub-samples per side for a pixel on an edge (4 by 4 = 16). */
const EDGE_SAMPLES = 4

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Relative luminance of a pick (gamma-encoded sRGB channels, 0 to 1) at full strength, or mixed
 * over `mixOver` when translucent.
 */
const shownLuminance = (encoded: [number, number, number], contrast: AreaContrast): number => {
  const channel = (value: number, under: number) =>
    decodeChannel(contrast.alpha >= 1 ? value : (value * 255 * contrast.alpha + under * (1 - contrast.alpha)) / 255)
  return (
    0.2126 * channel(encoded[0], contrast.mixOver[0]) +
    0.7152 * channel(encoded[1], contrast.mixOver[1]) +
    0.0722 * channel(encoded[2], contrast.mixOver[2])
  )
}

/** The colour at a point of the area (0 to 1 across and down), and which screens can show it. */
const sample = (hue: number, u: number, v: number) => {
  const srgb = oklchToLinearSrgb(1 - v, u * AREA_MAX_CHROMA, hue)
  if (withinUnitCube(srgb)) return { srgb, gamut: SRGB }
  return { srgb, gamut: withinUnitCube(linearSrgbToLinearP3(srgb)) ? P3_ONLY : NONE }
}

/* sRGB and P3 share one transfer curve. A table of it is much faster than a power per channel,
   and 8192 steps keep every byte within one of the exact value. */
const ENCODE_STEPS = 8192
const ENCODE_TABLE = (() => {
  const table = new Uint8Array(ENCODE_STEPS + 1)
  for (let i = 0; i <= ENCODE_STEPS; i += 1) table[i] = Math.round(encodeChannel(i / ENCODE_STEPS) * 255)
  return table
})()
const byteOf = (linear: number): number =>
  linear <= 0 ? 0 : linear >= 1 ? 255 : ENCODE_TABLE[(linear * ENCODE_STEPS + 0.5) | 0]

/**
 * The most chroma a lightness can carry at this hue and still be shown, on every screen
 * (`p3` false) or on a P3 screen. Grey is always inside, and moving out along chroma leaves the
 * gamut once, so halving the gap finds the edge.
 */
const maxChroma = (l: number, hue: number, p3: boolean): number => {
  const inside = (c: number) => {
    const srgb = oklchToLinearSrgb(l, c, hue)
    return withinUnitCube(p3 ? linearSrgbToLinearP3(srgb) : srgb)
  }
  if (inside(AREA_MAX_CHROMA)) return AREA_MAX_CHROMA
  if (!inside(0)) return -1
  let lo = 0
  let hi = AREA_MAX_CHROMA
  for (let k = 0; k < 22; k += 1) {
    const mid = (lo + hi) / 2
    if (inside(mid)) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * The pixels of the colour area for one hue: lightness runs up the left edge, chroma across
 * the bottom. Returns RGBA bytes, `width` by `height`.
 *
 * Draw it at the canvas's real size on screen (CSS size times `devicePixelRatio`), or the
 * browser stretches it and every edge turns into steps.
 *
 * Colours some screen can show are painted, and colours no screen can show are left clear.
 * Where ordinary (sRGB) screens end is drawn as a thin line on top, from `srgbEdge`. With
 * `wide` set the bytes are Display P3 values (for a canvas that paints in P3), otherwise sRGB.
 * Pixels on the area's edge are sampled 16 times, so the edge comes out smooth.
 */
export const computeArea = (
  hue: number,
  wide: boolean,
  width: number = AREA_WIDTH,
  height: number = AREA_HEIGHT,
): Uint8ClampedArray => {
  const w = Math.max(2, Math.round(width))
  const h = Math.max(2, Math.round(height))
  const data = new Uint8ClampedArray(w * h * 4)

  /* First pass: where each pixel's centre sits, from each row's two edges. Pixel centres span
     the area edge to edge, so the top-left pixel is pure white and the bottom-left pure black. */
  const gamuts = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    const l = 1 - y / (h - 1)
    const srgbEdge = maxChroma(l, hue, false)
    const p3Edge = maxChroma(l, hue, true)
    for (let x = 0; x < w; x += 1) {
      const c = (x / (w - 1)) * AREA_MAX_CHROMA
      gamuts[y * w + x] = c <= srgbEdge ? SRGB : c <= p3Edge ? P3_ONLY : NONE
    }
  }
  const radians = (hue * Math.PI) / 180
  const cosH = Math.cos(radians)
  const sinH = Math.sin(radians)
  const [m0, m1, m2] = SRGB_TO_P3

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      // Only the area's outer edge needs smoothing: colours run on smoothly where sRGB ends.
      const g = gamuts[i]
      const none = g === NONE
      const onEdge =
        (x > 0 && (gamuts[i - 1] === NONE) !== none) ||
        (x + 1 < w && (gamuts[i + 1] === NONE) !== none) ||
        (y > 0 && (gamuts[i - w] === NONE) !== none) ||
        (y + 1 < h && (gamuts[i + w] === NONE) !== none)

      let r = 0
      let gr = 0
      let b = 0
      let shownCount = 0
      let total = 1
      if (!onEdge) {
        if (g === NONE) continue
        // The same maths as oklchToLinearSrgb, written out so no arrays are made per pixel.
        const l = 1 - y / (h - 1)
        const c = (x / (w - 1)) * AREA_MAX_CHROMA
        const a = c * cosH
        const bLab = c * sinH
        const lc = l + 0.3963377774 * a + 0.2158037573 * bLab
        const mc = l - 0.1055613458 * a - 0.0638541728 * bLab
        const sc = l - 0.0894841775 * a - 1.291485548 * bLab
        const l_ = lc * lc * lc
        const m_ = mc * mc * mc
        const s_ = sc * sc * sc
        const sr = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
        const sg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
        const sb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
        if (wide) {
          r = m0[0] * sr + m0[1] * sg + m0[2] * sb
          gr = m1[0] * sr + m1[1] * sg + m1[2] * sb
          b = m2[0] * sr + m2[1] * sg + m2[2] * sb
        } else {
          r = sr
          gr = sg
          b = sb
        }
        shownCount = 1
      } else {
        total = EDGE_SAMPLES * EDGE_SAMPLES
        for (let sy = 0; sy < EDGE_SAMPLES; sy += 1) {
          for (let sx = 0; sx < EDGE_SAMPLES; sx += 1) {
            const px = x - 0.5 + (sx + 0.5) / EDGE_SAMPLES
            const py = y - 0.5 + (sy + 0.5) / EDGE_SAMPLES
            const s = sample(hue, clamp01(px / (w - 1)), clamp01(py / (h - 1)))
            if (s.gamut === NONE) continue
            const shown = wide ? linearSrgbToLinearP3(s.srgb) : s.srgb
            r += shown[0]
            gr += shown[1]
            b += shown[2]
            shownCount += 1
          }
        }
        if (shownCount === 0) continue
        r /= shownCount
        gr /= shownCount
        b /= shownCount
      }

      const o = i * 4
      data[o] = byteOf(r)
      data[o + 1] = byteOf(gr)
      data[o + 2] = byteOf(b)
      data[o + 3] = Math.round((shownCount / total) * 255)
    }
  }
  return data
}

/** How far apart (in chroma) the sRGB and P3 edges must be before the sRGB edge gets a line. */
const EDGE_GAP = 0.002

/** How wide the sRGB-to-P3 gap is (in chroma) where the edge line reaches full strength. */
const EDGE_FULL = 0.012

/**
 * Where ordinary (sRGB) screens run out, as lines to stroke on a canvas. Each point is
 * [across, down, strength]: across and down run 0 to 1, and strength (0 to 1) fades the line in
 * where the P3 band past it opens up, so it tapers off instead of stopping dead. Past the line,
 * only a wide-gamut (P3) screen shows the colour as it is. The line stops where it would sit on
 * the area's outer edge, so it never doubles that edge.
 */
export const srgbEdge = (hue: number, rows = AREA_HEIGHT): [number, number, number][][] => {
  const lines: [number, number, number][][] = []
  let current: [number, number, number][] | null = null
  for (let k = 0; k < rows; k += 1) {
    const v = k / (rows - 1)
    const l = 1 - v
    const srgb = maxChroma(l, hue, false)
    const p3 = maxChroma(l, hue, true)
    if (srgb >= 0 && srgb < AREA_MAX_CHROMA && p3 - srgb > EDGE_GAP) {
      if (!current) {
        current = []
        lines.push(current)
      }
      const strength = clamp01((p3 - srgb - EDGE_GAP) / (EDGE_FULL - EDGE_GAP))
      current.push([srgb / AREA_MAX_CHROMA, v, strength * strength * (3 - 2 * strength)])
    } else {
      current = null
    }
  }
  return lines.filter((line) => line.length > 1)
}

/** One contrast threshold, as smooth lines across the area. Points run 0 to 1 across and down. */
export interface ContrastPath {
  ratio: number
  dashed: boolean
  lines: [number, number][][]
}

/**
 * Where each contrast threshold crosses the colour area, as lines to stroke on a canvas.
 *
 * Each column is scanned down for the rows where the ratio crosses the threshold, and every
 * crossing is refined by halving the gap, so the line sits where the threshold really is, not
 * on a pixel boundary. Only colours some screen can show get a line.
 */
export const contrastPaths = (
  hue: number,
  contrast: AreaContrast,
  columns = AREA_WIDTH,
  rows = AREA_HEIGHT,
): ContrastPath[] =>
  contrast.lines.map((line) => {
    const passes = (u: number, v: number): boolean | null => {
      const s = sample(hue, u, v)
      if (s.gamut === NONE) return null
      // Measure the colour an sRGB screen shows, mapped in the same way as the picker's own
      // contrast figure (mapToSrgb). Clipping each channel instead bent the line where P3 starts.
      const encoded: [number, number, number] =
        s.gamut === SRGB
          ? [encodeChannel(clamp01(s.srgb[0])), encodeChannel(clamp01(s.srgb[1])), encodeChannel(clamp01(s.srgb[2]))]
          : mapToSrgb({ l: 1 - v, c: u * AREA_MAX_CHROMA, h: hue, alpha: 1 })
      return ratioFromLuminance(shownLuminance(encoded, contrast), contrast.against) >= line.ratio
    }
    const lines: [number, number][][] = []
    let open: [number, number][][] = []
    const join = 6 / rows // how far a line may move between columns and still be one line
    for (let cx = 0; cx < columns; cx += 1) {
      const u = cx / (columns - 1)
      const found: number[] = []
      let before = passes(u, 0)
      for (let ry = 1; ry < rows; ry += 1) {
        const v = ry / (rows - 1)
        const now = passes(u, v)
        if (before !== null && now !== null && before !== now) {
          let lo = (ry - 1) / (rows - 1)
          let hi = v
          for (let k = 0; k < 12; k += 1) {
            const mid = (lo + hi) / 2
            if (passes(u, mid) === before) lo = mid
            else hi = mid
          }
          found.push((lo + hi) / 2)
        }
        before = now
      }
      const next: [number, number][][] = []
      for (const v of found) {
        const match = open.find((l) => Math.abs(l[l.length - 1][1] - v) <= join)
        if (match) {
          match.push([u, v])
          open = open.filter((l) => l !== match)
          next.push(match)
        } else {
          const fresh: [number, number][] = [[u, v]]
          lines.push(fresh)
          next.push(fresh)
        }
      }
      open = next
    }
    return { ratio: line.ratio, dashed: line.dashed, lines: lines.filter((l) => l.length > 1) }
  })
