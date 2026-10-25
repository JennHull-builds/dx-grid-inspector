import { useState } from 'react'
import { readInspectableHint } from './inspectable'
import { designPropertiesDiffer } from './tokenExport'
import type { DesignProperties, TokenSessionEntry } from './types'

interface TweakRecord {
  label: string
  before: DesignProperties
  after: DesignProperties
}

/**
 * A short name for an element: its `data-dx-inspectable` value when that says something
 * (anything but empty, `"true"` or `"false"`), otherwise its tag plus its first class.
 */
const describeElement = (element: HTMLElement): string => {
  const named = readInspectableHint(element)
  if (named && named !== 'true') return named
  const tag = element.tagName.toLowerCase()
  const firstClass = element.classList[0]
  return firstClass ? `${tag}.${firstClass}` : tag
}

/**
 * The session list behind “Copy all”: every element inspected this session, with the
 * values it was first read with and its current values. Held in memory only, so it
 * clears on reload. `entries` lists just the elements whose values now differ.
 */
export function useTweakSession() {
  const [records, setRecords] = useState<Map<HTMLElement, TweakRecord>>(() => new Map())

  /** An element was selected: remember its first read; later reads only refresh `after`. */
  const begin = (element: HTMLElement, properties: DesignProperties) => {
    setRecords((previous) => {
      const next = new Map(previous)
      const existing = previous.get(element)
      next.set(
        element,
        existing
          ? { ...existing, after: properties }
          : { label: describeElement(element), before: properties, after: properties },
      )
      return next
    })
  }

  /** The element's current values changed. */
  const update = (element: HTMLElement, properties: DesignProperties) => {
    setRecords((previous) => {
      const existing = previous.get(element)
      if (!existing) return previous
      return new Map(previous).set(element, { ...existing, after: properties })
    })
  }

  const seen = new Map<string, number>()
  const entries: TokenSessionEntry[] = []
  for (const record of records.values()) {
    if (!designPropertiesDiffer(record.before, record.after)) continue
    const count = (seen.get(record.label) ?? 0) + 1
    seen.set(record.label, count)
    entries.push({
      label: count === 1 ? record.label : `${record.label} (${count})`,
      before: record.before,
      after: record.after,
    })
  }

  return { entries, begin, update }
}
