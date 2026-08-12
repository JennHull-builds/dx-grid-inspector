import { useState } from 'react'
import {
  TemplateGridManager,
  type DesignNode,
  type NodeCategory,
} from './GridOverlay'
import {
  TokenCalibrationUnit,
  type DesignProperties,
} from './TokenCalibrationUnit'

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
      borderPreset: '#8DC63F',
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

  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? null

  const handleAddNode = () => {
    const node = createMockNode(nextIndex)
    setNodes((prev) => [...prev, node])
    setSelectedNodeId(node.id)
    setNextIndex((prev) => prev + 1)
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

  return (
    <div className="min-h-svh w-full bg-[#0A0A12] text-slate-300">
      <header className="border-b border-white/5 px-4 py-4 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#8DC63F]">
          DX Spatial Grid &amp; Token Inspector
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-wide text-slate-100">
          Local Testing Harness
        </h1>
      </header>

      <main className="mx-auto grid min-h-[calc(100svh-5.5rem)] w-full max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <TemplateGridManager
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onPurgeNode={handlePurgeNode}
          onAddNode={handleAddNode}
        />
        <div className="rounded-[16px] border border-white/5 bg-[#131322] shadow-[0_0_16px_rgba(141,198,63,0.08)]">
          <TokenCalibrationUnit
            key={selectedNodeId ?? 'none'}
            selectedNode={selectedNode}
            onUpdateProperties={handleUpdateProperties}
          />
        </div>
      </main>
    </div>
  )
}

export default App
