import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AREA_HEIGHT, AREA_MAX_CHROMA, AREA_WIDTH, computeArea, contrastPaths, srgbEdge, type AreaContrast } from './areaPixels.ts'

const pixel = (data: Uint8ClampedArray, x: number, y: number) => {
  const o = (y * AREA_WIDTH + x) * 4
  return [data[o], data[o + 1], data[o + 2], data[o + 3]]
}

describe('computeArea', () => {
  it('has white at the top left, black at the bottom left, and a plain grey ramp between', () => {
    const data = computeArea(250, false)
    assert.equal(data.length, AREA_WIDTH * AREA_HEIGHT * 4)
    // The corners are the wedge's tips, smoothed like the rest of its edge, so alpha may be under 255.
    assert.deepEqual(pixel(data, 0, 0).slice(0, 3), [255, 255, 255])
    assert.deepEqual(pixel(data, 0, AREA_HEIGHT - 1).slice(0, 3), [0, 0, 0])
    assert.ok(pixel(data, 0, 0)[3] > 0 && pixel(data, 0, AREA_HEIGHT - 1)[3] > 0)
    const [r, g, b] = pixel(data, 0, Math.round(AREA_HEIGHT / 2))
    assert.ok(Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1, 'the left edge is grey')
  })

  it('leaves colours no screen can show clear', () => {
    // Blue at high chroma and high lightness is far outside every gamut.
    const data = computeArea(264, false)
    assert.equal(pixel(data, AREA_WIDTH - 1, 5)[3], 0)
  })

  it('paints Display P3 values brighter than sRGB ones at the same place', () => {
    // Pure sRGB red sits at a different P3 value, so the two buffers must differ somewhere vivid.
    const srgb = computeArea(29, false)
    const p3 = computeArea(29, true)
    let differing = 0
    for (let i = 0; i < srgb.length; i += 4) if (srgb[i] !== p3[i]) differing += 1
    assert.ok(differing > 1000, `only ${differing} pixels differ`)
  })

  it('smooths the edge of the area instead of cutting it in steps', () => {
    // Along the sloped edge, pixels are partly covered, so some alpha values sit between 0 and 255.
    const data = computeArea(294, false)
    let partial = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0 && data[i] < 255) partial += 1
    assert.ok(partial > 50, `only ${partial} partly covered pixels`)
  })

  it('draws at any size, so the canvas can match a sharp screen', () => {
    const data = computeArea(250, false, 576, 432)
    assert.equal(data.length, 576 * 432 * 4)
    const o = (431 * 576) * 4
    // The corners are the wedge's tips (pure white, pure black), so they may be partly covered.
    assert.deepEqual([data[0], data[1], data[2]], [255, 255, 255])
    assert.deepEqual([data[o], data[o + 1], data[o + 2]], [0, 0, 0])
    assert.ok(data[3] > 0 && data[o + 3] > 0, 'both corners are painted')
  })
})

describe('contrastPaths', () => {
  it('puts the line where the ratio crosses the threshold', () => {
    // Against black text, 3:1 needs luminance 0.1. On the grey edge luminance is lightness
    // cubed, so the line crosses the left edge at lightness 0.464, a little over halfway down.
    const contrast: AreaContrast = { against: 0, mixOver: [255, 255, 255], alpha: 1, lines: [{ ratio: 3, dashed: false }] }
    const [path] = contrastPaths(120, contrast)
    assert.equal(path.lines.length, 1, 'one line')
    const [u, v] = path.lines[0][0]
    assert.equal(u, 0)
    assert.ok(Math.abs(v - (1 - Math.cbrt(0.1))) < 0.002, `crosses at ${v}, not ${1 - Math.cbrt(0.1)}`)
  })

  it('keeps each threshold dashed or solid as asked', () => {
    const contrast: AreaContrast = {
      against: 0,
      mixOver: [255, 255, 255],
      alpha: 1,
      lines: [{ ratio: 4.5, dashed: false }, { ratio: 3, dashed: true }],
    }
    const paths = contrastPaths(120, contrast)
    assert.deepEqual(paths.map((p) => p.dashed), [false, true])
    assert.ok(paths.every((p) => p.lines.length >= 1))
  })
})

describe('contrastPaths against the picker readout', () => {
  it('puts every point of the line at the ratio the picker shows, inside the P3 zone too', async () => {
    const { gamutOf, ratioFromLuminance, relativeLuminance } = await import('./colourEngine.ts')
    // The Harness background, #13131F, has a luminance of about 0.0067.
    const against = 0.0067
    const contrast: AreaContrast = { against, mixOver: [255, 255, 255], alpha: 1, lines: [{ ratio: 4.5, dashed: false }] }
    let p3Points = 0
    for (const hue of [283, 295, 29, 150]) {
      const [path] = contrastPaths(hue, contrast)
      for (const line of path.lines) {
        for (const [u, v] of line) {
          const colour = { l: 1 - v, c: u * 0.37, h: hue, alpha: 1 }
          if (gamutOf(colour) === 'p3') p3Points += 1
          const ratio = ratioFromLuminance(relativeLuminance(colour), against)
          assert.ok(Math.abs(ratio - 4.5) < 0.15, `hue ${hue} at (${u.toFixed(3)}, ${v.toFixed(3)}): ${ratio.toFixed(2)}`)
        }
      }
    }
    assert.ok(p3Points > 0, 'the check reached the P3 zone')
  })
})

describe('srgbEdge', () => {
  it('sits where ordinary screens end: sRGB just inside, P3 only just past it', async () => {
    const { gamutOf } = await import('./colourEngine.ts')
    let points = 0
    for (const hue of [283, 29, 150, 250]) {
      for (const line of srgbEdge(hue)) {
        for (const [u, v] of line) {
          const c = u * AREA_MAX_CHROMA
          assert.equal(gamutOf({ l: 1 - v, c: c - 0.001, h: hue, alpha: 1 }), 'srgb')
          assert.equal(gamutOf({ l: 1 - v, c: c + 0.001, h: hue, alpha: 1 }), 'p3')
          points += 1
        }
      }
    }
    assert.ok(points > 100, `only ${points} points`)
  })
})
