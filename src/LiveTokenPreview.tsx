import type { CSSProperties, Ref } from 'react'
import type { DesignNode } from './types'

interface LiveTokenPreviewProps {
  selectedNode: DesignNode | null
  previewRadius: number
  previewPadding: number
  /** Measured by “Read from preview” — the token-styled card chrome. */
  surfaceRef: Ref<HTMLDivElement>
}

interface SampleChrome {
  radius: number
  padding: number
  fill: string
  border: string
}

const FALLBACK_INK = '#E2E8F0'
const FALLBACK_ON_ACCENT = '#0A0A10'

const hexLuminance = (value: string): number | null => {
  const clean = value.trim().replace('#', '')
  const full =
    clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean
  if (full.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(full)) return null
  const r = Number.parseInt(full.slice(0, 2), 16) / 255
  const g = Number.parseInt(full.slice(2, 4), 16) / 255
  const b = Number.parseInt(full.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Picks dark or light ink so sample copy stays readable on the token fill. */
const contrastingInk = (colour: string, fallback: string): string => {
  const luminance = hexLuminance(colour)
  if (luminance == null) return fallback
  return luminance > 0.55 ? FALLBACK_ON_ACCENT : FALLBACK_INK
}

const cardStyle = (chrome: SampleChrome): CSSProperties => ({
  borderRadius: `${chrome.radius}px`,
  padding: `${chrome.padding}px`,
  backgroundColor: chrome.fill,
  borderColor: chrome.border,
  color: contrastingInk(chrome.fill, FALLBACK_INK),
})

const buttonRadius = (radius: number): number => Math.max(radius * 0.5, 4)

const primaryButtonStyle = (chrome: SampleChrome): CSSProperties => ({
  borderRadius: `${buttonRadius(chrome.radius)}px`,
  padding: `${Math.max(chrome.padding * 0.35, 8)}px ${chrome.padding}px`,
  backgroundColor: chrome.border,
  borderColor: chrome.border,
  color: contrastingInk(chrome.border, FALLBACK_ON_ACCENT),
})

const ghostButtonStyle = (chrome: SampleChrome): CSSProperties => ({
  borderRadius: `${buttonRadius(chrome.radius)}px`,
  padding: `${Math.max(chrome.padding * 0.35, 8)}px ${chrome.padding}px`,
  backgroundColor: 'transparent',
  borderColor: chrome.border,
  color: contrastingInk(chrome.fill, FALLBACK_INK),
})

/**
 * Live card and button that apply the selected node's radius, padding, fill, and border.
 */
export function LiveTokenPreview({
  selectedNode,
  previewRadius,
  previewPadding,
  surfaceRef,
}: LiveTokenPreviewProps) {
  const chrome: SampleChrome | null = selectedNode
    ? {
        radius: previewRadius,
        padding: previewPadding,
        fill: selectedNode.properties.bgPreset,
        border: selectedNode.properties.borderPreset,
      }
    : null

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[16px] border border-white/5 bg-[#13131F] p-4 sm:p-6">
      <div className="mb-4 shrink-0 border-b border-white/5 pb-3">
        <h2 className="text-base font-semibold uppercase tracking-wide text-slate-300">
          Live Token Preview
        </h2>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {selectedNode
            ? `Surface for ${selectedNode.name}`
            : 'Select a node to preview calibrated tokens'}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-white/10 bg-[#0A0A10] p-4">
        {chrome ? (
          <>
            <article
              ref={surfaceRef}
              className="w-full max-w-xs border-2 transition-all duration-200"
              style={cardStyle(chrome)}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
                {selectedNode?.category}
              </p>
              <h3 className="mt-1 text-sm font-semibold tracking-wide">
                Confirm layout
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed opacity-75">
                Review this surface, then apply the calibrated chrome to the
                selected node.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="border font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-200"
                  style={primaryButtonStyle(chrome)}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="border font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-200"
                  style={ghostButtonStyle(chrome)}
                >
                  Dismiss
                </button>
              </div>
            </article>
            <p className="font-mono text-xs text-slate-500">
              {chrome.radius}px radius · {chrome.padding}px padding
            </p>
          </>
        ) : (
          <p className="px-4 text-center font-mono text-sm text-slate-500">
            Choose a node from the Template Grid Manager.
          </p>
        )}
      </div>
    </section>
  )
}
