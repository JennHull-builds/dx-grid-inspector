/**
 * Colour maths for the picker. Plain TypeScript with no imports: no React, no DOM and no
 * other file of this package, so it can move into a package of its own unchanged.
 *
 * Colours are held as OKLCH, a colour space whose lightness matches what the eye sees:
 * `l` is lightness, `c` is chroma (colourfulness) and `h` is the hue angle in degrees.
 * Three ranges of colour matter: sRGB (every screen), Display P3 (wide-gamut screens) and
 * anything beyond P3 (no screen). `gamutOf` says which one a colour belongs to.
 */

export interface Oklch {
  /** Lightness, 0 (black) to 1 (white). */
  l: number
  /** Chroma, 0 and up. No screen shows much above 0.37. */
  c: number
  /** Hue angle in degrees, 0 to 360. Carries no meaning when `c` is 0. */
  h: number
  /** Opacity, 0 (clear) to 1 (solid). */
  alpha: number
}

/** The range of colours a screen can show: every screen, wide-gamut screens only, or none. */
export type Gamut = 'srgb' | 'p3' | 'none'

type Triple = [number, number, number]
type Matrix = [Triple, Triple, Triple]

/** Red, green and blue as 0–255 whole numbers. */
export type SrgbBytes = [number, number, number]

/**
 * One just-noticeable difference: the smallest OKLab distance the eye can tell apart
 * (CSS Color 4 sets it at 0.02).
 */
export const JUST_NOTICEABLE_DIFFERENCE = 0.02

/**
 * How close a dragged colour must come to a token (as an OKLab distance) before it snaps
 * onto it. This is the one setting for how strong the pull feels: raise it for a stronger pull.
 */
export const MAGNETIC_SNAP_DISTANCE = JUST_NOTICEABLE_DIFFERENCE

/** A channel may stray this far outside 0–1 before a colour counts as outside a gamut. */
const GAMUT_EPSILON = 1e-4

/** Below this chroma a colour is grey and its hue is not kept. */
const ACHROMATIC_CHROMA = 1e-4

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/* ---------- Matrices ---------- */

const apply = (m: Matrix, v: Triple): Triple => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
]

const multiply = (a: Matrix, b: Matrix): Matrix => {
  const cell = (i: number, j: number) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
  return [
    [cell(0, 0), cell(0, 1), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)],
  ]
}

