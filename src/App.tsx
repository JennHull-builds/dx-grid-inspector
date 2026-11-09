import { useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SiteBrand, SiteFooter, SiteHint } from './site/SiteChrome'
import { DxGridVoice } from './DxGridVoice'
import { DxHostOverlay } from './DxHostOverlay'
import { TemplateGridManager } from './GridOverlay'
import {
  clearHarnessState,
  loadHarnessState,
  saveHarnessState,
  type HarnessState,
} from './harnessStorage'
import { HostDemoSurface } from './HostDemoSurface'
import { LiveTokenPreview } from './LiveTokenPreview'
import { TokenCalibrationUnit } from './TokenCalibrationUnit'
import { lengthToPx, readDesignPropertiesFromElement } from './tokenExport'
import type {
  ContrastContext,
  DesignNode,
  DesignProperties,
  NodeCategory,
  NodeStatus,
  TokenSessionEntry,
} from './types'
import { useOverlayTarget } from './useOverlayTarget'

type AppMode = 'harness' | 'overlay'

/** What the Harness's sample card is drawn on, and its default ink, for the colour picker's contrast. */
const HARNESS_CONTRAST: ContrastContext = { textColour: '#E2E8F0', backgroundColour: '#13131F' }
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
  /** Each node's tokens when the page loaded or the node was added, for “Copy all”. */
  const [baseline, setBaseline] = useState<Record<string, DesignProperties>>(() =>
    Object.fromEntries(initialHarness.nodes.map((node) => [node.id, node.properties])),
  )
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('nodes')
  const previewSurfaceRef = useRef<HTMLDivElement>(null)

  const [overlayEnabled, setOverlayEnabled] = useState(true)
  const [inspecting, setInspecting] = useState(false)
  const overlay = useOverlayTarget()
  const { target: targetElement, node: overlayNode } = overlay

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
    setBaseline((prev) => ({ ...prev, [node.id]: node.properties }))
    setSelectedNodeId(node.id)
    setNextIndex((prev) => prev + 1)
    if (isMobileViewport()) {
      setMobilePanel('calibrate')
    }
  }

  const handleResetHarness = () => {
    clearHarnessState()
    setNodes(FALLBACK_HARNESS.nodes)
    setBaseline(
      Object.fromEntries(FALLBACK_HARNESS.nodes.map((node) => [node.id, node.properties])),
    )
    setSelectedNodeId(FALLBACK_HARNESS.selectedNodeId)
    setNextIndex(FALLBACK_HARNESS.nextIndex)
    if (isMobileViewport()) {
      setMobilePanel('nodes')
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
    overlay.select(element)
    setInspecting(false)
  }

  /** A token length as pixels for the sample card; `rem` is resolved, other units fall back. */
  const previewPx = (value: DesignProperties['radius'], fallback: number): number =>
    lengthToPx(value) ?? (Number.parseFloat(String(value)) || fallback)

  const harnessEntries: TokenSessionEntry[] = nodes.map((node) => ({
    label: node.name,
    before: baseline[node.id] ?? node.properties,
    after: node.properties,
  }))

  const previewRadius = selectedNode == null ? 12 : previewPx(selectedNode.properties.radius, 12)
  const previewPadding =
    selectedNode == null ? 16 : previewPx(selectedNode.properties.padding, 16)
  const previewGap = selectedNode == null ? 0 : previewPx(selectedNode.properties.gap ?? 0, 0)
  const previewMargin =
    selectedNode == null ? 0 : previewPx(selectedNode.properties.margin ?? 0, 0)

  const panelShell = 'min-h-0 flex-col overflow-visible'

  return (
    <div className="box-border flex h-dvh w-full flex-col overflow-hidden bg-dx-surface-0 text-slate-300">
      <Analytics />
      <header className="relative flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-4 lg:gap-8 lg:px-6 lg:py-3.5">
        <h1 className="sr-only">DX Grid: spatial grid and token inspector</h1>
        <div className="flex min-w-0 items-center gap-6">
          <SiteBrand />
          <SiteHint />
        </div>
        <nav className="dx-segment-track site-rise shrink-0" style={{ animationDelay: '300ms' }} aria-label="App mode">
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
        <span className="site-hairline site-hairline-bottom" aria-hidden="true" />
      </header>

      {appMode === 'harness' ? (
        <>
          {/* Phones only: the panel tabs. No heading here: the site header already says where you are. */}
          <header className="shrink-0 border-b border-white/5 px-3 pt-3 pb-3 sm:px-4 lg:hidden">
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
              <p className="mt-2 truncate font-mono text-xs text-dx-muted">
                Active: {selectedNode.name}
              </p>
            )}
          </header>

          <main className="flex min-h-0 flex-1 flex-col gap-0 p-3 sm:p-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:p-6 lg:pb-4">
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
                onResetDemo={handleResetHarness}
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
                sessionEntries={harnessEntries}
                contrastContext={HARNESS_CONTRAST}
                copyAllTitle="Copy every node in the Template Grid Manager as CSS or JSON. Before is each node's tokens when the page loaded."
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
                previewGap={previewGap}
                previewMargin={previewMargin}
                surfaceRef={previewSurfaceRef}
              />
            </div>
          </main>
        </>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,22rem)] lg:gap-6 lg:p-6 lg:pb-4">
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

          <aside className="flex max-h-[45dvh] min-h-0 flex-col gap-3 overflow-y-auto lg:max-h-full">
            <div className="rounded-[16px] border border-white/5 bg-dx-surface-2">
              <TokenCalibrationUnit
                key={targetElement ? `target-${overlay.selection}` : 'idle'}
                selectedNode={targetElement ? overlayNode : null}
                onUpdateProperties={overlay.update}
                onReadFromPreview={targetElement ? overlay.read : undefined}
                readLabel="Read from target"
                onApplyToTarget={targetElement ? overlay.apply : undefined}
                onFieldEdit={overlay.onFieldEdit}
                contrastContext={overlay.contrast ?? undefined}
                sessionEntries={overlay.sessionEntries}
                emptyHint="Turn on Inspect and click a host surface to calibrate tokens."
              />
            </div>
            {!targetElement && (
              <p className="px-1 font-mono text-xs text-dx-muted">
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
      <SiteFooter />
    </div>
  )
}

export default App
