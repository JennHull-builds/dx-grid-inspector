import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AREA_HEIGHT,
  AREA_MAX_CHROMA,
  AREA_WIDTH,
  computeArea,
  type AreaContrast,
  type AreaLine,
} from './areaPixels.ts'
import {
  compositeOver,
  contrastRatio,
  formatColour,
  formatOklch,
  gamutOf,
  hexFallback,
  hueDistance,
  nearestColour,
  parseColour,
  rateNonTextContrast,
  rateTextContrast,
  relativeLuminance,
  snapTarget,
  toSrgbBytes,
  type ContrastRating,
  type NamedColour,
  type Oklch,
} from './colourEngine.ts'
import type { PageToken } from './pageTokens.ts'

/** What the picked colour is measured against. */
export interface ColourPickerContrast {
  /**
   * `fill`: the pick is a surface, and `against` is the text drawn on it (4.5:1 and 3:1 lines).
   * `border`: the pick is a border, and `against` is the background behind the element (3:1).
   */
  role: 'fill' | 'border'
  /** A CSS colour. */
  against: string
  /** For a `fill`: what shows through a translucent fill. Defaults to white. */
  backdrop?: string
}

export interface ColourPickerProps {
  /** Names the field for assistive technology, for example "Surface Fill". */
  label: string
  /** The current colour as a CSS colour: `#RRGGBB`, `rgba()` or `oklch()`. Typing a new one moves the picker. */
  value: string
  /** The page's colour tokens. They are offered first, and the handle snaps onto them. */
  tokens: readonly PageToken[]
  /** What to measure contrast against. Omit it and no contrast is shown. */
  contrast?: ColourPickerContrast | null
  /** Called with the new colour on every change, in the formats the HUD stores. */
  onChange: (value: string) => void
  /** Enter was pressed: keep this colour. */
  onCommit: () => void
  /** Escape was pressed: put back the colour from before the picker opened. */
  onRevert: () => void
  /** Move focus to the colour area when the picker opens. */
  autoFocus?: boolean
}

const WHITE: Oklch = { l: 1, c: 0, h: 0, alpha: 1 }

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** Rounds away the drift that repeated arrow-key steps pile up. */
const tidy = (n: number): number => Math.round(n * 10000) / 10000

const HUE_GRADIENT = `linear-gradient(to right, ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]
  .map((hue) => `oklch(0.75 0.13 ${hue})`)
  .join(', ')})`

const CHECKERBOARD =
  'conic-gradient(#9ca3af 25%, #6b7280 0 50%, #9ca3af 0 75%, #6b7280 0)'

/** A colour over a checkerboard, so transparency can be seen. */
const overChecker = (layer: string): { backgroundImage: string; backgroundSize: string } => ({
  backgroundImage: `${layer}, ${CHECKERBOARD}`,
  backgroundSize: 'auto, 10px 10px',
})

const canvasPaintsP3 = (): boolean => {
  if (typeof document === 'undefined') return false
  try {
    const context = document.createElement('canvas').getContext('2d', { colorSpace: 'display-p3' })
    return context?.getContextAttributes().colorSpace === 'display-p3'
  } catch {
    return false
  }
}

interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>
}

const eyeDropperSupported = (): boolean => typeof window !== 'undefined' && 'EyeDropper' in window

/** The hue to keep when a new colour has none of its own (a grey). */
const withHueFrom = (next: Oklch, current: Oklch): Oklch =>
  next.c < 0.002 ? { ...next, h: current.h } : next

const focusRingClassName =
  'dx:focus-visible:outline-2 dx:focus-visible:outline-offset-2 dx:focus-visible:outline-dx-accent'
const labelClassName = 'dx:font-mono dx:text-xs dx:uppercase dx:tracking-wider dx:text-slate-400'
const noteClassName = 'dx:text-xs dx:leading-relaxed dx:text-slate-400'

