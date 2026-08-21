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
