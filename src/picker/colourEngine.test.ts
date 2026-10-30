// Run with: npm test (Node's built-in test runner, which runs TypeScript directly).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  JUST_NOTICEABLE_DIFFERENCE,
  MAGNETIC_SNAP_DISTANCE,
  P3_TO_SRGB,
  SRGB_TO_P3,
  compositeOver,
  contrastRatio,
  deltaEOK,
  formatColour,
  formatOklch,
  gamutOf,
  hexFallback,
  hueDistance,
  invertMatrix,
  mapToSrgb,
  nearestColour,
  oklabToSrgbBytes,
  parseColour,
  rateNonTextContrast,
  rateTextContrast,
  relativeLuminance,
  snapTarget,
  toSrgbBytes,
  type NamedColour,
  type Oklch,
} from './colourEngine.ts'

const must = (css: string): Oklch => {
  const parsed = parseColour(css)
  assert.ok(parsed, `expected "${css}" to parse`)
  return parsed
}

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} is not within ${tolerance} of ${expected}`,
  )

describe('matrices', () => {
  it('Display P3 to sRGB matches the published values', () => {
    const expected = [
      [1.2249401, -0.2249404, 0],
      [-0.0420569, 1.0420571, 0],
      [-0.0196376, -0.0786361, 1.0982735],
    ]
    expected.forEach((row, i) => row.forEach((v, j) => near(P3_TO_SRGB[i][j], v, 2e-4, `[${i}][${j}]`)))
  })

  it('the two directions undo each other', () => {
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const cell = SRGB_TO_P3[i].reduce((sum, v, k) => sum + v * P3_TO_SRGB[k][j], 0)
        near(cell, i === j ? 1 : 0, 1e-9, `identity[${i}][${j}]`)
      }
    }
    const back = invertMatrix(invertMatrix(P3_TO_SRGB))
    near(back[2][2], P3_TO_SRGB[2][2], 1e-9, 'double inverse')
  })
})

describe('parseColour', () => {
  it('reads the sRGB primaries as the values CSS Color 4 publishes', () => {
    const red = must('#ff0000')
    near(red.l, 0.62796, 5e-4, 'red l')
    near(red.c, 0.25768, 5e-4, 'red c')
    near(red.h, 29.23, 0.1, 'red h')
    const green = must('#00ff00')
    near(green.l, 0.86644, 5e-4, 'green l')
    near(green.c, 0.29483, 5e-4, 'green c')
    near(green.h, 142.5, 0.1, 'green h')
    const blue = must('#0000ff')
    near(blue.l, 0.45201, 5e-4, 'blue l')
    near(blue.c, 0.31321, 5e-4, 'blue c')
    near(blue.h, 264.05, 0.1, 'blue h')
  })

  it('reads white and black as lightness 1 and 0 with no chroma', () => {
    const white = must('#ffffff')
    near(white.l, 1, 1e-4, 'white l')
    assert.equal(white.c, 0)
    const black = must('#000')
    near(black.l, 0, 1e-4, 'black l')
    assert.equal(black.c, 0)
  })

  it('treats every way of writing a colour as the same colour', () => {
    const red = must('#ff0000')
    for (const css of [
      '#f00',
      '#F00',
      'rgb(255 0 0)',
      'rgb(255, 0, 0)',
      'rgba(255, 0, 0, 1)',
      'rgb(100% 0% 0%)',
      'color(srgb 1 0 0)',
      'oklch(62.796% 0.25768 29.234)',
      'oklab(0.62796 0.22486 0.12585)',
    ]) {
      assert.ok(deltaEOK(must(css), red) < 1e-3, css)
    }
    assert.ok(deltaEOK(must('color(display-p3 1 1 1)'), must('#fff')) < 1e-4)
    assert.ok(deltaEOK(must('color(display-p3 0.5 0.5 0.5)'), must('color(srgb 0.5 0.5 0.5)')) < 1e-4)
  })

  it('reads alpha in every form that carries it', () => {
    near(must('#ff000080').alpha, 128 / 255, 1e-9, '#rrggbbaa')
    near(must('#f008').alpha, 136 / 255, 1e-9, '#rgba')
    assert.equal(must('rgb(255 0 0 / 50%)').alpha, 0.5)
    assert.equal(must('rgba(255, 0, 0, 0.25)').alpha, 0.25)
    assert.equal(must('oklch(0.5 0.1 120 / 0.4)').alpha, 0.4)
    assert.equal(must('color(srgb 1 0 0 / 0.1)').alpha, 0.1)
    assert.equal(must('#fff').alpha, 1)
  })

  it('reads hue in every unit', () => {
    near(must('oklch(0.5 0.1 120deg)').h, 120, 1e-9, 'deg')
    near(must('oklch(0.5 0.1 0.25turn)').h, 90, 1e-9, 'turn')
    near(must('oklch(0.5 0.1 -90)').h, 270, 1e-9, 'negative')
    near(must('oklch(0.5 0.1 400)').h, 40, 1e-9, 'wraps')
  })

  it('returns null for anything it does not understand', () => {
    for (const css of [
      '',
      'red',
      'hsl(0 100% 50%)',
      '#12',
      '#12345',
      'rgb(1 2)',
      'rgb(1 2 3 4 5)',
      'oklch(0.5 0.1)',
      'color(rec2020 1 0 0)',
      'oklch(abc 0.1 20)',
      'var(--brand)',
    ]) {
      assert.equal(parseColour(css), null, `"${css}"`)
    }
  })
})

describe('gamutOf', () => {
  it('puts ordinary colours in sRGB', () => {
    for (const css of ['#c7f300', '#a78bfa', '#13131f', 'rgb(220 38 38)', 'oklch(0.62 0.19 255)']) {
      assert.equal(gamutOf(must(css)), 'srgb', css)
    }
  })

  it('puts vivid colours in P3 only', () => {
    assert.equal(gamutOf(must('color(display-p3 0 1 0.3)')), 'p3')
    assert.equal(gamutOf(must('oklch(0.8 0.27 150)')), 'p3')
  })

  it('puts impossible colours in no gamut', () => {
    assert.equal(gamutOf(must('oklch(0.9 0.4 150)')), 'none')
  })
})

describe('mapToSrgb', () => {
  it('leaves a colour inside sRGB alone', () => {
    assert.deepEqual(toSrgbBytes(must('#c7f300')), [0xc7, 0xf3, 0x00])
    assert.equal(hexFallback(must('#a78bfa')), '#A78BFA')
  })

  it('lowers chroma, and keeps lightness and hue, for a colour outside sRGB', () => {
    const vivid = must('oklch(0.7 0.33 150)')
    assert.notEqual(gamutOf(vivid), 'srgb')
    const mapped = must(hexFallback(vivid))
    assert.equal(gamutOf(mapped), 'srgb')
    assert.ok(mapped.c < vivid.c, 'chroma went down')
    near(mapped.l, vivid.l, 0.03, 'lightness')
    near(mapped.h, vivid.h, 4, 'hue')
  })

  it('returns white at lightness 1 and black at 0', () => {
    assert.deepEqual(mapToSrgb({ l: 1.2, c: 0.3, h: 40, alpha: 1 }), [1, 1, 1])
    assert.deepEqual(mapToSrgb({ l: 0, c: 0.3, h: 40, alpha: 1 }), [0, 0, 0])
  })
})

describe('formatting', () => {
  it('writes #RRGGBB for an opaque colour inside sRGB', () => {
    assert.equal(formatColour(must('#c7f300')), '#C7F300')
    assert.equal(formatColour(must('rgb(220 38 38)')), '#DC2626')
  })

  it('writes rgba() for a translucent colour inside sRGB', () => {
    assert.equal(formatColour(must('rgb(255 0 0 / 50%)')), 'rgba(255, 0, 0, 0.5)')
  })

  it('writes oklch() only outside sRGB, with a / alpha part when translucent', () => {
    const p3 = formatColour(must('color(display-p3 0 1 0.3)'))
    assert.match(p3, /^oklch\([\d.]+% [\d.]+ [\d.]+\)$/)
    const translucent = formatColour(must('color(display-p3 0 1 0.3 / 0.5)'))
    assert.match(translucent, /^oklch\([\d.]+% [\d.]+ [\d.]+ \/ 0\.5\)$/)
  })

  it('keeps all 3000 sample hex colours unchanged on the way through', () => {
    let seed = 12345
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed % 256
    }
    for (let i = 0; i < 3000; i += 1) {
      const hex = `#${[next(), next(), next()].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
      assert.equal(formatColour(must(hex)), hex)
    }
  })

  it('reads its own oklch() text back as nearly the same colour', () => {
    const original = must('oklch(0.8 0.27 150 / 0.7)')
    const again = must(formatOklch(original))
    assert.ok(deltaEOK(original, again) < 2e-3)
    near(again.alpha, 0.7, 1e-9, 'alpha')
  })
})

