import { useState, type ReactNode } from 'react'
import { DxGridVoice } from './DxGridVoice'
import { DxHostOverlay } from './DxHostOverlay'
import { TokenCalibrationUnit } from './TokenCalibrationUnit'
import {
  applyDesignPropertiesToElement,
  readDesignPropertiesFromElement,
} from './tokenExport'
import type { DesignNode, DesignProperties } from './types'

export interface DxInspectorProps {
  /**
   * Your app. It renders in the space under the overlay toolbar, so give its root
   * `height: 100%` (`h-full`) rather than `100dvh`, or it overflows by the toolbar's height.
   */
  children: ReactNode
  /** Whether the overlay toolbar starts switched on. Defaults to `true`. */
  defaultEnabled?: boolean
  /** Show the clipboard voice prompt under the HUD. Defaults to `true`. */
  showVoice?: boolean
}

const createTargetNode = (properties: DesignProperties): DesignNode => ({
  id: 'overlay-target',
  name: 'Host inspect target',
  category: 'Content',
  status: 'In Progress',
  properties,
})

/**
 * Ready-made inspector: wraps your app with the overlay toolbar and puts the token HUD
 * (and optionally the voice prompt) beside it, or below it on narrow screens.
 * Fills the viewport. Render it only in development; see the README for the pattern.
 */
export function DxInspector({
  children,
  defaultEnabled = true,
  showVoice = true,
}: DxInspectorProps) {
  const [enabled, setEnabled] = useState(defaultEnabled)
  const [inspecting, setInspecting] = useState(false)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [node, setNode] = useState<DesignNode>(() =>
    createTargetNode({
      radius: 16,
      padding: 24,
      bgPreset: '#1A1A2B',
      borderPreset: '#A78BFA',
    }),
  )

  const handleTargetSelect = (element: HTMLElement) => {
    setTarget(element)
    setNode(createTargetNode(readDesignPropertiesFromElement(element)))
    setInspecting(false)
  }

  return (
    <div className="dx:flex dx:h-dvh dx:flex-col dx:bg-dx-surface-0 dx:lg:flex-row">
      <DxHostOverlay
        enabled={enabled}
        onEnabledChange={setEnabled}
        inspecting={inspecting}
        onInspectingChange={setInspecting}
        targetElement={target}
        onTargetSelect={handleTargetSelect}
        className="dx:min-h-0 dx:flex-1"
      >
        {(chrome) => (
          <div className="dx:flex dx:h-full dx:flex-col">
            {chrome ?? (
              <div
                data-dx-ui=""
                className="dx:flex dx:shrink-0 dx:justify-end dx:border-b dx:border-white/10 dx:bg-dx-surface-1 dx:px-3 dx:py-2"
              >
                <button
                  type="button"
                  onClick={() => setEnabled(true)}
                  className="dx-toggle dx:min-h-9 dx:px-3"
                >
                  Enable overlay
                </button>
              </div>
            )}
            <div className="dx:min-h-0 dx:flex-1">{children}</div>
          </div>
        )}
      </DxHostOverlay>
      <aside
        data-dx-ui=""
        aria-label="DX Grid Inspector"
        className="dx:flex dx:max-h-[45dvh] dx:shrink-0 dx:flex-col dx:gap-3 dx:overflow-y-auto dx:border-t dx:border-white/10 dx:p-3 dx:lg:max-h-full dx:lg:w-[22rem] dx:lg:border-l dx:lg:border-t-0"
      >
        <div className="dx:rounded-[16px] dx:border dx:border-white/5 dx:bg-dx-surface-2">
          <TokenCalibrationUnit
            key={target ? 'target' : 'idle'}
            selectedNode={target ? node : null}
            onUpdateProperties={(_id, properties) =>
              setNode((prev) => ({ ...prev, properties }))
            }
            onReadFromPreview={
              target
                ? () =>
                    setNode(createTargetNode(readDesignPropertiesFromElement(target)))
                : undefined
            }
            readLabel="Read from target"
            onApplyToTarget={
              target
                ? () => applyDesignPropertiesToElement(target, node.properties)
                : undefined
            }
            emptyHint="Turn on Inspect and click a host surface to calibrate tokens."
          />
        </div>
        {showVoice && <DxGridVoice properties={node.properties} nodeName={node.name} />}
      </aside>
    </div>
  )
}

export default DxInspector
