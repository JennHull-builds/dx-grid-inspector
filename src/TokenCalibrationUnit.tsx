import React, { useEffect, useRef, useState } from 'react';
import {
  copyTextToClipboard,
  formatTokensAsAgentPrompt,
  formatTokensAsCss,
  formatTokensAsJson,
  parseDesignPropertiesJson,
} from './tokenExport';
import type { DesignNode, DesignProperties } from './types';

const FEEDBACK_MS = 2000;

export interface TokenCalibrationUnitProps {
  /** The node whose tokens are shown and edited; null shows the empty hint. */
  selectedNode: DesignNode | null;
  /** Called with the node id and the full new token set after every edit. */
  onUpdateProperties: (id: string, properties: DesignProperties) => void;
  /** Copies computed styles from the live preview or inspect target into this node. */
  onReadFromPreview?: () => void;
  /** Label for the read action (defaults to “Read from preview”). */
  readLabel?: string;
  /** Writes the current tokens onto the active host inspect target. */
  onApplyToTarget?: () => void;
  /** Empty-state hint when no node is selected. */
  emptyHint?: string;
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

/** Accepts hex or `rgb()` / `rgba()`, the two forms the HUD reads colours back as. */
const sanitizeColour = (val: string): string | null => {
  const cleanVal = val.trim();
  if (!cleanVal) return null;

  if (/^rgba?\([^)]+\)$/i.test(cleanVal)) {
    return cleanVal;
  }

  return sanitizeHex(cleanVal);
};

/**
 * Convert a colour to the `#rrggbb` form required by native colour inputs.
 * For `rgb()` / `rgba()` the swatch shows the colour without its transparency, since the
 * native picker cannot show alpha. Returns null for anything else.
 */
