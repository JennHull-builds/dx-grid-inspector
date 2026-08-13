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

const CATEGORIES: Array<'All' | NodeCategory> = [
  'All',
  'Display',
  'Content',
  'Navigation',
  'Functional',
];

/**
 * Visual template grid overlay with category filters, status indicators, and node selection.
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

  return (
    <section className="flex flex-col h-full w-full bg-[#131322] border border-white/5 rounded-[16px] p-4 sm:p-6 overflow-hidden shadow-[0_0_16px_rgba(141,198,63,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-white/5 pb-3 shrink-0 gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            Template Grid Manager
          </h2>
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            {filteredNodes.length} of {nodes.length} Nodes Displayed
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNode}
          className="shrink-0 min-h-10 px-3 py-2 rounded-[8px] font-mono text-[10px] font-semibold uppercase tracking-wider bg-[#8DC63F]/15 text-[#8DC63F] border border-[#8DC63F]/40 hover:bg-[#8DC63F]/25 transition-all w-full sm:w-auto"
        >
          + Add Node
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4 shrink-0">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`min-h-9 px-3 py-1.5 rounded-[6px] font-mono text-[10px] uppercase tracking-wide transition-all border ${
                isActive
                  ? 'bg-[#8DC63F]/15 text-[#8DC63F] border-[#8DC63F]/50'
                  : 'bg-transparent text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto overscroll-contain pr-1 flex-1 min-h-0">
        {filteredNodes.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-white/10 rounded-[12px]">
            <p className="text-xs font-mono text-slate-500">
              No framework components matching the "{activeCategory}" scope.
            </p>
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const statusColor =
              node.status === 'Ready'
                ? 'text-[#8DC63F]'
                : node.status === 'In Progress'
                  ? 'text-amber-400'
                  : 'text-slate-500';

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`group flex items-center justify-between p-3 sm:p-4 rounded-[12px] cursor-pointer transition-all border active:scale-[0.99] ${
                  isSelected
                    ? 'bg-[#1A1A2E] border-[#8DC63F]/30 shadow-[0_0_16px_rgba(141,198,63,0.15)]'
                    : 'bg-[#0A0A12] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex flex-col gap-1.5 flex-1 pr-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-[#8DC63F]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-sm font-medium text-slate-200 tracking-wide truncate">
                      {node.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0A0A12] text-slate-400 border border-white/5">
                      {node.category}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(node.id, toggleNodeStatus(node.status));
                      }}
                      title={`Toggle status for ${node.name}`}
                      aria-label={`Toggle status for ${node.name}. Currently ${node.status}.`}
                      className={`text-[10px] font-mono px-2 py-0.5 min-h-8 rounded bg-[#0A0A12] border border-white/5 hover:border-white/20 transition-colors ${statusColor}`}
                    >
                      {node.status}
                    </button>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A2E] text-[#8DC63F]/80">
                      {node.properties.radius}px / {node.properties.padding}px
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPurgeNode(node.id);
                  }}
                  title={`Delete ${node.name}`}
                  className="min-h-10 min-w-10 flex items-center justify-center rounded-md bg-white/0 hover:bg-white/5 text-slate-500 hover:text-red-400 font-mono text-xl leading-none transition-all opacity-100 lg:opacity-60 lg:group-hover:opacity-100"
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