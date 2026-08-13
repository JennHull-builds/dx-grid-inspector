import { useEffect, useRef, useState } from 'react'
import { TemplateGridManager } from './GridOverlay'
import {
  loadHarnessState,
  saveHarnessState,
  type HarnessState,
} from './harnessStorage'
import { LiveTokenPreview } from './LiveTokenPreview'
import { TokenCalibrationUnit } from './TokenCalibrationUnit'
import { readDesignPropertiesFromElement } from './tokenExport'
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
      bgPreset: '#1A1A2B',
      borderPreset: '#A78BFA',
    },
  }
}

const INITIAL_NODES: DesignNode[] = [
  createMockNode(0),
  createMockNode(1),
  createMockNode(2),
]

const FALLBACK_HARNESS: HarnessState = {
  nodes: INITIAL_NODES,
  selectedNodeId: INITIAL_NODES[0]?.id ?? null,
  nextIndex: INITIAL_NODES.length,
}

/**
 * Local testing harness for the grid manager, calibration HUD, and live preview.
 * Node list, selection, and next mock index are persisted in localStorage.
 */
function App() {
  const [initialHarness] = useState<HarnessState>(() =>
    loadHarnessState(FALLBACK_HARNESS),
  )
  const [nodes, setNodes] = useState<DesignNode[]>(initialHarness.nodes)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialHarness.selectedNodeId,
  )
  const [nextIndex, setNextIndex] = useState(initialHarness.nextIndex)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('nodes')
  const previewSurfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveHarnessState({ nodes, selectedNodeId, nextIndex })
  }, [nodes, selectedNodeId, nextIndex])

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

  const handleReadFromPreview = () => {
    const surface = previewSurfaceRef.current
    if (!selectedNodeId || !surface) return
    handleUpdateProperties(
      selectedNodeId,
      readDesignPropertiesFromElement(surface),
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

  const panelShell = 'min-h-0 flex-col overflow-visible'

  return (
    <div className="box-border flex h-dvh w-full flex-col overflow-hidden bg-[#0A0A10] text-slate-300">
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
                    ? 'border-[#A78BFA]/40 bg-[#A78BFA]/15 text-[#A78BFA] shadow-[0_0_6px_#A78BFA59]'
                    : 'border-white/10 bg-[#13131F] text-slate-400'
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
          className={`${panelShell} rounded-[16px] border border-white/5 bg-[#13131F] ${
            mobilePanel === 'calibrate' ? 'flex flex-1' : 'hidden'
          } lg:flex lg:h-full`}
        >
          <TokenCalibrationUnit
            key={selectedNodeId ?? 'none'}
            selectedNode={selectedNode}
            onUpdateProperties={handleUpdateProperties}
            onReadFromPreview={handleReadFromPreview}
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
            surfaceRef={previewSurfaceRef}
          />
        </div>
      </main>
    </div>
  )
}

export default App
