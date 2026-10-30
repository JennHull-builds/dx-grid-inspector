import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AREA_HEIGHT, AREA_WIDTH, computeArea, type AreaContrast } from './areaPixels.ts'

const pixel = (data: Uint8ClampedArray, x: number, y: number) => {
  const o = (y * AREA_WIDTH + x) * 4
  return [data[o], data[o + 1], data[o + 2], data[o + 3]]
}

describe('computeArea', () => {
  it('has white at the top left, black at the bottom left, and a plain grey ramp between', () => {
    const data = computeArea(250, false, null)
    assert.equal(data.length, AREA_WIDTH * AREA_HEIGHT * 4)
    assert.deepEqual(pixel(data, 0, 0), [255, 255, 255, 255])
    assert.deepEqual(pixel(data, 0, AREA_HEIGHT - 1), [0, 0, 0, 255])
    const [r, g, b] = pixel(data, 0, Math.round(AREA_HEIGHT / 2))
    assert.ok(Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1, 'the left edge is grey')
  })

  it('leaves colours no screen can show clear', () => {
    // Blue at high chroma and high lightness is far outside every gamut.
    const data = computeArea(264, false, null)
    assert.equal(pixel(data, AREA_WIDTH - 1, 5)[3], 0)
  })

  it('paints Display P3 values brighter than sRGB ones at the same place', () => {
    // Pure sRGB red sits at a different P3 value, so the two buffers must differ somewhere vivid.
    const srgb = computeArea(29, false, null)
    const p3 = computeArea(29, true, null)
    let differing = 0
    for (let i = 0; i < srgb.length; i += 4) if (srgb[i] !== p3[i]) differing += 1
    assert.ok(differing > 1000, `only ${differing} pixels differ`)
  })

  it('draws a contrast line where the ratio crosses the threshold', () => {
    // Against black text, 3:1 needs luminance 0.1. On the grey edge luminance is lightness
    // cubed, so the line crosses the left edge at lightness 0.464, a little over halfway down.
    const contrast: AreaContrast = { against: 0, mixOver: [255, 255, 255], alpha: 1, lines: [{ ratio: 3, dashed: false }] }
    const data = computeArea(120, false, contrast)
    const whiteRows: number[] = []
    for (let y = 1; y < AREA_HEIGHT - 1; y += 1) {
      const [r, g, b] = pixel(data, 0, y)
      if (r === 255 && g === 255 && b === 255) whiteRows.push(y)
    }
    const expected = (1 - Math.cbrt(0.1)) * (AREA_HEIGHT - 1)
    assert.ok(whiteRows.length >= 1, 'a line crosses the left edge')
    assert.ok(
      whiteRows.every((y) => Math.abs(y - expected) <= 3),
      `rows ${whiteRows} are not near ${expected.toFixed(1)}`,
    )
  })

  it('draws a dashed line with fewer pixels than a solid one', () => {
    const base = { against: 0, mixOver: [255, 255, 255] as [number, number, number], alpha: 1 }
    const count = (dashed: boolean) => {
      const data = computeArea(120, false, { ...base, lines: [{ ratio: 3, dashed }] })
      let n = 0
      for (let i = 0; i < data.length; i += 4) if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) n += 1
      return n
    }
    assert.ok(count(true) < count(false))
  })
})
