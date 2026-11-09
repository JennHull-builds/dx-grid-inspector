import type { ContrastContext } from '../types'
import { compositeOver, formatColour, parseColour, type Oklch } from './colourEngine.ts'

const WHITE: Oklch = { l: 1, c: 0, h: 0, alpha: 1 }

/** The colour a browser paints a page with no background of its own (white, or dark for a dark colour scheme). */
const canvasColour = (): Oklch => {
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:Canvas'
  document.documentElement.appendChild(probe)
  try {
    return parseColour(window.getComputedStyle(probe).color) ?? WHITE
  } finally {
    probe.remove()
  }
}

/**
 * The solid colour behind `element`: its ancestors' backgrounds, from the first opaque one
 * outwards, with any translucent layers mixed over it. A page with no opaque background shows
 * the browser's canvas colour.
 */
const backgroundBehind = (element: HTMLElement): Oklch => {
  const layers: Oklch[] = []
  let opaque = false
  for (let node = element.parentElement; node && !opaque; node = node.parentElement) {
    const layer = parseColour(window.getComputedStyle(node).backgroundColor)
    if (!layer || layer.alpha === 0) continue
    layers.push(layer)
    opaque = layer.alpha >= 1
  }
  // The opaque layer, or the canvas, is the base; translucent layers go over it, nearest last.
  let colour = opaque ? (layers.pop() ?? WHITE) : canvasColour()
  for (const layer of layers.reverse()) colour = compositeOver(layer, colour)
  return colour
}

/**
 * The text colour of `element` and the background behind it, for the colour picker's
 * contrast readout. An ancestor background that cannot be read as a colour is skipped.
 */
export const readContrastContext = (element: HTMLElement): ContrastContext => ({
  textColour: window.getComputedStyle(element).color,
  backgroundColour: formatColour(backgroundBehind(element)),
})
