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

const rgbChannels = (value: string): [number, number, number] | null => {
  const comma = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
  )
  if (comma) {
    return [Number(comma[1]), Number(comma[2]), Number(comma[3])]
  }

  // Modern CSS Colour 4 serialisation: rgb(r g b / a)
  const space = value.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)/i)
  if (space) {
    return [Number(space[1]), Number(space[2]), Number(space[3])]
  }

  return null
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
 * Normalise a computed CSS colour into a `#RRGGBB` token the HUD can edit.
 */
const colourToToken = (value: string): string => {
  const hex = hexToken(value)
  if (hex) return hex

  const channels = rgbChannels(value)
  if (channels) return toHex(channels)

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
 */
export const applyDesignPropertiesToElement = (
  element: HTMLElement,
  properties: DesignProperties,
): void => {
  element.style.borderRadius = cssLength(properties.radius)
  element.style.padding = cssLength(properties.padding)
  element.style.backgroundColor = properties.bgPreset
  element.style.borderColor = properties.borderPreset
  if (!element.style.borderStyle || element.style.borderStyle === 'none') {
    element.style.borderStyle = 'solid'
  }
  if (!element.style.borderWidth) {
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