describe('oklabToSrgbBytes', () => {
  it('clips to the sRGB cube', () => {
    assert.deepEqual(oklabToSrgbBytes(1, 0, 0), [255, 255, 255])
    assert.deepEqual(oklabToSrgbBytes(0, 0, 0), [0, 0, 0])
    assert.deepEqual(oklabToSrgbBytes(0.62796, 0.22486, 0.12585), [255, 0, 0])
    const [r, g, b] = oklabToSrgbBytes(0.9, 0.5, 0.5)
    assert.ok([r, g, b].every((v) => v >= 0 && v <= 255))
  })
})

describe('contrast', () => {
  it('matches the WCAG 2 reference ratios', () => {
    near(contrastRatio(must('#000'), must('#fff')), 21, 1e-9, 'black on white')
    near(contrastRatio(must('#fff'), must('#fff')), 1, 1e-9, 'white on white')
    near(contrastRatio(must('#767676'), must('#fff')), 4.54, 0.005, '#767676 on white')
    near(contrastRatio(must('#777'), must('#fff')), 4.48, 0.005, '#777 on white')
  })

  it('is the same whichever colour is the foreground', () => {
    near(contrastRatio(must('#a78bfa'), must('#1a1a2b')), contrastRatio(must('#1a1a2b'), must('#a78bfa')), 1e-9, 'symmetric')
  })

  it('mixes a translucent foreground over the background first', () => {
    near(
      contrastRatio(must('rgb(0 0 0 / 50%)'), must('#fff')),
      contrastRatio(must('#808080'), must('#fff')),
      0.01,
      'half black on white',
    )
  })

  it('rates text and non-text separately', () => {
    assert.equal(rateTextContrast(7), 'AAA')
    assert.equal(rateTextContrast(4.5), 'AA')
    assert.equal(rateTextContrast(4.49), 'large text only')
    assert.equal(rateTextContrast(2.99), 'fails')
    assert.equal(rateNonTextContrast(3), 'AA')
    assert.equal(rateNonTextContrast(2.99), 'fails')
  })
})

