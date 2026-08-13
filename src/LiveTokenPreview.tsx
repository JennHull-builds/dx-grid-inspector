import type { Ref } from 'react'
import type { DesignNode } from './types'

interface LiveTokenPreviewProps {
  selectedNode: DesignNode | null
  previewRadius: number
  previewPadding: number
  /** Measured by “Read from preview” — the token-styled card chrome. */
  surfaceRef: Ref<HTMLDivElement>
}

/**
 * Sample card + button that apply the selected node's spatial tokens.
 */
export function LiveTokenPreview({
  selectedNode,
  previewRadius,
  previewPadding,
  surfaceRef,
}: LiveTokenPreviewProps) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[16px] border border-white/5 bg-[#13131F] p-4 shadow-[0_0_8px_#A78BFA40] sm:p-6">
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
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed border-white/10 bg-[#0A0A10] p-4">
        {selectedNode ? (
          <div
            ref={surfaceRef}
            className="w-full max-w-xs border-2 text-slate-200 transition-all duration-200"
            style={{
              borderRadius: `${previewRadius}px`,
              padding: `${previewPadding}px`,
              backgroundColor: selectedNode.properties.bgPreset,
              borderColor: selectedNode.properties.borderPreset,
            }}
          >
            <p className="text-sm font-medium tracking-wide">{selectedNode.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Sample card using this node&apos;s radius, padding, fill, and border.
            </p>
            <button
              type="button"
              className="mt-3 border text-xs font-semibold uppercase tracking-wider text-slate-100 transition-all duration-200"
              style={{
                borderRadius: `${Math.max(previewRadius * 0.5, 4)}px`,
                padding: `${Math.max(previewPadding * 0.4, 6)}px ${previewPadding}px`,
                backgroundColor: selectedNode.properties.borderPreset,
                borderColor: selectedNode.properties.borderPreset,
                color: '#0A0A10',
              }}
            >
              Action
            </button>
            <p className="mt-3 font-mono text-xs text-slate-500">
              {previewRadius}px radius · {previewPadding}px padding
            </p>
          </div>
        ) : (
          <p className="px-4 text-center font-mono text-sm text-slate-500">
            Choose a node from the Template Grid Manager.
          </p>
        )}
      </div>
    </section>
  )
}
