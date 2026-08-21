import { parseDesignProperties } from './tokenExport'
import type {
  DesignNode,
  NodeCategory,
  NodeStatus,
} from './types'

/** localStorage key for the local testing harness snapshot. */
export const HARNESS_STORAGE_KEY = 'dx-grid-inspector.harness'

const NODE_CATEGORIES: readonly NodeCategory[] = [
  'Display',
  'Content',
  'Navigation',
  'Functional',
]

const NODE_STATUSES: readonly NodeStatus[] = ['Ready', 'In Progress']

/**
 * Persisted harness snapshot: nodes, the selected node id, and the next mock index.
 */
export interface HarnessState {
  nodes: DesignNode[]
  selectedNodeId: string | null
  nextIndex: number
}

const isNodeCategory = (value: unknown): value is NodeCategory =>
  typeof value === 'string' &&
  (NODE_CATEGORIES as readonly string[]).includes(value)

const isNodeStatus = (value: unknown): value is NodeStatus =>
  typeof value === 'string' &&
  (NODE_STATUSES as readonly string[]).includes(value)

/**
 * Rebuilds a design node from unknown JSON. Returns null when the shape is invalid.
 */
const parseDesignNode = (value: unknown): DesignNode | null => {
  if (value === null || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const properties = parseDesignProperties(record.properties)

  if (
    typeof record.id !== 'string' ||
    record.id.length === 0 ||
    typeof record.name !== 'string' ||
    !isNodeCategory(record.category) ||
    !isNodeStatus(record.status) ||
    properties === null
  ) {
    return null
  }

  return {
    id: record.id,
    name: record.name,
    category: record.category,
    status: record.status,
    properties,
  }
}

/** Reads the numeric suffix from mock ids such as `node-3`. */
const parseMockNodeIndex = (id: string): number => {
  const match = /^node-(\d+)$/.exec(id)
  if (match === null) {
    return 0
  }

  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Ensures the next mock index will not collide with existing `node-N` ids.
 */
const resolveNextIndex = (nodes: DesignNode[], storedNextIndex: unknown): number => {
  const maxId = nodes.reduce(
    (highest, node) => Math.max(highest, parseMockNodeIndex(node.id)),
    0,
  )
  const fromLength = nodes.length
  const fromStore =
    typeof storedNextIndex === 'number' &&
    Number.isInteger(storedNextIndex) &&
    storedNextIndex >= 0
      ? storedNextIndex
      : fromLength

  return Math.max(fromStore, fromLength, maxId)
}

/**
 * Reads the harness snapshot from localStorage.
 * Returns `fallback` when storage is empty, unreadable, or the JSON is corrupt.
 */
export const loadHarnessState = (fallback: HarnessState): HarnessState => {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(HARNESS_STORAGE_KEY)
    if (raw === null) {
      return fallback
    }

    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback
    }

    const record = parsed as Record<string, unknown>
    if (!Array.isArray(record.nodes)) {
      return fallback
    }

    const nodes: DesignNode[] = []
    for (const entry of record.nodes) {
      const node = parseDesignNode(entry)
      if (node === null) {
        return fallback
      }
      nodes.push(node)
    }

    const selectedNodeId =
      typeof record.selectedNodeId === 'string' &&
      nodes.some((node) => node.id === record.selectedNodeId)
        ? record.selectedNodeId
        : null

    return {
      nodes,
      selectedNodeId,
      nextIndex: resolveNextIndex(nodes, record.nextIndex),
    }
  } catch {
    return fallback
  }
}

/**
 * Writes the harness snapshot to localStorage. Failures (quota, private mode) are ignored.
 */
export const saveHarnessState = (state: HarnessState): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(HARNESS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Persistence is best-effort for the local harness.
  }
}