describe('mixing and luminance', () => {
  it('mixes a translucent colour over what is behind it, over white first', () => {
    assert.equal(formatColour(compositeOver(must('rgb(0 0 0 / 50%)'), must('#fff'))), '#808080')
    assert.equal(formatColour(compositeOver(must('#ff0000'), must('#00ff00'))), '#FF0000')
    assert.equal(formatColour(compositeOver(must('rgb(0 0 0 / 0)'), must('rgb(255 0 0 / 0)'))), '#FFFFFF')
    assert.equal(compositeOver(must('rgb(0 0 0 / 50%)'), must('#fff')).alpha, 1)
  })

  it('measures relative luminance on the shown sRGB colour', () => {
    near(relativeLuminance(must('#fff')), 1, 1e-9, 'white')
    near(relativeLuminance(must('#000')), 0, 1e-9, 'black')
    near(relativeLuminance(must('#ff0000')), 0.2126, 1e-6, 'red')
  })

  it('finds the shortest way round the hue circle', () => {
    assert.equal(hueDistance(350, 10), 20)
    assert.equal(hueDistance(10, 350), 20)
    assert.equal(hueDistance(0, 180), 180)
    assert.equal(hueDistance(120, 120), 0)
  })
})

describe('tokens', () => {
  const tokens: NamedColour[] = [
    { name: '--brand-500', colour: must('oklch(0.62 0.19 255)') },
    { name: '--accent', colour: must('#c7f300') },
    { name: '--danger', colour: must('rgb(220 38 38)') },
  ]

  it('measures distance in OKLab', () => {
    near(deltaEOK(must('#000'), must('#fff')), 1, 1e-3, 'black to white')
    assert.equal(deltaEOK(must('#c7f300'), must('#c7f300')), 0)
    near(deltaEOK(must('#c7f300'), must('#a78bfa')), deltaEOK(must('#a78bfa'), must('#c7f300')), 1e-12, 'symmetric')
  })

  it('finds the nearest token', () => {
    const nearest = nearestColour(must('#c8f200'), tokens)
    assert.equal(nearest?.name, '--accent')
    assert.ok((nearest?.distance ?? 1) < 0.01)
    assert.equal(nearestColour(must('#fff'), []), null)
  })

  it('snaps only within the magnetic distance', () => {
    assert.equal(MAGNETIC_SNAP_DISTANCE, JUST_NOTICEABLE_DIFFERENCE)
    assert.equal(snapTarget(must('#c8f200'), tokens)?.name, '--accent')
    assert.equal(snapTarget(must('#808080'), tokens), null)
    assert.equal(snapTarget(must('#c8f200'), tokens, 0), null)
  })
})
