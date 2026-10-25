import { useRef, useState } from 'react'
import type { FieldEditEvent } from './TokenCalibrationUnit'
import {
  applyDesignFieldToElement,
  applyDesignPropertiesToElement,
  readDesignPropertiesFromElement,
} from './tokenExport'
import type { DesignNode, DesignProperties } from './types'
import { useTweakSession } from './useTweakSession'

const DEFAULT_PROPERTIES: DesignProperties = {
  radius: 16,
  padding: 24,
  bgPreset: '#1A1A2B',
  borderPreset: '#A78BFA',
}

const createTargetNode = (properties: DesignProperties): DesignNode => ({
  id: 'overlay-target',
  name: 'Host inspect target',
  category: 'Content',
  status: 'In Progress',
  properties,
})

/**
 * Holds the inspected host element and the HUD node that mirrors it, and wires the HUD's
 * read, apply and live arrow-key nudging to that element. Shared by `DxInspector` and the
 * demo's overlay mode.
 */
export function useOverlayTarget() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [node, setNode] = useState<DesignNode>(() => createTargetNode(DEFAULT_PROPERTIES))
  /** Changes with every selection, so the HUD can drop a half-finished edit on the old element. */
  const [selection, setSelection] = useState(0)
  /** The target's `style` attribute as it was when the current field edit began. */
  const styleBeforeEdit = useRef<{ element: HTMLElement; style: string | null } | null>(null)
  const session = useTweakSession()

  const select = (element: HTMLElement) => {
    const properties = readDesignPropertiesFromElement(element)
    setTarget(element)
    setNode(createTargetNode(properties))
    setSelection((previous) => previous + 1)
    session.begin(element, properties)
  }

  const update = (_id: string, properties: DesignProperties) => {
    setNode((previous) => ({ ...previous, properties }))
    if (target) session.update(target, properties)
  }

  const read = () => {
    if (!target) return
    const properties = readDesignPropertiesFromElement(target)
    setNode(createTargetNode(properties))
    session.update(target, properties)
  }

  const apply = () => {
    if (!target) return
    applyDesignPropertiesToElement(target, node.properties)
  }

  /** Arrow-key nudges write one field to the target at once; Escape puts the old styles back. */
  const onFieldEdit = (event: FieldEditEvent) => {
    if (!target) return
    switch (event.phase) {
      case 'start':
        styleBeforeEdit.current = { element: target, style: target.getAttribute('style') }
        break
      case 'nudge':
        applyDesignFieldToElement(target, event.field, event.properties)
        break
      case 'revert': {
        const before = styleBeforeEdit.current
        if (before?.element === target) {
          if (before.style === null) {
            target.removeAttribute('style')
          } else {
            target.setAttribute('style', before.style)
          }
        }
        styleBeforeEdit.current = null
        break
      }
      case 'commit':
        styleBeforeEdit.current = null
        break
    }
  }

  return {
    target,
    node,
    selection,
    /** Every element tweaked this session, for “Copy all”. */
    sessionEntries: session.entries,
    select,
    update,
    read,
    apply,
    onFieldEdit,
  }
}
