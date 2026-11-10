import { parseColour } from './colourEngine.ts'

/**
 * Checks what someone typed into a colour field. Returns the value to store, or null so the
 * field can show its error instead of saving something the browser would ignore.
 */

const HEX = /^#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

/** `#RGB` or `#RRGGBB`, with or without the `#`, stored upper case with the `#`. */
export const sanitizeHex = (val: string): string | null => {
  const cleanVal = val.trim()
  if (!HEX.test(cleanVal)) return null
  return (cleanVal.startsWith('#') ? cleanVal : `#${cleanVal}`).toUpperCase()
}

/**
 * Accepts hex or `rgb()` / `rgba()`, the forms the HUD reads colours back as, and the
 * `oklch()`, `oklab()` and `color()` values the colour picker writes for colours outside sRGB.
 * Function forms are kept as typed, but only when `parseColour` can read them.
 */
export const sanitizeColour = (val: string): string | null => {
  const cleanVal = val.trim()
  if (!cleanVal) return null

  if (/^(?:rgba?|oklch|oklab|color)\(.+\)$/i.test(cleanVal)) {
    return parseColour(cleanVal) !== null ? cleanVal : null
  }

  return sanitizeHex(cleanVal)
}
