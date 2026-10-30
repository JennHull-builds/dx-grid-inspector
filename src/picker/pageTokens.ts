import { parseColour, type Oklch } from './colourEngine.ts'

/** A colour custom property declared on the page's root, with its value resolved. */
export interface PageToken {
  /** The custom property, `--brand-500`. */
  name: string
  /** The colour as the browser computes it, for example `rgb(220 38 38)` or `oklch(…)`. */
  value: string
  colour: Oklch
}

/**
 * Variables that belong to the inspector or to Tailwind's internals, not to the page: the
 * package's own `--dx-ui-*` colours and the `--dx-*` theme variables its stylesheet declares,
 * plus Tailwind's `--tw-*` helpers.
 */
const OWN_VARIABLE = /^--(?:dx|tw)-/

/** A selector that targets the root element itself, such as `:root`, `html` or `:root[data-theme]`. */
const ROOT_SELECTOR = /^(?::root|html|:host)(?![\w-])[^\s>+~]*$/

/** Values that name no colour of their own. */
const NOT_A_COLOUR = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i

const selectsRoot = (selectorText: string): boolean =>
  selectorText.split(',').some((selector) => ROOT_SELECTOR.test(selector.trim()))

/** Adds the custom properties declared on root selectors in `rules`, going into nested rules. */
const collectNames = (rules: CSSRuleList, names: Set<string>, seen: Set<CSSStyleSheet>): void => {
  for (const rule of Array.from(rules)) {
    if ('selectorText' in rule && selectsRoot((rule as CSSStyleRule).selectorText)) {
      const { style } = rule as CSSStyleRule
      for (let i = 0; i < style.length; i += 1) {
        if (style[i].startsWith('--')) names.add(style[i])
      }
    }
    // @media, @supports, @layer blocks, @container and nested style rules
    if ('cssRules' in rule) collectNames((rule as CSSGroupingRule).cssRules, names, seen)
    // @import
    const imported = (rule as CSSImportRule).styleSheet
    if (imported) collectSheet(imported, names, seen)
  }
}

const collectSheet = (sheet: CSSStyleSheet, names: Set<string>, seen: Set<CSSStyleSheet>): void => {
  if (seen.has(sheet)) return
  seen.add(sheet)
  try {
    collectNames(sheet.cssRules, names, seen)
  } catch {
    // A stylesheet from another origin cannot be read; its variables are skipped.
  }
}

/**
 * Reads the colour tokens a page declares: every custom property set on `:root`, `html` or
 * `:host` in the page's stylesheets that computes to a colour the engine understands.
 * Read again each time it is called, so it follows styles that load or change after startup.
 *
 * Limits: a stylesheet from another origin cannot be read, and variables set only inside a
 * shadow root are not seen. A value the engine cannot parse (`lab()`, for example) is left out.
 */
export const readPageTokens = (): PageToken[] => {
  if (typeof document === 'undefined') return []
  const names = new Set<string>()
  const seen = new Set<CSSStyleSheet>()
  for (const sheet of [...Array.from(document.styleSheets), ...document.adoptedStyleSheets]) {
    collectSheet(sheet, names, seen)
  }

  const root = document.documentElement
  const computed = window.getComputedStyle(root)
  // A throwaway element turns hsl(), named colours and the like into a computed colour.
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0'
  root.appendChild(probe)

  const tokens: PageToken[] = []
  try {
    for (const name of names) {
      if (OWN_VARIABLE.test(name)) continue
      const declared = computed.getPropertyValue(name).trim()
      if (!declared || NOT_A_COLOUR.test(declared)) continue
      probe.style.color = ''
      probe.style.color = declared
      if (!probe.style.color) continue
      const value = window.getComputedStyle(probe).color
      const colour = parseColour(value)
      if (colour) tokens.push({ name, value, colour })
    }
  } finally {
    probe.remove()
  }
  return tokens
}
