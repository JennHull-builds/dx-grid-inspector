import type { DesignNode, DesignProperties } from './types'

type TokenNodeMeta = Pick<DesignNode, 'id' | 'name' | 'category' | 'status'>

const cssLength = (value: number | string): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`
  }
  const trimmed = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}px`
  }
  return trimmed
}

/** sRGB channels 0–255 plus alpha 0–1. */
type Rgba = [number, number, number, number]

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Parses one colour component; `%` maps to `percentScale`, `none` to 0. */
const parseComponent = (raw: string, percentScale = 1): number => {
  const trimmed = raw.trim()
  if (trimmed === 'none') return 0
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n)) return Number.NaN
  return trimmed.endsWith('%') ? (n / 100) * percentScale : n
}

/** Splits `a b c / alpha` or `a, b, c, alpha` into components and an alpha (default 1). */
const splitComponents = (inner: string): { parts: string[]; alpha: number } => {
  const [main, slashAlpha] = inner.split('/')
  const parts = main.split(/[\s,]+/).filter(Boolean)
  const rawAlpha = slashAlpha ?? (parts.length === 4 ? parts.pop() : undefined)
  const alpha = rawAlpha === undefined ? 1 : clamp01(parseComponent(rawAlpha))
  return { parts, alpha: Number.isNaN(alpha) ? 1 : alpha }
}

const linearToSrgbByte = (linear: number): number => {
  const gamma =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055
  return Math.round(clamp01(gamma) * 255)
}