const RATING_CLASSES: Record<ContrastRating, string> = {
  AAA: 'dx:text-dx-secondary',
  AA: 'dx:text-dx-secondary',
  'large text only': 'dx:text-dx-success',
  fails: 'dx:text-dx-danger',
}

const GAMUT_CHIPS = {
  srgb: { text: 'every screen', className: 'dx:text-dx-secondary' },
  p3: { text: 'P3 screens only', className: 'dx:text-dx-success' },
  none: { text: 'no screen can show this', className: 'dx:text-dx-danger' },
} as const

/**
 * Colour picker for the HUD's colour fields. It opens on the page's own colour tokens, shows
 * which screens can display the colour and whether it has enough contrast, and snaps the
 * handle onto a token during a pointer drag (hold Alt to turn that off). The colour area runs
 * lightness up and chroma across for the current hue, in OKLCH.
 *
 * Keyboard: the area takes focus; arrow keys move lightness (up, down) and chroma (left,
 * right), and Shift moves ten times as far. Enter keeps the colour and Escape puts the old one
 * back. The snap applies to pointer drags only, so the keyboard moves freely.
 */
export const ColourPicker: React.FC<ColourPickerProps> = ({
  label,
  value,
  tokens,
  contrast = null,
  onChange,
  onCommit,
  onRevert,
  autoFocus = false,
}) => {
  const ids = useId()
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [wide] = useState(canvasPaintsP3)
  const [canPickFromScreen] = useState(eyeDropperSupported)
  const [colour, setColour] = useState<Oklch>(() => parseColour(value) ?? WHITE)
  /** The last value sent to `onChange`. A different `value` arriving means the text field changed. */
  const [sentValue, setSentValue] = useState(value)
  const [note, setNote] = useState<string | null>(null)

  if (value !== sentValue) {
    setSentValue(value)
    const typed = parseColour(value)
    if (typed) setColour(withHueFrom(typed, colour))
  }

  const apply = (next: Oklch) => {
    const text = formatColour(next)
    setColour(next)
    setSentValue(text)
    setNote(null)
    onChange(text)
  }

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus()
  }, [autoFocus])

  const named = useMemo<NamedColour[]>(
    () => tokens.map((token) => ({ name: token.name, colour: token.colour })),
    [tokens],
  )
  const nearest = nearestColour(colour, named)
  const onToken = nearest !== null && nearest.distance < 0.001
  const gamut = gamutOf(colour)

  /* Contrast: what the pick is measured against, and what the area draws. */
  const role = contrast?.role
  const againstCss = contrast?.against
  const backdropCss = contrast?.backdrop
  const model = useMemo(() => {
    if (!role || !againstCss) return null
    const against = parseColour(againstCss)
    if (!against) return null
    if (role === 'fill') {
      const backdrop = compositeOver(parseColour(backdropCss ?? '') ?? WHITE, WHITE)
      const lines: AreaLine[] = [
        { ratio: 4.5, dashed: false },
        { ratio: 3, dashed: true },
      ]
      return { role, other: compositeOver(against, backdrop), backdrop, lines }
    }
    const background = compositeOver(against, WHITE)
    return {
      role,
      other: background,
      backdrop: background,
      lines: [{ ratio: 3, dashed: false }] as AreaLine[],
    }
  }, [role, againstCss, backdropCss])

  const ratio = model ? contrastRatio(compositeOver(colour, model.backdrop), model.other) : null
  const rating =
    ratio === null || !model
      ? null
      : model.role === 'fill'
        ? rateTextContrast(ratio)
        : rateNonTextContrast(ratio)

  /* The colour area is repainted when the hue, or what contrast is measured against, changes. */
  const alphaKey = model ? Math.round(colour.alpha * 100) : 100
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', wide ? { colorSpace: 'display-p3' } : undefined)
    if (!context) return
    const areaContrast: AreaContrast | null = model
      ? {
          against: relativeLuminance(model.other),
          mixOver: toSrgbBytes(model.backdrop),
          alpha: alphaKey / 100,
          lines: model.lines,
        }
      : null
    const image = context.createImageData(
      AREA_WIDTH,
      AREA_HEIGHT,
      wide ? { colorSpace: 'display-p3' } : undefined,
    )
    image.data.set(computeArea(colour.h, wide, areaContrast))
    context.putImageData(image, 0, 0)
  }, [colour.h, wide, model, alphaKey])

  /* Pointer: drag on the area. The handle snaps onto a token unless Alt is held. */
  const dragTo = (event: React.PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    const candidate: Oklch = { ...colour, l: 1 - y, c: x * AREA_MAX_CHROMA }
    const snap = event.altKey ? null : snapTarget(candidate, named)
    apply(snap ? withHueFrom({ ...snap.colour, alpha: colour.alpha }, colour) : candidate)
  }

  const onAreaKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const big = event.shiftKey ? 10 : 1
    let { l, c } = colour
    if (event.key === 'ArrowUp') l += 0.01 * big
    else if (event.key === 'ArrowDown') l -= 0.01 * big
    else if (event.key === 'ArrowRight') c += 0.005 * big
    else if (event.key === 'ArrowLeft') c -= 0.005 * big
    else return
    event.preventDefault()
    apply({ ...colour, l: tidy(clamp(l, 0, 1)), c: tidy(clamp(c, 0, AREA_MAX_CHROMA)) })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onRevert()
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      onCommit()
    }
  }

  const chooseToken = (token: Oklch) => apply(withHueFrom(token, colour))

  const pickFromScreen = async () => {
    try {
      const dropper = new (window as unknown as { EyeDropper: new () => EyeDropperLike }).EyeDropper()
      const { sRGBHex } = await dropper.open()
      const picked = parseColour(sRGBHex)
      if (picked) apply(withHueFrom({ ...picked, alpha: colour.alpha }, colour))
    } catch (error) {
      // Closing the eyedropper without picking is not a problem.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setNote('The eyedropper could not open on this page.')
      }
    }
  }

  const opaqueCss = formatOklch({ ...colour, alpha: 1 })
  const colourCss = formatOklch(colour)
  const distanceText = nearest ? (nearest.distance * 100).toFixed(1) : null
  const nearestAdvice =
    nearest === null
      ? ''
      : nearest.distance < 0.02
        ? 'Same to the eye. Use the token.'
        : nearest.distance < 0.05
          ? 'Close. Snap unless this is a new colour on purpose.'
          : 'No token is close. This would be a new colour.'
  const dots = tokens.filter(
    (token) => token.colour.c < 0.01 || hueDistance(token.colour.h, colour.h) <= 10,
  )
  const gamutChip = GAMUT_CHIPS[gamut]

  return (
    <div
      role="group"
      aria-label={`${label} colour picker`}
      onKeyDown={onKeyDown}
      className="dx:flex dx:flex-col dx:gap-3 dx:rounded-[12px] dx:border dx:border-white/10 dx:bg-dx-surface-0 dx:p-3"
    >
      <section aria-label="Page colour tokens" className="dx:flex dx:flex-col dx:gap-2">
        <p className={labelClassName}>Page tokens</p>
        {tokens.length > 0 ? (
          <ul className="dx:-m-1 dx:flex dx:max-h-40 dx:list-none dx:flex-wrap dx:gap-1.5 dx:overflow-y-auto dx:p-1">
            {tokens.map((token) => {
              const isCurrent = onToken && nearest?.name === token.name
              return (
                <li key={token.name} className="dx:max-w-full">
                  <button
                    type="button"
                    aria-pressed={isCurrent}
                    title={`${token.name}: ${token.value}`}
                    onClick={() => chooseToken(token.colour)}
                    className={`dx:inline-flex dx:min-h-8 dx:max-w-full dx:items-center dx:gap-1.5 dx:rounded-full dx:text-left dx:border dx:py-0.5 dx:pl-1.5 dx:pr-2.5 dx:font-mono dx:text-xs dx:transition-colors ${focusRingClassName} ${
                      isCurrent
                        ? 'dx:border-dx-accent dx:text-dx-accent'
                        : 'dx:border-white/10 dx:text-slate-300 dx:hover:border-white/25'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="dx:size-4 dx:shrink-0 dx:rounded-full dx:border dx:border-white/30"
                      style={overChecker(`linear-gradient(${token.value}, ${token.value})`)}
                    />
                    <span className="dx:min-w-0 dx:break-all dx:leading-tight">{token.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={noteClassName}>
            No colour tokens were found on this page. The picker still works as a plain OKLCH
            picker.
          </p>
        )}
      </section>

      <div className="dx:flex dx:flex-col dx:gap-1.5">
        <div
          ref={areaRef}
          role="slider"
          tabIndex={0}
          aria-label={`${label}: lightness and chroma`}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(colour.l * 100)}
          aria-valuetext={`Lightness ${Math.round(colour.l * 100)}%, chroma ${colour.c.toFixed(2)}`}
          aria-describedby={`${ids}-area-help`}
          onKeyDown={onAreaKeyDown}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            event.currentTarget.focus()
            dragTo(event)
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) dragTo(event)
          }}
          className={`dx:relative dx:aspect-[4/3] dx:w-full dx:cursor-crosshair dx:touch-none dx:rounded-[8px] ${focusRingClassName}`}
        >
          <canvas
            ref={canvasRef}
            width={AREA_WIDTH}
            height={AREA_HEIGHT}
            className="dx:block dx:h-full dx:w-full dx:rounded-[8px] dx:border dx:border-white/10 dx:bg-dx-surface-1"
          />
          {dots.map((token) => (
            <span
              key={token.name}
              aria-hidden="true"
              className="dx:pointer-events-none dx:absolute dx:size-2 dx:-translate-x-1/2 dx:-translate-y-1/2 dx:rounded-full dx:border dx:border-white dx:shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
              style={{
                left: `${(Math.min(token.colour.c, AREA_MAX_CHROMA) / AREA_MAX_CHROMA) * 100}%`,
                top: `${(1 - token.colour.l) * 100}%`,
                background: token.value,
              }}
            />
          ))}
          <span
            aria-hidden="true"
            className="dx:pointer-events-none dx:absolute dx:size-[18px] dx:-translate-x-1/2 dx:-translate-y-1/2 dx:rounded-full dx:border-2 dx:border-white dx:shadow-[0_0_0_1.5px_rgb(0_0_0/0.7),0_2px_6px_rgb(0_0_0/0.35)]"
            style={{
              left: `${(Math.min(colour.c, AREA_MAX_CHROMA) / AREA_MAX_CHROMA) * 100}%`,
              top: `${(1 - colour.l) * 100}%`,
              background: opaqueCss,
            }}
          />
        </div>
        <p id={`${ids}-area-help`} className={noteClassName}>
          Arrow keys move, Shift moves ten times as far. Hold Alt while dragging to skip the snap
          to tokens.
        </p>
        <p className={noteClassName}>
          Hatched: P3 screens only. Empty: no screen.
          {model &&
            (model.role === 'fill'
              ? ' White lines: 4.5:1 solid, 3:1 dashed.'
              : ' White line: 3:1.')}
        </p>
      </div>

      <div className="dx:flex dx:flex-col dx:gap-2">
        <label htmlFor={`${ids}-hue`} className={`${labelClassName} dx:flex dx:justify-between`}>
          <span>Hue</span>
          <span>{Math.round(colour.h)}°</span>
        </label>
        <input
          id={`${ids}-hue`}
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(colour.h)}
          aria-valuetext={`Hue ${Math.round(colour.h)} degrees`}
          onChange={(event) => apply({ ...colour, h: Number(event.target.value) })}
          className="dx-range"
          style={{ backgroundImage: HUE_GRADIENT }}
        />
        <label htmlFor={`${ids}-alpha`} className={`${labelClassName} dx:flex dx:justify-between`}>
          <span>Opacity</span>
          <span>{Math.round(colour.alpha * 100)}%</span>
        </label>
        <input
          id={`${ids}-alpha`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(colour.alpha * 100)}
          aria-valuetext={`Opacity ${Math.round(colour.alpha * 100)} percent`}
          onChange={(event) => apply({ ...colour, alpha: Number(event.target.value) / 100 })}
          className="dx-range"
          style={overChecker(`linear-gradient(to right, transparent, ${opaqueCss})`)}
        />
      </div>

      <div className="dx:flex dx:items-start dx:gap-3">
        <span
          aria-hidden="true"
          className="dx:size-12 dx:shrink-0 dx:rounded-[8px] dx:border dx:border-white/20"
          style={overChecker(`linear-gradient(${colourCss}, ${colourCss})`)}
        />
        <div className="dx:min-w-0 dx:flex-1 dx:font-mono dx:text-xs dx:leading-relaxed dx:text-slate-300">
          <p className="dx:break-words">{colourCss}</p>
          <p className="dx:break-words">
            {hexFallback(colour)}
            {gamut !== 'srgb' && (
              <span className="dx:text-slate-400"> (closest colour inside sRGB)</span>
            )}
          </p>
          <p className={gamutChip.className}>{gamutChip.text}</p>
        </div>
      </div>

      <div className="dx:flex dx:flex-col dx:gap-2">
        <p className={labelClassName}>Nearest token</p>
        {nearest ? (
          <>
            <p className="dx:break-all dx:font-mono dx:text-xs dx:leading-relaxed dx:text-slate-300">
              {onToken ? `On token ${nearest.name}` : `${nearest.name}, ${distanceText} away`}
            </p>
            {!onToken && <p className={noteClassName}>{nearestAdvice}</p>}
            {!onToken && (
              <div>
                <button
                  type="button"
                  onClick={() => chooseToken(nearest.colour)}
                  className={`dx-btn-secondary dx:min-h-8 dx:px-3 ${focusRingClassName}`}
                >
                  Snap
                </button>
              </div>
            )}
          </>
        ) : (
          <p className={noteClassName}>No tokens to compare with.</p>
        )}
        <p className="dx:sr-only" aria-live="polite">
          {onToken && nearest ? `Snapped to ${nearest.name}` : ''}
        </p>
      </div>

      <div className="dx:flex dx:flex-col dx:gap-1">
        <p className={labelClassName}>Contrast</p>
        {ratio !== null && rating !== null && model ? (
          <>
            <p className="dx:font-mono dx:text-xs dx:text-slate-300">
              {ratio.toFixed(2)}:1{' '}
              <span className={RATING_CLASSES[rating]}>{rating}</span>
            </p>
            <p className={noteClassName}>
              {model.role === 'fill'
                ? `Against the element's text colour, ${hexFallback(model.other)}.`
                : `Against the background behind the element, ${hexFallback(model.other)}.`}
            </p>
          </>
        ) : (
          <p className={noteClassName}>Select an element to see contrast.</p>
        )}
      </div>

      {canPickFromScreen && (
        <div className="dx:flex dx:flex-col dx:gap-1.5">
          <div>
            <button
              type="button"
              onClick={pickFromScreen}
              className={`dx-btn-secondary dx:min-h-8 dx:px-3 ${focusRingClassName}`}
            >
              Eyedropper
            </button>
          </div>
          {note && <p className={noteClassName}>{note}</p>}
        </div>
      )}

      <p className={noteClassName}>Enter keeps this colour. Esc puts back the old one.</p>
    </div>
  )
}
