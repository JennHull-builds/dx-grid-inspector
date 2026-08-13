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
    <section className="flex flex-col h-full w-full bg-[#13131F] border border-white/5 rounded-[16px] p-4 sm:p-6 shadow-[0_0_8px_#A78BFA40]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-white/5 pb-3 shrink-0 gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-wide text-slate-300 uppercase">
            Template Grid Manager
          </h2>
          <p className="text-xs font-mono text-slate-500 mt-1">
            {filteredNodes.length} of {nodes.length} Nodes Displayed
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNode}
          className="inline-flex items-center justify-center shrink-0 min-h-10 px-3 py-2 rounded-[8px] font-mono text-xs font-semibold uppercase tracking-wider bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/40 hover:bg-[#A78BFA]/25 transition-all w-full sm:w-auto"
        >
          + Add Node
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4 shrink-0">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center justify-center min-h-9 px-3 py-1.5 rounded-[6px] font-mono text-xs uppercase tracking-wide transition-all border ${
                isActive
                  ? 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/50'
                  : 'bg-transparent text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              {cat} ({categoryCounts[cat]})
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto overscroll-contain pr-1 flex-1 min-h-0">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-8 border border-dashed border-white/10 rounded-[12px]">
            <p className="text-sm font-medium text-slate-300 tracking-wide">
              No nodes in the grid
            </p>
            <p className="text-xs font-mono text-slate-500 max-w-xs">
              All nodes have been purged. Add a node to start inspecting spatial tokens.
            </p>
            <button
              type="button"
              onClick={onAddNode}
              className="inline-flex items-center justify-center min-h-10 px-3 py-2 rounded-[8px] font-mono text-xs font-semibold uppercase tracking-wider bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/40 hover:bg-[#A78BFA]/25 transition-all"
            >
              + Add Node
            </button>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-white/10 rounded-[12px]">
            <p className="text-sm font-mono text-slate-500">
              No framework components matching the "{activeCategory}" scope.
            </p>
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const statusColor =
              node.status === 'Ready'
                ? 'text-[#A78BFA]'
                : node.status === 'In Progress'
                  ? 'text-[#A3BE5B]'
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
                className={`group flex items-center justify-between p-3 sm:p-4 rounded-[12px] cursor-pointer transition-all border active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA] ${
                  isSelected
                    ? 'bg-[#1A1A2B] border-[#A78BFA]/30 shadow-[0_0_6px_#A78BFA59]'
                    : 'bg-[#0A0A10] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex flex-col gap-1.5 flex-1 pr-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-[#A78BFA]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-sm font-medium text-slate-200 tracking-wide truncate">
                      {node.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="inline-flex items-center text-xs font-mono px-2 py-0.5 min-h-8 rounded bg-[#0A0A10] text-slate-400 border border-white/5">
                      {node.category}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        isolateFromRow(event);
                        onUpdateStatus(node.id, toggleNodeStatus(node.status));
                      }}
                      onKeyDown={isolateFromRow}
                      title={`Toggle status for ${node.name}`}
                      aria-label={`Toggle status for ${node.name}. Currently ${node.status}.`}
                      className={`inline-flex items-center justify-center text-xs font-mono px-2 py-0.5 min-h-8 rounded bg-[#0A0A10] border border-white/5 hover:border-white/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA] ${statusColor}`}
                    >
                      {node.status}
                    </button>
                    <span className="inline-flex items-center text-xs font-mono px-1.5 py-0.5 min-h-8 rounded bg-[#1A1A2B] text-[#A78BFA]">
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
                  className="min-h-10 min-w-10 flex items-center justify-center rounded-md bg-white/0 hover:bg-white/5 text-slate-500 hover:text-red-400 font-mono text-xl leading-none transition-all opacity-100 lg:opacity-60 lg:group-hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA] focus-visible:opacity-100"
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