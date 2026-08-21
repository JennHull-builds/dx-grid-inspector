import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

export type DxHostOverlayChildren =
  | ReactNode
  | ((chrome: ReactNode | null) => ReactNode)

export interface DxHostOverlayProps {
  /**
   * Host UI to wrap. Remains interactive when the overlay is off or inspect is off.
   * Pass a function to place the chrome strip yourself (e.g. under a host header).
   */
  children: DxHostOverlayChildren
  /**
   * When false, only children render — no chrome and no layout shift from
   * measurement UI.
   */
  enabled?: boolean
  /** Called when the user toggles the overlay chrome on or off. */
  onEnabledChange?: (enabled: boolean) => void
  /**
   * When true (and enabled), clicks on host descendants select an inspect target
   * instead of activating host controls.
   */
  inspecting?: boolean
  /** Called when the user toggles inspect mode. */
  onInspectingChange?: (inspecting: boolean) => void
  /**
   * Fires when the user picks a host element while inspecting.
   * The overlay chrome and its controls are never reported as targets.
   */
  onTargetSelect?: (element: HTMLElement) => void
  /** Optional highlight ring around the current inspect target. */
  targetElement?: HTMLElement | null
  /** Optional class on the outer wrapper. */
  className?: string
}

const isActivationKey = (key: string): boolean => key === 'Enter' || key === ' '

const chromeStripClassName =
  'pointer-events-auto z-20 flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-white/10 bg-dx-surface-1 px-3 py-2'

/**
 * Drop-in wrapper that renders host children plus optional non-destructive overlay chrome.
 * When `enabled` is false, children render alone with no measurement chrome.
 */
export function DxHostOverlay({
  children,
  enabled = true,
  onEnabledChange,
  inspecting = false,
  onInspectingChange,
  onTargetSelect,
  targetElement = null,
  className = '',
}: DxHostOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chromeId = useId()
  const [highlightBox, setHighlightBox] = useState<DOMRect | null>(null)

  const syncHighlight = useCallback(() => {
    if (!targetElement || !hostRef.current) {
      setHighlightBox(null)
      return
    }
    if (!hostRef.current.contains(targetElement)) {
      setHighlightBox(null)
      return
    }
    setHighlightBox(targetElement.getBoundingClientRect())
  }, [targetElement])

  useEffect(() => {
    syncHighlight()
    if (!targetElement) return

    const onScrollOrResize = () => syncHighlight()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [targetElement, syncHighlight])

  useEffect(() => {
    if (!enabled || !inspecting) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onInspectingChange?.(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, inspecting, onInspectingChange])

  const handleHostClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!enabled || !inspecting || !onTargetSelect) return

    const host = hostRef.current
    if (!host) return

    const path = event.nativeEvent.composedPath()
    let fallback: HTMLElement | null = null

    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue
      if (node.dataset.dxOverlayChrome === 'true') return
      if (node === host) continue
      if (!host.contains(node)) continue

      if (node.dataset.dxInspectable === 'true') {
        event.preventDefault()
        event.stopPropagation()
        onTargetSelect(node)
        return
      }

      if (fallback === null) {
        fallback = node
      }
    }

    if (fallback) {
      event.preventDefault()
      event.stopPropagation()
      onTargetSelect(fallback)
    }
  }

  const renderChildren = (chrome: ReactNode | null): ReactNode =>
    typeof children === 'function' ? children(chrome) : children

  if (!enabled) {
    return (
      <div className={className || undefined}>{renderChildren(null)}</div>
    )
  }

  const chrome = (
    <div
      data-dx-overlay-chrome="true"
      id={chromeId}
      className={chromeStripClassName}
      role="toolbar"
      aria-label="Overlay controls"
    >
      <button
        type="button"
        aria-pressed={enabled}
        aria-label="Toggle overlay chrome"
        onClick={() => onEnabledChange?.(false)}
        className="dx-toggle dx-toggle-active min-h-9 px-3"
      >
        Overlay on
      </button>
      <button
        type="button"
        aria-pressed={inspecting}
        aria-label={
          inspecting
            ? 'Inspect mode on. Press Escape to exit.'
            : 'Start inspect mode'
        }
        onClick={() => onInspectingChange?.(!inspecting)}
        onKeyDown={(event) => {
          if (!isActivationKey(event.key)) return
          event.preventDefault()
          onInspectingChange?.(!inspecting)
        }}
        className={`dx-toggle min-h-9 px-3 ${
          inspecting ? 'dx-toggle-active' : ''
        }`}
      >
        {inspecting ? 'Inspecting…' : 'Inspect'}
      </button>
    </div>
  )

  const placeChromeInline = typeof children === 'function'

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col ${className}`.trim()}
    >
      {!placeChromeInline && chrome}

      <div
        ref={hostRef}
        className={`relative min-h-0 flex-1 overflow-auto ${
          inspecting ? 'cursor-crosshair' : ''
        }`}
        onClickCapture={handleHostClick}
      >
        {renderChildren(placeChromeInline ? chrome : null)}
        {highlightBox && (
          <div
            aria-hidden="true"
            data-dx-overlay-chrome="true"
            className="pointer-events-none fixed z-10 rounded-[4px] border-2 border-dx-accent shadow-[0_0_0_1px_#A78BFA40]"
            style={{
              top: highlightBox.top,
              left: highlightBox.left,
              width: highlightBox.width,
              height: highlightBox.height,
            }}
          />
        )}
      </div>

      {inspecting && (
        <p
          data-dx-overlay-chrome="true"
          className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[min(100%,20rem)] rounded-[8px] border border-white/10 bg-dx-surface-0/90 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur-sm"
        >
          Click a host surface to calibrate. Escape exits inspect.
        </p>
      )}
    </div>
  )
}

export default DxHostOverlay
