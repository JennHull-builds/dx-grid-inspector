// Run with: npm test (Node's built-in test runner, which runs TypeScript directly).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sanitizeColour, sanitizeHex } from './colourInput.ts'

describe('sanitizeHex', () => {
  it('keeps #RGB and #RRGGBB, upper case', () => {
    assert.equal(sanitizeHex('#1a1a2b'), '#1A1A2B')
    assert.equal(sanitizeHex('#fff'), '#FFF')
  })

  it('adds the # when it is missing', () => {
    assert.equal(sanitizeHex('a78bfa'), '#A78BFA')
    assert.equal(sanitizeHex('  abc '), '#ABC')
  })

  it('rejects characters that are not hex digits', () => {
    assert.equal(sanitizeHex('#GGGGGG'), null)
    assert.equal(sanitizeHex('#12 456'), null)
    assert.equal(sanitizeHex('#zzz'), null)
  })

  it('rejects other lengths', () => {
    assert.equal(sanitizeHex('#12'), null)
    assert.equal(sanitizeHex('#12345'), null)
    assert.equal(sanitizeHex(''), null)
  })
})

describe('sanitizeColour', () => {
  it('keeps rgb() and rgba() it can read', () => {
    assert.equal(sanitizeColour('rgb(26, 26, 43)'), 'rgb(26, 26, 43)')
    assert.equal(sanitizeColour('rgba(26, 26, 43, 0.5)'), 'rgba(26, 26, 43, 0.5)')
  })

  it('rejects rgb() it cannot read', () => {
    assert.equal(sanitizeColour('rgb(banana)'), null)
    assert.equal(sanitizeColour('rgb(1, 2)'), null)
  })

  it('keeps oklch(), oklab() and color() it can read', () => {
    assert.equal(sanitizeColour('oklch(0.7 0.15 283)'), 'oklch(0.7 0.15 283)')
    assert.equal(sanitizeColour('color(display-p3 1 0 0)'), 'color(display-p3 1 0 0)')
    assert.equal(sanitizeColour('oklch(nope)'), null)
  })

  it('falls back to hex', () => {
    assert.equal(sanitizeColour('#a78bfa'), '#A78BFA')
    assert.equal(sanitizeColour('#GGGGGG'), null)
  })
})
