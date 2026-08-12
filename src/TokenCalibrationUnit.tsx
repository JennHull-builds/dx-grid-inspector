import React, { useState } from 'react';

/** Editable layout and surface tokens for a design node. */
export interface DesignProperties {
  radius: number | string;
  padding: number | string;
  bgPreset: string;
  borderPreset: string;
}

/** Design node shape consumed by the token calibration HUD. */
export interface DesignNode {
  id: string;
  name: string;
  category?: string;
  status?: string;
  properties: DesignProperties;
}

interface TokenCalibrationUnitProps {
  selectedNode: DesignNode | null;
  onUpdateProperties: (id: string, properties: DesignProperties) => void;
}

type EditableField = keyof DesignProperties;
type FieldKind = 'color' | 'layout' | 'border';

interface FieldConfig {
  key: EditableField;
  label: string;
  kind: FieldKind;
}

const FIELDS: FieldConfig[] = [
  { key: 'radius', label: 'Corner Radius', kind: 'layout' },
  { key: 'padding', label: 'Internal Padding', kind: 'layout' },
  { key: 'bgPreset', label: 'Surface Fill', kind: 'color' },
  { key: 'borderPreset', label: 'Border Preset', kind: 'border' },
];

const parseLayoutNumber = (val: string): number | null => {
  const trimmed = val.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  const withUnit = trimmed.match(/^(\d+(?:\.\d+)?)(px|rem|%|vh|vw|em)$/i);
  if (withUnit) {
    return Number(withUnit[1]);
  }
  return null;
};

const sanitizeHex = (val: string): string | null => {
  let cleanVal = val.trim();
  if (!cleanVal) return null;

  if (!cleanVal.startsWith('#')) {
    if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleanVal)) {
      cleanVal = `#${cleanVal}`;
    } else {
      return null;
    }
  }

  if (cleanVal.length === 4 || cleanVal.length === 7) {
    return cleanVal.toUpperCase();
  }

  return null;
};

const sanitizeBorder = (val: string): string | null => {
  const cleanVal = val.trim();
  if (!cleanVal) return null;

  if (/^rgba?\([^)]+\)$/i.test(cleanVal)) {
    return cleanVal;
  }

  return sanitizeHex(cleanVal);
};

const displayValue = (key: EditableField, properties: DesignProperties): string => {
  if (key === 'radius' || key === 'padding') {
    return `${properties[key]}px`;
  }
  return String(properties[key]);
};

/**
 * Live token calibration HUD for padding, radius, surface fills, and border presets.
 */
export const TokenCalibrationUnit: React.FC<TokenCalibrationUnitProps> = ({
  selectedNode,
  onUpdateProperties,
}) => {
  const [editingKey, setEditingKey] = useState<EditableField | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!selectedNode) {
    return (
      <section className="flex flex-col h-full w-full p-4 sm:p-6 overflow-hidden">
        <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase mb-4">
          Token Calibration Unit
        </h2>
        <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-[12px]">
          <p className="text-xs font-mono text-slate-500 text-center px-4">
            Select a node from the Template Grid Manager to calibrate layout tokens.
          </p>
        </div>
      </section>
    );
  }

  const startEdit = (field: FieldConfig) => {
    setEditingKey(field.key);
    setInputValue(displayValue(field.key, selectedNode.properties));
    setError(null);
  };

  const saveField = (field: FieldConfig) => {
    const current = selectedNode.properties;

    if (field.kind === 'layout') {
      const parsed = parseLayoutNumber(inputValue);
      if (parsed === null || Number.isNaN(parsed)) {
        setError('Invalid layout size. Use a number or units like px, rem, %.');
        return;
      }
      onUpdateProperties(selectedNode.id, { ...current, [field.key]: parsed });
    } else if (field.kind === 'color') {
      const sanitized = sanitizeHex(inputValue);
      if (!sanitized) {
        setError('Invalid hex colour. Use #RGB or #RRGGBB.');
        return;
      }
      onUpdateProperties(selectedNode.id, { ...current, bgPreset: sanitized });
    } else {
      const sanitized = sanitizeBorder(inputValue);
      if (!sanitized) {
        setError('Invalid border value. Use hex or rgba(...).');
        return;
      }
      onUpdateProperties(selectedNode.id, { ...current, borderPreset: sanitized });
    }

    setEditingKey(null);
    setError(null);
  };

  return (
    <section className="flex flex-col h-full w-full p-4 sm:p-6 overflow-hidden">
      <div className="mb-4 shrink-0 border-b border-white/5 pb-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
          Token Calibration Unit
        </h2>
        <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">
          Editing: {selectedNode.name}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 overflow-y-auto overscroll-contain flex-1 pr-1 min-h-0">
        {FIELDS.map((field) => {
          const isEditing = editingKey === field.key;
          const value = displayValue(field.key, selectedNode.properties);

          return (
            <div
              key={field.key}
              className={`rounded-[12px] border p-3 transition-all ${
                isEditing
                  ? 'bg-[#0A0A12] border-[#8DC63F]/40 shadow-[0_0_16px_rgba(141,198,63,0.12)]'
                  : 'bg-[#0A0A12] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => !isEditing && startEdit(field)}
                  className="flex flex-col items-start gap-0.5 text-left flex-1 min-w-0"
                >
                  <span className="text-xs font-medium text-slate-200">{field.label}</span>
                  <span className="text-[10px] font-mono text-[#8DC63F]/80">{field.key}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  {!isEditing && field.kind === 'color' && (
                    <span
                      className="inline-block w-4 h-4 rounded-[3px] border border-white/20"
                      style={{ backgroundColor: selectedNode.properties.bgPreset }}
                    />
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveField(field);
                          if (e.key === 'Escape') {
                            setEditingKey(null);
                            setError(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 sm:flex-none sm:w-[120px] min-h-10 bg-[#131322] text-slate-200 border border-white/10 rounded-[8px] px-3 py-2 font-mono text-xs outline-none focus:border-[#8DC63F]/50"
                      />
                      <button
                        type="button"
                        onClick={() => saveField(field)}
                        className="min-h-10 px-3 text-[11px] font-semibold text-[#8DC63F] hover:text-[#a3db52]"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(field)}
                      className="font-mono text-xs text-slate-400 hover:text-slate-200 truncate max-w-full sm:max-w-[140px] min-h-10 px-1"
                    >
                      {value}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-[11px] font-mono text-red-400 shrink-0">{error}</p>
      )}
    </section>
  );
};

export default TokenCalibrationUnit;
