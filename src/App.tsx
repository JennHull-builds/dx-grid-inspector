import { useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { DxGridVoice } from './DxGridVoice'
import { DxHostOverlay } from './DxHostOverlay'
import { TemplateGridManager } from './GridOverlay'
import {
  loadHarnessState,
  saveHarnessState,
  type HarnessState,
} from './harnessStorage'
import { HostDemoSurface } from './HostDemoSurface'
import { LiveTokenPreview } from './LiveTokenPreview'
import { TokenCalibrationUnit } from './TokenCalibrationUnit'
import {
  applyDesignPropertiesToElement,
  readDesignPropertiesFromElement,
} from './tokenExport'
import type {
  DesignNode,
  DesignProperties,
  NodeCategory,
  NodeStatus,
} from './types'

type AppMode = 'harness' | 'overlay'
type MobilePanel = 'nodes' | 'calibrate' | 'preview'

const MOBILE_TABS: Array<{ id: MobilePanel; label: string }> = [
  { id: 'nodes', label: 'Nodes' },
  { id: 'calibrate', label: 'Calibrate' },
  { id: 'preview', label: 'Preview' },
]

const MODE_TABS: Array<{ id: AppMode; label: string }> = [
  { id: 'harness', label: 'Harness' },
  { id: 'overlay', label: 'Overlay demo' },
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

const OVERLAY_NODE_ID = 'overlay-target'

const createOverlayNode = (properties: DesignProperties): DesignNode => ({
  id: OVERLAY_NODE_ID,
  name: 'Host inspect target',
  category: 'Content',
  status: 'In Progress',
  properties,
})

/**
 * Local testing shell: three-panel harness, or overlay demo wrapping host UI.
 * Node list, selection, and next mock index are persisted in localStorage.
 */
function App() {
  const [initialHarness] = useState<HarnessState>(() =>
    loadHarnessState(FALLBACK_HARNESS),
  )
  const [appMode, setAppMode] = useState<AppMode>('harness')
  const [nodes, setNodes] = useState<DesignNode[]>(initialHarness.nodes)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialHarness.selectedNodeId,
  )
  const [nextIndex, setNextIndex] = useState(initialHarness.nextIndex)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('nodes')
  const previewSurfaceRef = useRef<HTMLDivElement>(null)

  const [overlayEnabled, setOverlayEnabled] = useState(true)
  const [inspecting, setInspecting] = useState(false)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [overlayNode, setOverlayNode] = useState<DesignNode>(() =>
    createOverlayNode({
      radius: 16,
      padding: 24,
      bgPreset: '#1A1A2B',
      borderPreset: '#A78BFA',
    }),
  )

  useEffect(() => {
    saveHarnessState({ nodes, selectedNodeId, nextIndex })
  }, [nodes, selectedNodeId, nextIndex])

  const handleSetAppMode = (mode: AppMode) => {
    setAppMode(mode)
    if (mode !== 'overlay') {
      setInspecting(false)
    }
  }

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

  /** Copies computed preview styles into the selected node's DesignProperties. */
  const handleReadFromPreview = () => {
    const surface = previewSurfaceRef.current
    if (!selectedNodeId || !surface) return
    handleUpdateProperties(
      selectedNodeId,
      readDesignPropertiesFromElement(surface),
    )
  }

  const handleOverlayTargetSelect = (element: HTMLElement) => {
    const properties = readDesignPropertiesFromElement(element)
    setTargetElement(element)
    setOverlayNode(createOverlayNode(properties))
    setInspecting(false)
  }

  const handleOverlayUpdateProperties = (
    _id: string,
    properties: DesignProperties,
  ) => {
    setOverlayNode((prev) => ({ ...prev, properties }))
  }

  const handleReadFromTarget = () => {
    if (!targetElement) return
    setOverlayNode(
      createOverlayNode(readDesignPropertiesFromElement(targetElement)),
    )
  }

  const handleApplyToTarget = () => {
    if (!targetElement) return
    applyDesignPropertiesToElement(targetElement, overlayNode.properties)
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
    <div className="box-border flex h-dvh w-full flex-col overflow-hidden bg-dx-surface-0 text-slate-300">
      <Analytics />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        <p className="dx-wordmark flex min-w-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-300">
          <span
            className="size-2.5 shrink-0 border-l border-t border-dx-secondary"
            aria-hidden="true"
          />
          <span className="truncate">DX Spatial Grid &amp; Token Inspector</span>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <nav className="dx-segment-track" aria-label="App mode">
            {MODE_TABS.map((tab) => {
              const isActive = appMode === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSetAppMode(tab.id)}
                  className={`dx-segment min-h-8 px-2.5 text-[10px] sm:px-3 sm:text-xs ${
                    isActive ? 'dx-segment-active' : ''
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
          <nav
            className="hidden items-center gap-2 sm:flex"
            aria-label="Project links"
          >
            <a
              href="https://github.com/JennHull-builds/dx-grid-inspector"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-dx-accent"
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
              className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-dx-accent"
            >
              MIT Licence
            </a>
          </nav>
        </div>
      </header>

      {appMode === 'harness' ? (
        <>
          <header className="shrink-0 border-b border-white/5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
            <h1 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">
              Local Testing Harness
            </h1>
            <nav
              className="grid grid-cols-3 gap-0.5 rounded-[10px] border border-white/10 bg-dx-surface-2 p-0.5"
              aria-label="Inspector panels"
            >
              {MOBILE_TABS.map((tab) => {
                const isActive = mobilePanel === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMobilePanel(tab.id)}
                    className={`dx-segment min-h-11 text-xs ${
                      isActive ? 'dx-segment-active' : ''
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
              className={`${panelShell} rounded-[16px] border border-white/5 bg-dx-surface-2 ${
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
        </>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,22rem)] lg:gap-6 lg:p-6">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-white/5 bg-dx-surface-0">
            <DxHostOverlay
              enabled={overlayEnabled}
              onEnabledChange={setOverlayEnabled}
              inspecting={inspecting}
              onInspectingChange={setInspecting}
              onTargetSelect={handleOverlayTargetSelect}
              targetElement={targetElement}
              className="min-h-[20rem] flex-1"
            >
              {(chrome) => (
                <HostDemoSurface
                  toolbar={
                    chrome ?? (
                      <div className="flex shrink-0 justify-end border-b border-white/10 bg-dx-surface-1 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setOverlayEnabled(true)}
                          className="dx-toggle min-h-9 px-3"
                        >
                          Enable overlay
                        </button>
                      </div>
                    )
                  }
                />
              )}
            </DxHostOverlay>
          </div>

          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto lg:max-h-full">
            <div className="rounded-[16px] border border-white/5 bg-dx-surface-2">
              <TokenCalibrationUnit
                key={targetElement ? 'target' : 'idle'}
                selectedNode={targetElement ? overlayNode : null}
                onUpdateProperties={handleOverlayUpdateProperties}
                onReadFromPreview={
                  targetElement ? handleReadFromTarget : undefined
                }
                readLabel="Read from target"
                onApplyToTarget={
                  targetElement ? handleApplyToTarget : undefined
                }
                emptyHint="Turn on Inspect and click a host surface to calibrate tokens."
              />
            </div>
            {!targetElement && (
              <p className="px-1 font-mono text-xs text-slate-500">
                Turn on Inspect, click a host surface, then calibrate and apply
                tokens. Copy CSS, JSON, or an agent prompt when you leave.
              </p>
            )}
            <DxGridVoice
              properties={overlayNode.properties}
              nodeName={overlayNode.name}
            />
          </aside>
        </main>
      )}
    </div>
  )
}

export default App
