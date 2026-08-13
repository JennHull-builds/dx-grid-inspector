import { useState } from 'react'
import { TemplateGridManager } from './GridOverlay'
import { TokenCalibrationUnit } from './TokenCalibrationUnit'
import type {
  DesignNode,
  DesignProperties,
  NodeCategory,
  NodeStatus,
} from './types'

type MobilePanel = 'nodes' | 'calibrate' | 'preview'

const MOBILE_TABS: Array<{ id: MobilePanel; label: string }> = [
  { id: 'nodes', label: 'Nodes' },
  { id: 'calibrate', label: 'Calibrate' },
  { id: 'preview', label: 'Preview' },
]

const isMobileViewport = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 1023px)').matches

interface LiveTokenPreviewProps {
  selectedNode: DesignNode | null
  previewRadius: number
  previewPadding: number
}

/**
 * Sample surface that reflects the selected node's calibrated spatial tokens.
 */
function LiveTokenPreview({
  selectedNode,
  previewRadius,
  previewPadding,
}: LiveTokenPreviewProps) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[16px] border border-white/5 bg-[#131322] p-4 shadow-[0_0_16px_rgba(167,139,250,0.08)] sm:p-6">
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
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed border-white/10 bg-[#0A0A12] p-4">
        {selectedNode ? (
          <div
            className="max-w-full border-2 text-sm text-slate-200 transition-all duration-200"
            style={{
              borderRadius: `${previewRadius}px`,
              padding: `${previewPadding}px`,
              backgroundColor: selectedNode.properties.bgPreset,
              borderColor: selectedNode.properties.borderPreset,
            }}
          >
            <p className="font-medium tracking-wide">{selectedNode.name}</p>
            <p className="mt-1 font-mono text-xs text-slate-400">
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

const CATEGORY_CYCLE: NodeCategory[] = [
  'Display',
  'Content',
  'Navigation',
  'Functional',
]

const createMockNode = (index: number): DesignNode => {
  const category = CATEGORY_CYCLE[index % CATEGORY_CYCLE.length]
  return {
    id: `node-${index + 1}`,
    name: `${category} Node ${index + 1}`,
    category,
    status: index % 2 === 0 ? 'Ready' : 'In Progress',
    properties: {
      radius: 12 + index * 2,
      padding: 16 + index * 4,
      bgPreset: '#1A1A2E',
      borderPreset: '#A78BFA',
    },
  }
}

const INITIAL_NODES: DesignNode[] = [
  createMockNode(0),
  createMockNode(1),
  createMockNode(2),
]

/**
 * Local testing harness for the grid overlay and token calibration components.
 */
function App() {
  const [nodes, setNodes] = useState<DesignNode[]>(INITIAL_NODES)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    INITIAL_NODES[0]?.id ?? null,
  )
  const [nextIndex, setNextIndex] = useState(INITIAL_NODES.length)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('nodes')

  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? null

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id)
    if (id && isMobileViewport()) {
      setMobilePanel('calibrate')
    }
  }

  const handleAddNode = () => {
    const node = createMockNode(nextIndex)
    setNodes((prev) => [...prev, node])
    setSelectedNodeId(node.id)
    setNextIndex((prev) => prev + 1)
    if (isMobileViewport()) {
      setMobilePanel('calibrate')
    }
  }

  const handlePurgeNode = (id: string) => {
    setNodes((prev) => prev.filter((node) => node.id !== id))
    setSelectedNodeId((prev) => (prev === id ? null : prev))
  }

  const handleUpdateProperties = (
    id: string,
    properties: DesignProperties,
  ) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, properties } : node,
      ),
    )
  }

  const handleUpdateStatus = (id: string, status: NodeStatus) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === id ? { ...node, status } : node)),
    )
  }

  const previewRadius =
    selectedNode == null
      ? 12
      : typeof selectedNode.properties.radius === 'number'
        ? selectedNode.properties.radius
        : Number.parseFloat(String(selectedNode.properties.radius)) || 12
  const previewPadding =
    selectedNode == null
      ? 16
      : typeof selectedNode.properties.padding === 'number'
        ? selectedNode.properties.padding
        : Number.parseFloat(String(selectedNode.properties.padding)) || 16

  const panelShell = 'min-h-0 flex-col overflow-hidden'

  return (
    <div className="box-border flex h-dvh w-full flex-col overflow-hidden bg-[#0A0A12] text-slate-300">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        <p className="min-w-0 truncate font-mono text-xs uppercase tracking-[0.12em] text-[#A78BFA]/80">
          DX Spatial Grid &amp; Token Inspector
        </p>
        <nav
          className="flex shrink-0 items-center gap-2"
          aria-label="Project links"
        >
          <a
            href="https://github.com/JennHull-builds/dx-grid-inspector"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-[#A78BFA]"
          >
            GitHub
          </a>
          <span className="text-white/20" aria-hidden="true">
            ·
          </span>
          <a
            href="https://github.com/JennHull-builds/dx-grid-inspector/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-[#A78BFA]"
          >
            MIT Licence
          </a>
        </nav>
      </header>

      <header className="shrink-0 border-b border-white/5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
        <h1 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">
          Local Testing Harness
        </h1>
        <nav className="grid grid-cols-3 gap-1.5" aria-label="Inspector panels">
          {MOBILE_TABS.map((tab) => {
            const isActive = mobilePanel === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobilePanel(tab.id)}
                className={`min-h-11 rounded-[12px] border font-mono text-xs font-semibold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'border-[#A78BFA]/40 bg-[#A78BFA]/15 text-[#A78BFA] shadow-[0_0_16px_rgba(167,139,250,0.15)]'
                    : 'border-white/10 bg-[#131322] text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
        {selectedNode && (
          <p className="mt-2 truncate font-mono text-xs text-slate-500">
            Active: {selectedNode.name}
          </p>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:p-6">
        <div
          className={`${panelShell} ${
            mobilePanel === 'nodes' ? 'flex flex-1' : 'hidden'
          } lg:flex lg:h-full`}
        >
          <TemplateGridManager
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            onPurgeNode={handlePurgeNode}
            onAddNode={handleAddNode}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>

        <div
          className={`${panelShell} rounded-[16px] border border-white/5 bg-[#131322] shadow-[0_0_16px_rgba(167,139,250,0.08)] ${
            mobilePanel === 'calibrate' ? 'flex flex-1' : 'hidden'
          } lg:flex lg:h-full`}
        >
          <TokenCalibrationUnit
            key={selectedNodeId ?? 'none'}
            selectedNode={selectedNode}
            onUpdateProperties={handleUpdateProperties}
          />
        </div>

        <div
          className={`${panelShell} ${
            mobilePanel === 'preview' ? 'flex flex-1' : 'hidden'
          } lg:flex lg:h-full`}
        >
          <LiveTokenPreview
            selectedNode={selectedNode}
            previewRadius={previewRadius}
            previewPadding={previewPadding}
          />
        </div>
      </main>
    </div>
  )
}

export default App
