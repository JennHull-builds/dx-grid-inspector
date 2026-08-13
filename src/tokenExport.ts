import type { DesignProperties } from './types'

const rgbChannels = (value: string): [number, number, number] | null => {
  const match = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
  )
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const toHex = (channels: [number, number, number]): string =>
  `#${channels
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`

const colourToToken = (value: string): string => {
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
 * Reads computed radius, padding, fill, and border colour from a preview surface.
 */
export const readDesignPropertiesFromElement = (
  element: HTMLElement,
): DesignProperties => {
  const styles = window.getComputedStyle(element)
  return {
    radius: parsePx(styles.borderRadius),
    padding: parsePx(styles.paddingTop),
    bgPreset: colourToToken(styles.backgroundColor),
    borderPreset: colourToToken(styles.borderColor),
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
