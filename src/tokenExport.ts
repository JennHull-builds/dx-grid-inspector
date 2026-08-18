import type { DesignProperties } from './types'

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
 */
export const formatTokensAsCss = (properties: DesignProperties): string =>
  [
    `--radius: ${properties.radius}px;`,
    `--padding: ${properties.padding}px;`,
    `--surface-fill: ${properties.bgPreset};`,
    `--border-preset: ${properties.borderPreset};`,
  ].join('\n')

/**
 * Formats node tokens as JSON for the clipboard.
 */
export const formatTokensAsJson = (properties: DesignProperties): string =>
  `${JSON.stringify(properties, null, 2)}\n`