const hexForColourInput = (val: string): string | null => {
  const rgb = val.trim().match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
      .join('')}`;
  }

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
      className="dx:h-10 dx:w-10 dx:min-h-10 dx:min-w-10 dx:shrink-0 dx:cursor-pointer dx:rounded-[8px] dx:border dx:border-white/10 dx:bg-dx-surface-2 dx:p-0.5 dx:[&::-webkit-color-swatch-wrapper]:p-0 dx:[&::-webkit-color-swatch]:rounded-[5px] dx:[&::-webkit-color-swatch]:border-none dx:[&::-moz-color-swatch]:rounded-[5px] dx:[&::-moz-color-swatch]:border-none"
    />
  );
};

/**
 * Live token calibration HUD for padding, radius, surface fills, and border presets.
 * Surface Fill and Border Preset pair a native colour picker with a hex/rgba text field.
 * Copy writes CSS custom properties to the clipboard; JSON is a second export format.
 */
export const TokenCalibrationUnit: React.FC<TokenCalibrationUnitProps> = ({
  selectedNode,
  onUpdateProperties,
  onReadFromPreview,
  readLabel = 'Read from preview',
  onApplyToTarget,
  emptyHint = 'Select a node from the Template Grid Manager to calibrate layout tokens.',
}) => {
  const [editingKey, setEditingKey] = useState<EditableField | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const announce = (message: string) => {
    setFeedback(message);
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, FEEDBACK_MS);
  };

  if (!selectedNode) {
    return (
      <section data-dx-ui="" className="dx:flex dx:flex-col dx:h-full dx:w-full dx:p-4 dx:sm:p-6 dx:overflow-hidden">
        <h2 className="dx:text-base dx:font-semibold dx:tracking-wide dx:text-slate-300 dx:uppercase dx:mb-4">
          Token Calibration Unit
        </h2>
        <div className="dx:flex-1 dx:flex dx:items-center dx:justify-center dx:border dx:border-dashed dx:border-white/10 dx:rounded-[12px]">
          <p className="dx:text-sm dx:font-mono dx:text-slate-500 dx:text-center dx:px-4">
            {emptyHint}
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
    } else {
      const sanitized = sanitizeColour(inputValue);
      if (!sanitized) {
        setError('Invalid colour. Use hex (#RGB or #RRGGBB) or rgba(...).');
        return;
      }
      onUpdateProperties(
        selectedNode.id,
        field.kind === 'color'
          ? { ...current, bgPreset: sanitized }
          : { ...current, borderPreset: sanitized },
      );
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

  const copyTokens = async (format: 'css' | 'json' | 'prompt') => {
    const payload =
      format === 'css'
        ? formatTokensAsCss(selectedNode.properties, selectedNode.name)
        : format === 'json'
          ? formatTokensAsJson(selectedNode.properties, {
              id: selectedNode.id,
              name: selectedNode.name,
              category: selectedNode.category,
              status: selectedNode.status,
            })
          : formatTokensAsAgentPrompt(selectedNode.properties, {
              nodeName: selectedNode.name,
            });
    const ok = await copyTextToClipboard(payload);
    announce(
      ok
        ? format === 'css'
          ? 'Copied CSS custom properties'
          : format === 'json'
            ? 'Copied JSON'
            : 'Copied agent prompt'
        : 'Copy failed',
    );
  };

  const handleReadFromPreview = () => {
    if (!onReadFromPreview) return;
    setEditingKey(null);
    setError(null);
    onReadFromPreview();
    announce('Read tokens from target');
  };

  const handleApplyToTarget = () => {
    if (!onApplyToTarget) return;
    setEditingKey(null);
    setError(null);
    onApplyToTarget();
    announce('Applied tokens to target');
  };

  const handlePasteTokens = () => {
    const parsed = parseDesignPropertiesJson(pasteValue);
    if (parsed === null) {
      setError('Invalid token JSON. Paste DesignProperties or a full node.');
      return;
    }
    onUpdateProperties(selectedNode.id, parsed);
    setPasteValue('');
    setPasteOpen(false);
    setError(null);
    announce('Applied pasted tokens');
  };

  return (
    <section data-dx-ui="" className="dx:flex dx:flex-col dx:h-full dx:w-full dx:p-4 dx:sm:p-6 dx:overflow-hidden">
      <div className="dx:mb-4 dx:shrink-0 dx:border-b dx:border-white/5 dx:pb-3">
        <h2 className="dx:text-base dx:font-semibold dx:tracking-wide dx:text-slate-300 dx:uppercase">
          Token Calibration Unit
        </h2>
        <p className="dx:text-xs dx:font-mono dx:text-slate-500 dx:mt-1 dx:truncate">
          Editing: {selectedNode.name}
        </p>
      </div>

      <div className="dx:flex dx:flex-col dx:gap-2.5 dx:overflow-y-auto dx:overscroll-contain dx:flex-1 dx:pr-1 dx:min-h-0">
        {FIELDS.map((field) => {
          const isEditing = editingKey === field.key;
          const value = displayValue(field.key, selectedNode.properties);

          return (
            <div
              key={field.key}
              className={`dx:rounded-[12px] dx:border dx:p-3 dx:transition-all ${
                isEditing
                  ? 'dx-selection dx:bg-dx-surface-0'
                  : 'dx-selection-idle'
              }`}
            >
              <div className="dx:flex dx:flex-col dx:gap-3 dx:sm:flex-row dx:sm:items-center dx:sm:justify-between">
                <button
                  type="button"
                  onClick={() => !isEditing && startEdit(field)}
                  className="dx:flex dx:flex-col dx:items-start dx:gap-0.5 dx:text-left dx:flex-1 dx:min-w-0"
                >
                  <span className="dx:text-sm dx:font-medium dx:text-slate-200">{field.label}</span>
                  <span className="dx:text-xs dx:font-mono dx:text-dx-accent/80">{field.key}</span>
                </button>

                <div className="dx:flex dx:items-center dx:gap-2 dx:shrink-0 dx:w-full dx:sm:w-auto dx:justify-between dx:sm:justify-end">
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
                    <div className="dx:flex dx:items-center dx:gap-2 dx:w-full dx:sm:w-auto">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, field)}
                        autoFocus
                        className="dx:flex-1 dx:sm:flex-none dx:sm:w-[120px] dx:min-h-10 dx:bg-dx-surface-2 dx:text-slate-200 dx:border dx:border-white/10 dx:rounded-[8px] dx:px-3 dx:py-2 dx:font-mono dx:text-sm dx:outline-none dx:focus:border-dx-accent/50"
                      />
                      <button
                        type="button"
                        onClick={() => saveField(field)}
                        className="dx-btn-ghost dx:min-h-10 dx:px-3"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(field)}
                      className="dx:font-mono dx:text-sm dx:text-slate-400 dx:hover:text-slate-200 dx:truncate dx:max-w-full dx:sm:max-w-[140px] dx:min-h-10 dx:px-1"
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
        <p className="dx:mt-3 dx:text-xs dx:font-mono dx:text-red-400 dx:shrink-0">{error}</p>
      )}

      {pasteOpen && (
        <div className="dx:mt-3 dx:shrink-0 dx:rounded-[12px] dx:border dx:border-white/10 dx:bg-dx-surface-0 dx:p-3">
          <label className="dx:block dx:font-mono dx:text-xs dx:uppercase dx:tracking-wider dx:text-slate-500">
            Paste DesignProperties JSON
            <textarea
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              rows={5}
              spellCheck={false}
              className="dx:mt-2 dx:w-full dx:resize-y dx:rounded-[8px] dx:border dx:border-white/10 dx:bg-dx-surface-2 dx:px-3 dx:py-2 dx:font-mono dx:text-xs dx:text-slate-200 dx:outline-none dx:focus:border-dx-accent/50"
              placeholder='{ "radius": 12, "padding": 16, "bgPreset": "#1A1A2B", "borderPreset": "#A78BFA" }'
            />
          </label>
          <div className="dx:mt-2 dx:flex dx:flex-wrap dx:gap-2">
            <button
              type="button"
              onClick={handlePasteTokens}
              className="dx-btn-primary dx:min-h-10 dx:px-3"
            >
              Apply paste
            </button>
            <button
              type="button"
              onClick={() => {
                setPasteOpen(false);
                setPasteValue('');
                setError(null);
              }}
              className="dx-btn-secondary dx:min-h-10 dx:px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="dx:mt-3 dx:flex dx:shrink-0 dx:flex-wrap dx:items-center dx:gap-2 dx:border-t dx:border-white/5 dx:pt-3">
        {onReadFromPreview && (
          <button
            type="button"
            onClick={handleReadFromPreview}
            title="Read computed border-radius, padding, background, and border-colour from the active target into this node"
            className="dx-btn-secondary dx:min-h-10 dx:px-3"
          >
            {readLabel}
          </button>
        )}
        {onApplyToTarget && (
          <button
            type="button"
            onClick={handleApplyToTarget}
            title="Apply calibrated tokens to the selected host target"
            className="dx-btn-primary dx:min-h-10 dx:px-3"
          >
            Apply to target
          </button>
        )}
        <button
          type="button"
          onClick={() => void copyTokens('css')}
          title="Copy selected node tokens as CSS custom properties"
          className={`${
            onApplyToTarget ? 'dx-btn-secondary' : 'dx-btn-primary'
          } dx:min-h-10 dx:px-3`}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => void copyTokens('json')}
          title="Copy selected node tokens as JSON"
          className="dx-btn-secondary dx:min-h-10 dx:px-3"
        >
          JSON
        </button>
        <button
          type="button"
          onClick={() => void copyTokens('prompt')}
          title="Copy an agent prompt that asks for DesignProperties JSON"
          className="dx-btn-secondary dx:min-h-10 dx:px-3"
        >
          Prompt
        </button>
        <button
          type="button"
          onClick={() => {
            setPasteOpen((open) => !open);
            setError(null);
          }}
          title="Paste DesignProperties JSON into this node"
          aria-expanded={pasteOpen}
          className="dx-btn-secondary dx:min-h-10 dx:px-3"
        >
          Paste
        </button>
        {feedback && (
          <span
            className="dx:font-mono dx:text-xs dx:text-dx-accent"
            role="status"
            aria-live="polite"
          >
            {feedback}
          </span>
        )}
      </div>
    </section>
  );
};

export default TokenCalibrationUnit;