export const invertMatrix = (m: Matrix): Matrix => {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const c00 = e * i - f * h
  const c01 = -(d * i - f * g)
  const c02 = d * h - e * g
  const det = a * c00 + b * c01 + c * c02
  return [
    [c00 / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [c01 / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [c02 / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
}

/** Linear RGB to CIE XYZ for a set of primaries (as xy chromaticities) and a white point. */
const primariesToXyz = (
  red: [number, number],
  green: [number, number],
  blue: [number, number],
  white: [number, number],
): Matrix => {
  const column = ([x, y]: [number, number]): Triple => [x / y, 1, (1 - x - y) / y]
  const [r, g, b, w] = [column(red), column(green), column(blue), column(white)]
  const basis: Matrix = [
    [r[0], g[0], b[0]],
    [r[1], g[1], b[1]],
    [r[2], g[2], b[2]],
  ]
  const s = apply(invertMatrix(basis), w)
  return [
    [basis[0][0] * s[0], basis[0][1] * s[1], basis[0][2] * s[2]],
    [basis[1][0] * s[0], basis[1][1] * s[1], basis[1][2] * s[2]],
    [basis[2][0] * s[0], basis[2][1] * s[1], basis[2][2] * s[2]],
  ]
}

const D65: [number, number] = [0.3127, 0.329]
const SRGB_TO_XYZ = primariesToXyz([0.64, 0.33], [0.3, 0.6], [0.15, 0.06], D65)
const P3_TO_XYZ = primariesToXyz([0.68, 0.32], [0.265, 0.69], [0.15, 0.06], D65)

/** Linear Display P3 to linear sRGB. Wide-gamut colours come out below 0 or above 1. */
export const P3_TO_SRGB: Matrix = multiply(invertMatrix(SRGB_TO_XYZ), P3_TO_XYZ)
/** Linear sRGB to linear Display P3. */
export const SRGB_TO_P3: Matrix = invertMatrix(P3_TO_SRGB)

/* ---------- OKLab, sRGB and Display P3 ---------- */

/** sRGB and Display P3 share one transfer curve. */
export const encodeChannel = (linear: number): number =>
  linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055

export const decodeChannel = (encoded: number): number =>
  encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4

/** OKLab to linear sRGB (Björn Ottosson's reference matrices). Not clipped. */
export const oklabToLinearSrgb = (l: number, a: number, b: number): Triple => {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

/** Linear sRGB to OKLab. */
export const linearSrgbToOklab = (r: number, g: number, b: number): Triple => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/**
 * OKLab to sRGB bytes, each channel clipped to 0–255 with no chroma mapping. This is the
 * conversion the HUD uses to read `oklab()` / `oklch()` colours back from a page.
 */
export const oklabToSrgbBytes = (l: number, a: number, b: number): SrgbBytes => {
  const [r, g, bl] = oklabToLinearSrgb(l, a, b)
  const byte = (linear: number) => Math.round(clamp01(encodeChannel(linear)) * 255)
  return [byte(r), byte(g), byte(bl)]
}

export const linearSrgbToLinearP3 = (rgb: Triple): Triple => apply(SRGB_TO_P3, rgb)

const toOklab = (c: Oklch): Triple => {
  const radians = (c.h * Math.PI) / 180
  return [c.l, c.c * Math.cos(radians), c.c * Math.sin(radians)]
}

/** The colour at lightness `l`, chroma `c` and hue `h`, as linear sRGB. Not clipped. */
export const oklchToLinearSrgb = (l: number, c: number, h: number): Triple => {
  const radians = (h * Math.PI) / 180
  return oklabToLinearSrgb(l, c * Math.cos(radians), c * Math.sin(radians))
}

const fromOklab = (l: number, a: number, b: number, alpha: number): Oklch => {
  const c = Math.hypot(a, b)
  if (c < ACHROMATIC_CHROMA) return { l, c: 0, h: 0, alpha }
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { l, c, h: h < 0 ? h + 360 : h, alpha }
}

const fromLinearSrgb = (rgb: Triple, alpha: number): Oklch =>
  fromOklab(...linearSrgbToOklab(rgb[0], rgb[1], rgb[2]), alpha)

/** Whether every channel sits inside 0–1, give or take a rounding error. */
export const withinUnitCube = (rgb: Triple): boolean =>
  rgb.every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON)

/* ---------- Parsing ---------- */

const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?'
const NUMBER_ONLY = new RegExp(`^${NUMBER}$`)
const HUE = new RegExp(`^(${NUMBER})(deg|grad|rad|turn)?$`)

/** A number, or a percentage worth `percentOf`, or `none` (0). Null for anything else. */
const parseNumber = (raw: string, percentOf: number): number | null => {
  if (raw === 'none') return 0
  if (raw.endsWith('%')) {
    const digits = raw.slice(0, -1)
    return NUMBER_ONLY.test(digits) ? (Number(digits) / 100) * percentOf : null
  }
  return NUMBER_ONLY.test(raw) ? Number(raw) : null
}

/** A hue angle in degrees, from a bare number or one with a `deg`, `grad`, `rad` or `turn` unit. */
const parseHue = (raw: string): number | null => {
  if (raw === 'none') return 0
  const match = raw.match(HUE)
  if (!match) return null
  const unit = match[2]
  const factor = unit === 'grad' ? 0.9 : unit === 'rad' ? 180 / Math.PI : unit === 'turn' ? 360 : 1
  const degrees = Number(match[1]) * factor
  return ((degrees % 360) + 360) % 360
}

/**
 * Splits the inside of a colour function into its values and an optional alpha. Alpha follows
 * a `/`, or is a fourth comma-separated value in the older `rgba(r, g, b, a)` form.
 */
const splitArguments = (
  inner: string,
  commaAlpha: boolean,
): { parts: string[]; alpha: string | null } | null => {
  const halves = inner.split('/')
  if (halves.length > 2) return null
  const parts = halves[0].trim().split(/[\s,]+/).filter(Boolean)
  if (halves.length === 2) return { parts, alpha: halves[1].trim() }
  if (commaAlpha && parts.length === 4) return { parts: parts.slice(0, 3), alpha: parts[3] }
  return { parts, alpha: null }
}

const parseAlpha = (raw: string | null): number | null => {
  if (raw === null) return 1
  const value = parseNumber(raw, 1)
  return value === null ? null : clamp01(value)
}

const parseHex = (text: string): Oklch | null => {
  const match = text.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (!match) return null
  const digits =
    match[1].length <= 4
      ? match[1]
          .split('')
          .map((d) => d + d)
          .join('')
      : match[1]
  const byte = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16)
  const alpha = digits.length === 8 ? byte(3) / 255 : 1
  return fromLinearSrgb(
    [decodeChannel(byte(0) / 255), decodeChannel(byte(1) / 255), decodeChannel(byte(2) / 255)],
    alpha,
  )
}

/**
 * Reads a CSS colour as OKLCH plus alpha. Understands hex (`#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`), `rgb()` / `rgba()`, `oklab()`, `oklch()`, `color(srgb …)` and
 * `color(display-p3 …)`. Returns null for anything else, including named colours and `hsl()`;
 * the browser turns those into `rgb()` when a computed style is read.
 */
export const parseColour = (input: string): Oklch | null => {
  const text = input.trim().toLowerCase()
  if (text.startsWith('#')) return parseHex(text)

  const call = text.match(/^([a-z-]+)\(([\s\S]*)\)$/)
  if (!call) return null
  const fn = call[1]
  const split = splitArguments(call[2], fn === 'rgb' || fn === 'rgba')
  if (!split) return null
  const alpha = parseAlpha(split.alpha)
  if (alpha === null) return null
  const { parts } = split

  if (fn === 'rgb' || fn === 'rgba') {
    if (parts.length !== 3) return null
    const channels = parts.map((p) => parseNumber(p, 255))
    if (channels.some((v) => v === null)) return null
    const [r, g, b] = (channels as number[]).map((v) => decodeChannel(clamp01(v / 255)))
    return fromLinearSrgb([r, g, b], alpha)
  }

  if (fn === 'oklab') {
    if (parts.length !== 3) return null
    const l = parseNumber(parts[0], 1)
    const a = parseNumber(parts[1], 0.4)
    const b = parseNumber(parts[2], 0.4)
    if (l === null || a === null || b === null) return null
    return fromOklab(clamp01(l), a, b, alpha)
  }

  if (fn === 'oklch') {
    if (parts.length !== 3) return null
    const l = parseNumber(parts[0], 1)
    const c = parseNumber(parts[1], 0.4)
    const h = parseHue(parts[2])
    if (l === null || c === null || h === null) return null
    return { l: clamp01(l), c: Math.max(0, c), h, alpha }
  }

  if (fn === 'color') {
    if (parts.length !== 4) return null
    const space = parts[0]
    if (space !== 'srgb' && space !== 'display-p3') return null
    const channels = parts.slice(1).map((p) => parseNumber(p, 1))
    if (channels.some((v) => v === null)) return null
    const linear = (channels as number[]).map(decodeChannel) as Triple
    return fromLinearSrgb(space === 'srgb' ? linear : apply(P3_TO_SRGB, linear), alpha)
  }

  return null
}

/* ---------- Gamut ---------- */

/** Which range of screens can show this colour. */
export const gamutOf = (c: Oklch): Gamut => {
  const srgb = oklchToLinearSrgb(c.l, c.c, c.h)
  if (withinUnitCube(srgb)) return 'srgb'
  return withinUnitCube(apply(SRGB_TO_P3, srgb)) ? 'p3' : 'none'
}

/** Straight-line distance between two colours in OKLab (CSS Color 4 calls it deltaEOK). */
export const deltaEOK = (a: Oklch, b: Oklch): number => {
  const [l1, a1, b1] = toOklab(a)
  const [l2, a2, b2] = toOklab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

const clipLinear = (rgb: Triple): Triple => [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])]

/**
 * The colour as sRGB channels (0–1, gamma-encoded) that every screen can show. A colour
 * outside sRGB is mapped in by lowering its chroma at the same lightness and hue until the
 * clipped result is within one just-noticeable difference of it (the approach of CSS Color 4).
 */
export const mapToSrgb = (c: Oklch): Triple => {
  const encode = (rgb: Triple): Triple => [
    encodeChannel(rgb[0]),
    encodeChannel(rgb[1]),
    encodeChannel(rgb[2]),
  ]
  if (c.l >= 1) return [1, 1, 1]
  if (c.l <= 0) return [0, 0, 0]

  if (withinUnitCube(oklchToLinearSrgb(c.l, c.c, c.h))) {
    return encode(clipLinear(oklchToLinearSrgb(c.l, c.c, c.h)))
  }

  /** The candidate at `chroma`, clipped, and how far the clip moved it. */
  const clipAt = (chroma: number): { clipped: Triple; distance: number } => {
    const clipped = clipLinear(oklchToLinearSrgb(c.l, chroma, c.h))
    const [cl, ca, cb] = linearSrgbToOklab(clipped[0], clipped[1], clipped[2])
    const [l, a, b] = toOklab({ l: c.l, c: chroma, h: c.h, alpha: 1 })
    return { clipped, distance: Math.hypot(cl - l, ca - a, cb - b) }
  }

  let result = clipAt(c.c)
  if (result.distance < JUST_NOTICEABLE_DIFFERENCE) return encode(result.clipped)

  const epsilon = 1e-4
  let min = 0
  let max = c.c
  let minInGamut = true
  while (max - min > epsilon) {
    const chroma = (min + max) / 2
    if (minInGamut && withinUnitCube(oklchToLinearSrgb(c.l, chroma, c.h))) {
      min = chroma
      continue
    }
    result = clipAt(chroma)
    if (result.distance < JUST_NOTICEABLE_DIFFERENCE) {
      if (JUST_NOTICEABLE_DIFFERENCE - result.distance < epsilon) return encode(result.clipped)
      minInGamut = false
      min = chroma
    } else {
      max = chroma
    }
  }
  return encode(result.clipped)
}

/** The closest colour every screen can show, as 0–255 channels. */
export const toSrgbBytes = (c: Oklch): SrgbBytes => {
  const [r, g, b] = mapToSrgb(c)
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/* ---------- Formatting ---------- */

const trimmed = (n: number, digits: number): string => String(Number(n.toFixed(digits)))

const toHex = (bytes: SrgbBytes): string =>
  `#${bytes
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`

/** `oklch(72.1% 0.213 142.5)`, with ` / alpha` when the colour is translucent. */
export const formatOklch = (c: Oklch): string => {
  const alpha = Math.round(c.alpha * 1000) / 1000
  const body = `${trimmed(c.l * 100, 1)}% ${trimmed(c.c, 3)} ${trimmed(c.h, 1)}`
  return alpha >= 1 ? `oklch(${body})` : `oklch(${body} / ${trimmed(alpha, 3)})`
}

/** The closest `#RRGGBB` every screen can show. Ignores alpha. */
export const hexFallback = (c: Oklch): string => toHex(toSrgbBytes(c))

/**
 * The colour as the HUD stores it: `#RRGGBB` when opaque and inside sRGB, `rgba(r, g, b, a)`
 * when translucent and inside sRGB, and `oklch()` only when it lies outside sRGB.
 */
export const formatColour = (c: Oklch): string => {
  if (gamutOf(c) !== 'srgb') return formatOklch(c)
  const bytes = toSrgbBytes(c)
  const alpha = Math.round(c.alpha * 1000) / 1000
  return alpha >= 1 ? toHex(bytes) : `rgba(${bytes[0]}, ${bytes[1]}, ${bytes[2]}, ${alpha})`
}

/* ---------- Contrast ---------- */

const luminanceOfLinear = (rgb: Triple): number => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

/**
 * Relative luminance at lightness `l`, chroma `c` and hue `h`, clipped into sRGB with no
 * chroma mapping. Cheap enough to run for every pixel of the colour area.
 */
export const luminanceAt = (l: number, c: number, h: number): number =>
  luminanceOfLinear(clipLinear(oklchToLinearSrgb(l, c, h)))

const bytesToLinear = (bytes: SrgbBytes): Triple => [
  decodeChannel(bytes[0] / 255),
  decodeChannel(bytes[1] / 255),
  decodeChannel(bytes[2] / 255),
]

/** WCAG 2 contrast ratio from two relative luminances. */
export const ratioFromLuminance = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/**
 * WCAG 2 contrast ratio between `foreground` and `background`, 1 to 21. Each colour is
 * measured as the sRGB colour a screen would show for it (see `mapToSrgb`). A translucent
 * foreground is mixed over the background first, and a translucent background over white.
 */
export const contrastRatio = (foreground: Oklch, background: Oklch): number => {
  const mixOver = (top: Oklch, under: SrgbBytes): SrgbBytes => {
    const bytes = toSrgbBytes(top)
    return [0, 1, 2].map((i) =>
      Math.round(bytes[i] * top.alpha + under[i] * (1 - top.alpha)),
    ) as SrgbBytes
  }
  const backdrop = mixOver(background, [255, 255, 255])
  const shown = mixOver(foreground, backdrop)
  return ratioFromLuminance(
    luminanceOfLinear(bytesToLinear(shown)),
    luminanceOfLinear(bytesToLinear(backdrop)),
  )
}

export type ContrastRating = 'AAA' | 'AA' | 'large text only' | 'fails'

/** WCAG 2 rating for text: 7:1 is AAA, 4.5:1 is AA, 3:1 is enough for large text only. */
export const rateTextContrast = (ratio: number): ContrastRating =>
  ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'large text only' : 'fails'

/** WCAG 2 rating for a border or other non-text part: 3:1 is AA, anything lower fails. */
export const rateNonTextContrast = (ratio: number): ContrastRating => (ratio >= 3 ? 'AA' : 'fails')

/* ---------- Tokens ---------- */

export interface NamedColour {
  name: string
  colour: Oklch
}

export interface NearestColour {
  name: string
  colour: Oklch
  /** OKLab distance from the colour that was asked about. Ignores alpha. */
  distance: number
}

/** The closest of `candidates` to `target`, or null when there are none. */
export const nearestColour = (
  target: Oklch,
  candidates: readonly NamedColour[],
): NearestColour | null => {
  let best: NearestColour | null = null
  for (const candidate of candidates) {
    const distance = deltaEOK(target, candidate.colour)
    if (best === null || distance < best.distance) {
      best = { name: candidate.name, colour: candidate.colour, distance }
    }
  }
  return best
}

/**
 * The token a dragged colour should snap onto: the nearest one, when it lies within
 * `MAGNETIC_SNAP_DISTANCE`. Null when none is close enough.
 */
export const snapTarget = (
  target: Oklch,
  tokens: readonly NamedColour[],
  distance: number = MAGNETIC_SNAP_DISTANCE,
): NearestColour | null => {
  const nearest = nearestColour(target, tokens)
  return nearest !== null && nearest.distance <= distance ? nearest : null
}