/** OKLab to sRGB bytes (Björn Ottosson's reference matrices), clipped to gamut. */
const oklabToRgb = (l: number, a: number, b: number): [number, number, number] => {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    linearToSrgbByte(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    linearToSrgbByte(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    linearToSrgbByte(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

/**
 * Parses the colour forms browsers return from `getComputedStyle`: `rgb()` / `rgba()`,
 * `oklab()`, `oklch()` (what Tailwind v4 colours compute to) and `color(srgb …)`.
 * Returns null for anything else.
 */
const parseCssColour = (value: string): Rgba | null => {
  const match = value.trim().match(/^([a-z]+)\(\s*([^)]*)\)$/i)
  if (!match) return null
  const fn = match[1].toLowerCase()
  let inner = match[2]

  if (fn === 'color') {
    const space = inner.trim().split(/\s+/)[0]
    if (space !== 'srgb') return null
    inner = inner.trim().slice(space.length)
  }

  const { parts, alpha } = splitComponents(inner)
  if (parts.length !== 3) return null

  let rgb: [number, number, number]
  if (fn === 'rgb' || fn === 'rgba') {
    rgb = parts.map((p) => Math.round(Math.min(255, Math.max(0, parseComponent(p, 255))))) as [
      number,
      number,
      number,
    ]
  } else if (fn === 'color') {
    rgb = parts.map((p) => Math.round(clamp01(parseComponent(p)) * 255)) as [number, number, number]
  } else if (fn === 'oklab') {
    rgb = oklabToRgb(parseComponent(parts[0]), parseComponent(parts[1], 0.4), parseComponent(parts[2], 0.4))
  } else if (fn === 'oklch') {
    const chroma = parseComponent(parts[1], 0.4)
    const hue = (parseComponent(parts[2].replace(/deg$/i, '')) * Math.PI) / 180
    rgb = oklabToRgb(parseComponent(parts[0]), chroma * Math.cos(hue), chroma * Math.sin(hue))
  } else {
    return null
  }

  if (rgb.some((n) => Number.isNaN(n))) return null
  return [rgb[0], rgb[1], rgb[2], alpha]
}

const toHex = (channels: [number, number, number]): string =>
  `#${channels
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`

const hexToken = (value: string): string | null => {
  const trimmed = value.trim()
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) {
    return trimmed.toUpperCase()
  }
  return null
}

/**
 * Normalise a computed CSS colour into a token the HUD can edit: `#RRGGBB` when opaque,
 * `rgba(r, g, b, a)` when translucent, so transparency is never silently dropped.
 */
const colourToToken = (value: string): string => {
  const hex = hexToken(value)
  if (hex) return hex

  const rgba = parseCssColour(value)
  if (rgba) {
    const [r, g, b, a] = rgba
    return a >= 1 ? toHex([r, g, b]) : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : '#000000'
}

const parsePx = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Copies computed border-radius, padding, background, and border-colour
 * from a preview surface into `DesignProperties`.
 */
export const readDesignPropertiesFromElement = (
  element: HTMLElement,
): DesignProperties => {
  const styles = window.getComputedStyle(element)
  return {
    radius: parsePx(styles.borderTopLeftRadius || styles.borderRadius),
    padding: parsePx(styles.paddingTop),
    bgPreset: colourToToken(styles.backgroundColor),
    borderPreset: colourToToken(styles.borderTopColor || styles.borderColor),
  }
}

/**
 * Formats node tokens as CSS custom properties for the clipboard.
 * Optional `nodeName` is written as a leading comment so the paste is identifiable.
 */
export const formatTokensAsCss = (
  properties: DesignProperties,
  nodeName?: string,
): string => {
  const declarations = [
    `--radius: ${cssLength(properties.radius)};`,
    `--padding: ${cssLength(properties.padding)};`,
    `--surface-fill: ${properties.bgPreset};`,
    `--border-preset: ${properties.borderPreset};`,
  ].join('\n')

  return nodeName ? `/* ${nodeName} */\n${declarations}` : declarations
}

/**
 * Formats node tokens as JSON for the clipboard.
 * Pass node metadata when copying a selected node so id, name, and status travel with the tokens.
 */
export const formatTokensAsJson = (
  properties: DesignProperties,
  node?: TokenNodeMeta,
): string =>
  `${JSON.stringify(node ? { ...node, properties } : properties, null, 2)}\n`

const isFiniteNumberOrString = (value: unknown): value is number | string =>
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value))

/**
 * Rebuilds `DesignProperties` from unknown JSON. Extra keys are dropped;
 * invalid shapes return null.
 */
export const parseDesignProperties = (
  value: unknown,
): DesignProperties | null => {
  if (value === null || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const source =
    record.properties !== undefined &&
    record.properties !== null &&
    typeof record.properties === 'object'
      ? (record.properties as Record<string, unknown>)
      : record

  if (
    !isFiniteNumberOrString(source.radius) ||
    !isFiniteNumberOrString(source.padding) ||
    typeof source.bgPreset !== 'string' ||
    typeof source.borderPreset !== 'string'
  ) {
    return null
  }

  return {
    radius: source.radius,
    padding: source.padding,
    bgPreset: source.bgPreset,
    borderPreset: source.borderPreset,
  }
}

/**
 * Parses a JSON string into `DesignProperties` (bare tokens or a full node with `properties`).
 */
export const parseDesignPropertiesJson = (
  raw: string,
): DesignProperties | null => {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parseDesignProperties(parsed)
  } catch {
    return null
  }
}

/**
 * Writes the four spatial tokens onto a host element as inline styles.
 * Does not inject global CSS — only the selected target is updated.
 * An element that already has a visible border keeps its width and style; one with no
 * border gets a 2px solid border so the border colour can be seen.
 */
export const applyDesignPropertiesToElement = (
  element: HTMLElement,
  properties: DesignProperties,
): void => {
  const computed = window.getComputedStyle(element)
  const hasVisibleBorder =
    computed.borderTopStyle !== 'none' &&
    Number.parseFloat(computed.borderTopWidth) > 0

  element.style.borderRadius = cssLength(properties.radius)
  element.style.padding = cssLength(properties.padding)
  element.style.backgroundColor = properties.bgPreset
  element.style.borderColor = properties.borderPreset
  if (!hasVisibleBorder) {
    element.style.borderStyle = 'solid'
    element.style.borderWidth = '2px'
  }
}

/**
 * Builds a paste-ready agent prompt that asks for `DesignProperties` JSON first.
 * Optional natural-language context is included when provided.
 */
export const formatTokensAsAgentPrompt = (
  properties: DesignProperties,
  options?: {
    nodeName?: string
    layoutDescription?: string
  },
): string => {
  const current = JSON.stringify(properties, null, 2)
  const contextLines = [
    options?.nodeName ? `Node label: ${options.nodeName}` : null,
    options?.layoutDescription?.trim()
      ? `Layout description:\n${options.layoutDescription.trim()}`
      : null,
  ].filter((line): line is string => line !== null)

  return [
    'You are helping calibrate spatial design tokens for a DX grid inspector.',
    'Return ONLY a JSON object matching this DesignProperties shape (no markdown fences):',
    '{',
    '  "radius": number | string,',
    '  "padding": number | string,',
    '  "bgPreset": string,',
    '  "borderPreset": string',
    '}',
    'Field meanings: radius = corner radius, padding = internal padding, bgPreset = surface fill colour (hex preferred), borderPreset = border colour (hex or rgba).',
    'After the JSON you may add at most one short layout suggestion sentence.',
    contextLines.length > 0 ? `\n${contextLines.join('\n\n')}` : '',
    '\nCurrent tokens:',
    current,
  ]
    .filter((part) => part !== '')
    .join('\n')
}

/**
 * Writes text to the clipboard. Falls back to a hidden textarea when the
 * Clipboard API is missing or blocked (for example a non-secure context).
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the execCommand path.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
