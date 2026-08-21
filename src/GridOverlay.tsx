import React, { useState } from 'react';
import type { DesignNode, NodeCategory, NodeStatus } from './types';

interface TemplateGridManagerProps {
  nodes: DesignNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onPurgeNode: (id: string) => void;
  onAddNode: () => void;
  /** Updates a node's workflow status without changing selection. */
  onUpdateStatus: (id: string, status: NodeStatus) => void;
}

const toggleNodeStatus = (status: NodeStatus): NodeStatus =>
  status === 'Ready' ? 'In Progress' : 'Ready';

const isActivationKey = (key: string): boolean => key === 'Enter' || key === ' ';

/** Stops inner controls from also activating the parent row. */
const isolateFromRow = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

/** Asks the user to confirm before a node is purged, to avoid accidental deletion. */
const confirmNodePurge = (name: string): boolean =>
  window.confirm(`Delete “${name}”? This cannot be undone.`);

const CATEGORIES: Array<'All' | NodeCategory> = [
  'All',
  'Display',
  'Content',
  'Navigation',
  'Functional',
];

/**
 * Visual template grid overlay with category filters, status indicators, and keyboard-accessible node selection.
 */
export const TemplateGridManager: React.FC<TemplateGridManagerProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onPurgeNode,
  onAddNode,
  onUpdateStatus,
}) => {
  const [activeCategory, setActiveCategory] = useState<'All' | NodeCategory>('All');

  const filteredNodes = nodes.filter((node) => {
    if (activeCategory === 'All') return true;
    return node.category === activeCategory;
  });

  const categoryCounts = nodes.reduce<Record<'All' | NodeCategory, number>>(
    (acc, node) => {
      acc.All += 1;
      acc[node.category] += 1;
      return acc;
    },
    { All: 0, Display: 0, Content: 0, Navigation: 0, Functional: 0 },
  );

  return (
    <section className="flex h-full w-full flex-col rounded-[16px] border border-white/5 bg-dx-surface-2 p-4 sm:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 border-b border-white/5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold uppercase tracking-wide text-slate-300">
            Template Grid Manager
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {filteredNodes.length} of {nodes.length} Nodes Displayed
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNode}
          className="dx-btn-primary inline-flex w-full shrink-0 items-center justify-center min-h-10 px-3 py-2 sm:w-auto"
        >
          + Add Node
        </button>
      </div>

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-1.5">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`dx-pill min-h-9 px-3 py-1.5 ${
                isActive ? 'dx-pill-active' : ''
              }`}
            >
              {cat} ({categoryCounts[cat]})
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm font-medium tracking-wide text-slate-300">
              No nodes in the grid
            </p>
            <p className="max-w-xs font-mono text-xs text-slate-500">
              All nodes have been purged. Add a node to start inspecting spatial tokens.
            </p>
            <button
              type="button"
              onClick={onAddNode}
              className="dx-btn-primary inline-flex min-h-10 items-center justify-center px-3 py-2"
            >
              + Add Node
            </button>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-white/10 p-6 text-center">
            <p className="font-mono text-sm text-slate-500">
              No framework components matching the "{activeCategory}" scope.
            </p>
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const statusTone =
              node.status === 'Ready'
                ? 'dx-status-ready'
                : node.status === 'In Progress'
                  ? 'dx-status-progress'
                  : 'text-slate-500';

            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select ${node.name}`}
                onClick={() => onSelectNode(node.id)}
                onKeyDown={(event) => {
                  if (!isActivationKey(event.key)) return;
                  event.preventDefault();
                  onSelectNode(node.id);
                }}
                className={`group flex cursor-pointer items-center justify-between p-3 sm:p-4 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dx-accent ${
                  isSelected ? 'dx-selection' : 'dx-selection-idle'
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isSelected ? 'bg-dx-accent' : 'bg-slate-600'
                      }`}
                    />
                    <span className="truncate text-sm font-medium tracking-wide text-slate-200">
                      {node.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="dx-chip">{node.category}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        isolateFromRow(event);
                        onUpdateStatus(node.id, toggleNodeStatus(node.status));
                      }}
                      onKeyDown={isolateFromRow}
                      title={`Toggle status for ${node.name}`}
                      aria-label={`Toggle status for ${node.name}. Currently ${node.status}.`}
                      className={`dx-status-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dx-accent ${statusTone}`}
                    >
                      {node.status}
                    </button>
                    <span className="dx-chip-accent">
                      {node.properties.radius}px / {node.properties.padding}px
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    isolateFromRow(event);
                    if (!confirmNodePurge(node.name)) return;
                    onPurgeNode(node.id);
                  }}
                  onKeyDown={isolateFromRow}
                  title={`Delete ${node.name}`}
                  aria-label={`Delete ${node.name}`}
                  className="dx-btn-danger flex min-h-10 min-w-10 items-center justify-center font-mono text-xl leading-none opacity-100 lg:opacity-60 lg:group-hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dx-accent focus-visible:opacity-100"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default TemplateGridManager;
