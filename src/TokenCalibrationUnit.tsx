import React, { useState } from 'react';
import type { DesignNode, DesignProperties } from './types';

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

/**
 * Convert a valid hex colour to the `#rrggbb` form required by native colour inputs.
 * Returns null for rgba and other non-hex values so the picker is not forced to overwrite them.
 */
const hexForColourInput = (val: string): string | null => {
  const sanitized = sanitizeHex(val);
  if (!sanitized) return null;

  if (sanitized.length === 4) {
    const r = sanitized[1];
    const g = sanitized[2];
    const b = sanitized[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return sanitized.toLowerCase();
};

const displayValue = (key: EditableField, properties: DesignProperties): string => {
  if (key === 'radius' || key === 'padding') {
    return `${properties[key]}px`;
  }
  return String(properties[key]);
};

interface ColourPickerInputProps {
  label: string;
  value: string;
  onPick: (hex: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * Native HTML colour picker. The paired text field remains the source of truth for hex/rgba.
 */
const ColourPickerInput: React.FC<ColourPickerInputProps> = ({
  label,
  value,
  onPick,
  onKeyDown,
}) => {
  const pickerValue = hexForColourInput(value) ?? '#000000';

  return (
    <input
      type="color"
      aria-label={`${label} colour picker`}
      title={`${label} colour picker`}
      value={pickerValue}
      onChange={(e) => onPick(e.target.value.toUpperCase())}
      onKeyDown={onKeyDown}
      className="h-10 w-10 min-h-10 min-w-10 shrink-0 cursor-pointer rounded-[8px] border border-white/10 bg-[#141416] p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-[5px] [&::-moz-color-swatch]:border-none"
    />
  );
};

/**
 * Live token calibration HUD for padding, radius, surface fills, and border presets.
 * Surface Fill and Border Preset pair a native colour picker with a hex/rgba text field.
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
        <h2 className="text-base font-semibold tracking-wide text-slate-300 uppercase mb-4">
          Token Calibration Unit
        </h2>
        <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-[12px]">
          <p className="text-sm font-mono text-slate-500 text-center px-4">
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

  const handleFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: FieldConfig,
  ) => {
    if (e.key === 'Enter') saveField(field);
    if (e.key === 'Escape') {
      setEditingKey(null);
      setError(null);
    }
  };

  return (
    <section className="flex flex-col h-full w-full p-4 sm:p-6 overflow-hidden">
      <div className="mb-4 shrink-0 border-b border-white/5 pb-3">
        <h2 className="text-base font-semibold tracking-wide text-slate-300 uppercase">
          Token Calibration Unit
        </h2>
        <p className="text-xs font-mono text-slate-500 mt-1 truncate">
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
                  ? 'bg-[#0B0B0D] border-[#A78BFA]/40 shadow-[0_0_16px_rgba(167,139,250,0.12)]'
                  : 'bg-[#0B0B0D] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => !isEditing && startEdit(field)}
                  className="flex flex-col items-start gap-0.5 text-left flex-1 min-w-0"
                >
                  <span className="text-sm font-medium text-slate-200">{field.label}</span>
                  <span className="text-xs font-mono text-[#A78BFA]/80">{field.key}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  {(field.kind === 'color' || field.kind === 'border') && (
                    <ColourPickerInput
                      label={field.label}
                      value={isEditing ? inputValue : value}
                      onPick={(hex) => {
                        if (isEditing) {
                          setInputValue(hex);
                          setError(null);
                          return;
                        }
                        const current = selectedNode.properties;
                        const next =
                          field.key === 'bgPreset'
                            ? { ...current, bgPreset: hex }
                            : { ...current, borderPreset: hex };
                        onUpdateProperties(selectedNode.id, next);
                      }}
                      onKeyDown={
                        isEditing ? (e) => handleFieldKeyDown(e, field) : undefined
                      }
                    />
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, field)}
                        autoFocus
                        className="flex-1 sm:flex-none sm:w-[120px] min-h-10 bg-[#141416] text-slate-200 border border-white/10 rounded-[8px] px-3 py-2 font-mono text-sm outline-none focus:border-[#A78BFA]/50"
                      />
                      <button
                        type="button"
                        onClick={() => saveField(field)}
                        className="min-h-10 px-3 text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(field)}
                      className="font-mono text-sm text-slate-400 hover:text-slate-200 truncate max-w-full sm:max-w-[140px] min-h-10 px-1"
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
        <p className="mt-3 text-xs font-mono text-red-400 shrink-0">{error}</p>
      )}
    </section>
  );
};

export default TokenCalibrationUnit;
