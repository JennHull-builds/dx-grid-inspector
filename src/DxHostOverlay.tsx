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

/** Viewport box of the inspect highlight, already clipped to the visible host area. */
interface HighlightBox {
  top: number
  left: number
  width: number
  height: number
}

const chromeStripClassName =
  'dx:pointer-events-auto dx:z-20 dx:flex dx:shrink-0 dx:flex-wrap dx:items-center dx:justify-end dx:gap-2 dx:border-b dx:border-white/10 dx:bg-dx-surface-1 dx:px-3 dx:py-2'

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
  const [highlightBox, setHighlightBox] = useState<HighlightBox | null>(null)

  const syncHighlight = useCallback(() => {
    if (!targetElement || !hostRef.current) {
      setHighlightBox(null)
      return
    }
    if (!hostRef.current.contains(targetElement)) {
      setHighlightBox(null)
      return
    }
    // Clip to the host's visible area so a tall target never draws over UI outside it.
    const target = targetElement.getBoundingClientRect()
    const host = hostRef.current.getBoundingClientRect()
    const top = Math.max(target.top, host.top)
    const left = Math.max(target.left, host.left)
    const bottom = Math.min(target.bottom, host.bottom)
    const right = Math.min(target.right, host.right)
    setHighlightBox(
      bottom > top && right > left
        ? { top, left, width: right - left, height: bottom - top }
        : null,
    )
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
      data-dx-ui=""
      id={chromeId}
      className={chromeStripClassName}
      role="toolbar"
      aria-label="Overlay controls"
    >
      <button
        type="button"
        aria-pressed={enabled}
        title="Hide the overlay toolbar"
        onClick={() => onEnabledChange?.(false)}
        className="dx-toggle dx-toggle-active dx:min-h-9 dx:px-3"
      >
        Overlay on
      </button>
      <button
        type="button"
        aria-pressed={inspecting}
        title={
          inspecting
            ? 'Inspect mode is on. Press Escape to exit.'
            : 'Click a host element to inspect it'
        }
        onClick={() => onInspectingChange?.(!inspecting)}
        onKeyDown={(event) => {
          if (!isActivationKey(event.key)) return
          event.preventDefault()
          onInspectingChange?.(!inspecting)
        }}
        className={`dx-toggle dx:min-h-9 dx:px-3 ${
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
      className={`dx:relative dx:flex dx:min-h-0 dx:flex-1 dx:flex-col ${className}`.trim()}
    >
      {!placeChromeInline && chrome}

      <div
        ref={hostRef}
        className={`dx:relative dx:min-h-0 dx:flex-1 dx:overflow-auto ${
          inspecting ? 'dx:cursor-crosshair' : ''
        }`}
        onClickCapture={handleHostClick}
      >
        {renderChildren(placeChromeInline ? chrome : null)}
        {highlightBox && (
          <div
            aria-hidden="true"
            data-dx-overlay-chrome="true"
            data-dx-ui=""
            className="dx:pointer-events-none dx:fixed dx:z-10 dx:rounded-[4px] dx:border-2 dx:border-dx-accent dx:shadow-[0_0_0_1px_#A78BFA40]"
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
          data-dx-ui=""
          className="dx:pointer-events-none dx:absolute dx:bottom-3 dx:left-3 dx:z-20 dx:max-w-[min(100%,20rem)] dx:rounded-[8px] dx:border dx:border-white/10 dx:bg-dx-surface-0/90 dx:px-3 dx:py-2 dx:font-mono dx:text-[10px] dx:uppercase dx:tracking-wider dx:text-slate-400 dx:backdrop-blur-sm"
        >
          Click a host surface to calibrate. Escape exits inspect.
        </p>
      )}
    </div>
  )
}

export default DxHostOverlay
