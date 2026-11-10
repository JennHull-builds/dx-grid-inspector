import React, { useEffect, useId, useRef, useState } from 'react';
import { ColourPicker, type ColourPickerContrast } from './picker/ColourPicker';
import { parseColour } from './picker/colourEngine';
import { sanitizeColour } from './picker/colourInput';
import { readPageTokens, type PageToken } from './picker/pageTokens';
import {
  copyTextToClipboard,
  cssLength,
  formatTokensAsAgentPrompt,
  formatSessionAsCss,
  formatSessionAsJson,
  formatTokensAsCss,
  formatTokensAsJson,
  parseDesignPropertiesJson,
} from './tokenExport';
import type {
  ContrastContext,
  DesignField,
  DesignNode,
  DesignProperties,
  TokenSessionEntry,
} from './types';

const FEEDBACK_MS = 2000;

/**
 * Where a field is in an edit. `start` when editing begins; `nudge` after each arrow-key
 * press on a length, or each change in the colour picker; `commit` when Enter keeps the
 * value; `revert` when Escape puts back the value from before editing started.
 */
export type FieldEditPhase = 'start' | 'nudge' | 'commit' | 'revert';

/**
 * Reported by the HUD as a length or colour field is edited, so a host can show the change
 * on its target live. `properties` already carries the new value (for `revert`, the old one).
 */
export interface FieldEditEvent {
  phase: FieldEditPhase;
  field: DesignField;
  properties: DesignProperties;
  /**
   * On `commit` only: true when an arrow key or the colour picker changed the value during
   * this edit. A host that follows nudges live should also write the committed value then,
   * because Enter may have kept a different value from the one it last saw on `nudge`.
   */
  nudged?: boolean;
}

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
  /**
   * Called as a length or colour field is edited, so the target can follow arrow-key nudges
   * and colour-picker changes live. Optional: without it, the HUD still changes the value.
   */
  onFieldEdit?: (event: FieldEditEvent) => void;
  /**
   * The element's text colour and the background behind it, which the colour picker measures
   * contrast against. Optional: without it the picker shows no contrast.
   */
  contrastContext?: ContrastContext;
  /**
   * Elements for the “Copy all” control: a label, the values each was read with, and its
   * current values. Omit it and the control is not shown.
   */
  sessionEntries?: TokenSessionEntry[];
  /** Tooltip for “Copy all”; says where the list is kept. Defaults to the in-memory note. */
  copyAllTitle?: string;
}

const DEFAULT_COPY_ALL_TITLE =
  'Copy every element you have tweaked this session as CSS or JSON. The list is kept in memory only and clears when you reload the page.';

type EditableField = DesignField;
type FieldKind = 'color' | 'layout' | 'border';

interface FieldConfig {
  key: EditableField;
  label: string;
  kind: FieldKind;
}

const FIELDS: FieldConfig[] = [
  { key: 'radius', label: 'Corner Radius', kind: 'layout' },
  { key: 'padding', label: 'Internal Padding', kind: 'layout' },
  { key: 'gap', label: 'Gap Between Children', kind: 'layout' },
  { key: 'margin', label: 'Outer Margin', kind: 'layout' },
  { key: 'bgPreset', label: 'Surface Fill', kind: 'color' },
  { key: 'borderPreset', label: 'Border Preset', kind: 'border' },
];

/**
 * Reads a typed length. `rem` is kept as written (`"1.5rem"`); the other units still reduce
 * to their number, which the HUD treats as px.
 */
const parseLayoutValue = (val: string): number | string | null => {
  const trimmed = val.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  const withUnit = trimmed.match(/^(\d+(?:\.\d+)?)(px|rem|%|vh|vw|em)$/i);
  if (!withUnit) {
    return null;
  }
  return withUnit[2].toLowerCase() === 'rem'
    ? `${Number(withUnit[1])}rem`
    : Number(withUnit[1]);
};

/**
 * The text after one arrow-key press on a px, unitless or rem value: 1 (Shift 10) for px,
 * 0.125 (Shift 1) for rem, never below 0. Null for any other text, so nothing happens.
 */
const nudgeLayoutText = (text: string, direction: 1 | -1, large: boolean): string | null => {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)(px|rem)?$/i);
  if (!match) return null;
  const unit = (match[2] ?? '').toLowerCase();
  const step = unit === 'rem' ? (large ? 1 : 0.125) : large ? 10 : 1;
  const next = Math.max(0, Math.round((Number(match[1]) + direction * step) * 1000) / 1000);
  return `${next}${unit}`;
};

/** A copy of `properties` with one field set, or removed when `value` is undefined. */
const withField = (
  properties: DesignProperties,
  key: EditableField,
  value: DesignProperties[EditableField],
): DesignProperties => {
  const next: Record<string, unknown> = { ...properties };
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next as unknown as DesignProperties;
};

const displayValue = (field: FieldConfig, properties: DesignProperties): string => {
  const value = properties[field.key];
  if (field.kind === 'layout') {
    return cssLength(value ?? 0);
  }
  return String(value);
};

const CHECKERBOARD = 'conic-gradient(#9ca3af 25%, #6b7280 0 50%, #9ca3af 0 75%, #6b7280 0)';

interface ColourSwatchButtonProps {
  label: string;
  /** A CSS colour, shown over a checkerboard so transparency can be seen. */
  value: string;
  open: boolean;
  /** The id of the picker this button opens. */
  controls: string;
  onToggle: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  buttonRef: (element: HTMLButtonElement | null) => void;
}

/**
 * The swatch beside a colour field. It opens the colour picker under the field; the paired
 * text field remains the source of truth for the value.
 */
const ColourSwatchButton: React.FC<ColourSwatchButtonProps> = ({
  label,
  value,
  open,
  controls,
  onToggle,
  onKeyDown,
  buttonRef,
}) => (
  <button
    ref={buttonRef}
    type="button"
    aria-label={`${label} colour picker`}
    title={`${label} colour picker`}
    aria-expanded={open}
    aria-controls={controls}
    onClick={onToggle}
    onKeyDown={onKeyDown}
    className="dx:h-10 dx:w-10 dx:min-h-10 dx:min-w-10 dx:shrink-0 dx:cursor-pointer dx:rounded-[8px] dx:border dx:border-white/10 dx:bg-dx-surface-2 dx:p-0.5 dx:focus-visible:outline-2 dx:focus-visible:outline-offset-2 dx:focus-visible:outline-dx-accent"
  >
    <span
      aria-hidden="true"
      className="dx:block dx:h-full dx:w-full dx:rounded-[5px]"
      style={{
        backgroundImage: `linear-gradient(${value}, ${value}), ${CHECKERBOARD}`,
        backgroundSize: 'auto, 8px 8px',
      }}
    />
  </button>
);

/**
 * Live token calibration HUD for padding, radius, gap, margin, surface fills, and border presets.
 * Surface Fill and Border Preset pair a colour picker (a swatch that opens it under the field)
 * with a text field that stays the source of truth.
 * Copy writes CSS custom properties to the clipboard; JSON is a second export format.
 */
export const TokenCalibrationUnit: React.FC<TokenCalibrationUnitProps> = ({
  selectedNode,
  onUpdateProperties,
  onReadFromPreview,
  readLabel = 'Read from preview',
  onApplyToTarget,
  emptyHint = 'Select a node from the Template Grid Manager to calibrate layout tokens.',
  onFieldEdit,
  contrastContext,
  sessionEntries,
  copyAllTitle = DEFAULT_COPY_ALL_TITLE,
}) => {
  const [editingKey, setEditingKey] = useState<EditableField | null>(null);
  /** The colour field whose picker is open. At most one; it is always the field being edited. */
  const [pickerKey, setPickerKey] = useState<EditableField | null>(null);
  /** The page's colour tokens, read each time a picker opens. */
  const [pickerTokens, setPickerTokens] = useState<PageToken[]>([]);
  const pickerId = useId();
  const swatchRefs = useRef<Partial<Record<EditableField, HTMLButtonElement | null>>>({});
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [copyAllOpen, setCopyAllOpen] = useState(false);
  const feedbackTimerRef = useRef<number | null>(null);
  /** The field being edited, the value it had before, and whether arrow keys have moved it. */
  const editStartRef = useRef<{
    key: EditableField;
    value: DesignProperties[EditableField];
    nudged: boolean;
  } | null>(null);

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
          <p className="dx:text-sm dx:font-mono dx:text-dx-muted dx:text-center dx:px-4">
            {emptyHint}
          </p>
        </div>
      </section>
    );
  }

  /** Leaves the field being edited, and closes its colour picker if one is open. */
  const stopEditing = () => {
    setEditingKey(null);
    setPickerKey(null);
  };

  const startEdit = (field: FieldConfig) => {
    setEditingKey(field.key);
    setPickerKey(null);
    setInputValue(displayValue(field, selectedNode.properties));
    setError(null);
    editStartRef.current = {
      key: field.key,
      value: selectedNode.properties[field.key],
      nudged: false,
    };
    onFieldEdit?.({ phase: 'start', field: field.key, properties: selectedNode.properties });
  };

  const saveField = (field: FieldConfig) => {
    const current = selectedNode.properties;

    if (field.kind === 'layout') {
      const parsed = parseLayoutValue(inputValue);
      if (parsed === null) {
        setError('Invalid layout size. Use a number or units like px, rem, %.');
        return;
      }
      const next = withField(current, field.key, parsed);
      const nudged = editStartRef.current?.key === field.key && editStartRef.current.nudged;
      onUpdateProperties(selectedNode.id, next);
      editStartRef.current = null;
      onFieldEdit?.({ phase: 'commit', field: field.key, properties: next, nudged });
      // A nudge announced its own value; say what Enter kept so the line is not left stale.
      if (nudged) announce(`${field.label} ${cssLength(parsed)}`);
    } else {
      const sanitized = sanitizeColour(inputValue);
      if (!sanitized) {
        setError('Invalid colour. Use hex (#RGB or #RRGGBB), rgba(...) or oklch(...).');
        return;
      }
      const next = withField(current, field.key, sanitized);
      const nudged = editStartRef.current?.key === field.key && editStartRef.current.nudged;
      onUpdateProperties(selectedNode.id, next);
      editStartRef.current = null;
      onFieldEdit?.({ phase: 'commit', field: field.key, properties: next, nudged });
      if (nudged) announce(`${field.label} ${sanitized}`);
    }

    stopEditing();
    setError(null);
  };

  /** Escape: leave the field and put back what it held before editing started. */
  const cancelEdit = (field: FieldConfig) => {
    const start = editStartRef.current;
    editStartRef.current = null;
    if (start?.key === field.key && start.nudged) {
      const restored = withField(selectedNode.properties, field.key, start.value);
      onUpdateProperties(selectedNode.id, restored);
      onFieldEdit?.({ phase: 'revert', field: field.key, properties: restored });
      announce(`${field.label} ${cssLength(start.value ?? 0)}`);
    }
    stopEditing();
    setError(null);
  };

  /**
   * Closes a colour field and keeps what it holds: the text field's colour when it reads as
   * one, otherwise the colour the picker last set. Used when the picker is closed by Enter,
   * by its swatch, or by opening another field's picker.
   */
  const keepColour = (field: FieldConfig) => {
    const current = selectedNode.properties;
    const kept = sanitizeColour(inputValue) ?? String(current[field.key]);
    const next = withField(current, field.key, kept);
    const nudged = editStartRef.current?.key === field.key && editStartRef.current.nudged;
    if (kept !== current[field.key]) onUpdateProperties(selectedNode.id, next);
    editStartRef.current = null;
    onFieldEdit?.({ phase: 'commit', field: field.key, properties: next, nudged });
    if (nudged) announce(`${field.label} ${kept}`);
    stopEditing();
    setError(null);
  };

  const closePicker = (field: FieldConfig, how: 'keep' | 'revert') => {
    if (how === 'keep') keepColour(field);
    else cancelEdit(field);
    // The picker is gone; hand keyboard focus back to the swatch that opened it.
    swatchRefs.current[field.key]?.focus();
  };

  /** The swatch: opens the picker under the field, or closes it keeping the colour. */
  const togglePicker = (field: FieldConfig) => {
    if (pickerKey === field.key) {
      closePicker(field, 'keep');
      return;
    }
    // Opening a second picker closes the first and keeps its colour.
    const open = FIELDS.find((candidate) => candidate.key === pickerKey);
    if (open) keepColour(open);
    if (open || editingKey !== field.key) startEdit(field);
    setPickerTokens(readPageTokens());
    setPickerKey(field.key);
  };

  /** A change in the picker: shown in the text field, the HUD and, through the host, the target. */
  const handlePickerChange = (field: FieldConfig, colour: string) => {
    const next = withField(selectedNode.properties, field.key, colour);
    if (editStartRef.current?.key === field.key) {
      editStartRef.current.nudged = true;
    }
    setInputValue(colour);
    setError(null);
    onUpdateProperties(selectedNode.id, next);
    onFieldEdit?.({ phase: 'nudge', field: field.key, properties: next });
  };

  /** What a colour field's picker measures contrast against, when the host supplied it. */
  const contrastFor = (field: FieldConfig): ColourPickerContrast | null => {
    if (!contrastContext) return null;
    return field.kind === 'color'
      ? {
          role: 'fill',
          against: contrastContext.textColour,
          backdrop: contrastContext.backgroundColour,
        }
      : { role: 'border', against: contrastContext.backgroundColour };
  };

  /** ArrowUp / ArrowDown while editing a length: change the value and show it at once. */
  const nudgeField = (field: FieldConfig, direction: 1 | -1, large: boolean) => {
    const text = nudgeLayoutText(inputValue, direction, large);
    const value = text === null ? null : parseLayoutValue(text);
    if (text === null || value === null) return;

    const next = withField(selectedNode.properties, field.key, value);
    if (editStartRef.current?.key === field.key) {
      editStartRef.current.nudged = true;
    }
    setInputValue(text);
    setError(null);
    onUpdateProperties(selectedNode.id, next);
    onFieldEdit?.({ phase: 'nudge', field: field.key, properties: next });
    announce(`${field.label} ${cssLength(value)}`);
  };

  const handleFieldKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: FieldConfig,
  ) => {
    if (e.key === 'Enter') saveField(field);
    if (e.key === 'Escape') cancelEdit(field);
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      field.kind === 'layout' &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      e.preventDefault();
      nudgeField(field, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
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

  const copyAll = async (format: 'css' | 'json') => {
    const entries = sessionEntries ?? [];
    const ok = await copyTextToClipboard(
      format === 'css' ? formatSessionAsCss(entries) : formatSessionAsJson(entries),
    );
    if (ok) setCopyAllOpen(false);
    announce(
      ok
        ? `Copied ${entries.length} ${entries.length === 1 ? 'element' : 'elements'} as ${
            format === 'css' ? 'CSS' : 'JSON'
          }`
        : 'Copy failed',
    );
  };

  const handleReadFromPreview = () => {
    if (!onReadFromPreview) return;
    stopEditing();
    setError(null);
    onReadFromPreview();
    announce('Read tokens from target');
  };

  const handleApplyToTarget = () => {
    if (!onApplyToTarget) return;
    stopEditing();
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
        <p className="dx:text-xs dx:font-mono dx:text-dx-muted dx:mt-1 dx:truncate">
          Editing: {selectedNode.name}
        </p>
      </div>

      <div className="dx:flex dx:flex-col dx:gap-2.5 dx:overflow-y-auto dx:overscroll-contain dx:flex-1 dx:pr-1 dx:min-h-0">
        {FIELDS.map((field) => {
          const isEditing = editingKey === field.key;
          const value = displayValue(field, selectedNode.properties);
          const pickerOpen = pickerKey === field.key && isEditing;
          const shown = isEditing ? inputValue : value;
          // While typing, the swatch keeps the last colour that parses.
          const swatchValue = parseColour(shown) ? shown : value;

          return (
            <div
              key={field.key}
              className={`dx:rounded-[12px] dx:border dx:p-3 dx:transition-all ${
                isEditing
                  ? 'dx-selection dx:bg-dx-surface-0'
                  : 'dx-selection-idle'
              }`}
            >
              {/* While editing, the row always stacks: the HUD column is narrow at any screen width,
                  and the swatch, input and Save beside the label squashed it to nothing at 1280px. */}
              <div
                className={`dx:flex dx:flex-col dx:gap-3 ${
                  isEditing ? '' : 'dx:sm:flex-row dx:sm:items-center dx:sm:justify-between'
                }`}
              >
                <button
                  type="button"
                  onClick={() => !isEditing && startEdit(field)}
                  className="dx:flex dx:flex-col dx:items-start dx:gap-0.5 dx:text-left dx:flex-1 dx:min-w-0"
                >
                  <span className="dx:text-sm dx:font-medium dx:text-slate-200">{field.label}</span>
                  <span className="dx:text-xs dx:font-mono dx:text-dx-accent/85">{field.key}</span>
                </button>

                <div
                  className={`dx:flex dx:items-center dx:gap-2 dx:shrink-0 dx:w-full dx:justify-between ${
                    isEditing ? '' : 'dx:sm:w-auto dx:sm:justify-end'
                  }`}
                >
                  {(field.kind === 'color' || field.kind === 'border') && (
                    <ColourSwatchButton
                      label={field.label}
                      value={swatchValue}
                      open={pickerOpen}
                      controls={`${pickerId}-${field.key}`}
                      buttonRef={(element) => {
                        swatchRefs.current[field.key] = element;
                      }}
                      onToggle={() => togglePicker(field)}
                      onKeyDown={
                        isEditing
                          ? (e) => {
                              if (e.key === 'Escape') cancelEdit(field);
                            }
                          : undefined
                      }
                    />
                  )}

                  {isEditing ? (
                    <div className="dx:flex dx:flex-1 dx:items-center dx:gap-2 dx:min-w-0">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, field)}
                        autoFocus
                        className="dx:flex-1 dx:min-w-0 dx:min-h-10 dx:bg-dx-surface-2 dx:text-slate-200 dx:border dx:border-white/10 dx:rounded-[8px] dx:px-3 dx:py-2 dx:font-mono dx:text-sm dx:outline-none dx:focus:border-dx-accent/50"
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

              {pickerOpen && (
                <div id={`${pickerId}-${field.key}`} className="dx:mt-3">
                  <ColourPicker
                    label={field.label}
                    value={inputValue}
                    tokens={pickerTokens}
                    contrast={contrastFor(field)}
                    autoFocus
                    onChange={(colour) => handlePickerChange(field, colour)}
                    onCommit={() => closePicker(field, 'keep')}
                    onRevert={() => closePicker(field, 'revert')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="dx:mt-3 dx:text-xs dx:font-mono dx:text-red-400 dx:shrink-0">{error}</p>
      )}

      {copyAllOpen && sessionEntries && (
        <div className="dx:mt-3 dx:shrink-0 dx:rounded-[12px] dx:border dx:border-white/10 dx:bg-dx-surface-0 dx:p-3">
          <p className="dx:font-mono dx:text-xs dx:uppercase dx:tracking-wider dx:text-dx-muted">
            Copy {sessionEntries.length} {sessionEntries.length === 1 ? 'element' : 'elements'} as
          </p>
          <ul className="dx:mt-2 dx:max-h-24 dx:overflow-y-auto dx:font-mono dx:text-xs dx:text-slate-400">
            {sessionEntries.map((entry) => (
              <li key={entry.label} className="dx:truncate">
                {entry.label}
              </li>
            ))}
          </ul>
          <div className="dx:mt-2 dx:flex dx:flex-wrap dx:gap-2">
            <button
              type="button"
              onClick={() => void copyAll('css')}
              title="Copy every listed element as CSS custom properties, one block each"
              className="dx-btn-primary dx:min-h-10 dx:px-3"
            >
              CSS
            </button>
            <button
              type="button"
              onClick={() => void copyAll('json')}
              title="Copy every listed element as a JSON array of label, before and after"
              className="dx-btn-primary dx:min-h-10 dx:px-3"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => setCopyAllOpen(false)}
              className="dx-btn-secondary dx:min-h-10 dx:px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pasteOpen && (
        <div className="dx:mt-3 dx:shrink-0 dx:rounded-[12px] dx:border dx:border-white/10 dx:bg-dx-surface-0 dx:p-3">
          <label className="dx:block dx:font-mono dx:text-xs dx:uppercase dx:tracking-wider dx:text-dx-muted">
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
            title="Read computed border-radius, padding, gap, margin, background, and border-colour from the active target into this node"
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
        {sessionEntries && (
          <button
            type="button"
            onClick={() => {
              setCopyAllOpen((open) => !open);
              setPasteOpen(false);
              setError(null);
            }}
            disabled={sessionEntries.length === 0}
            aria-expanded={copyAllOpen}
            title={
              sessionEntries.length === 0 ? `Nothing to copy yet. ${copyAllTitle}` : copyAllTitle
            }
            className="dx-btn-secondary dx:min-h-10 dx:px-3"
          >
            Copy all ({sessionEntries.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setPasteOpen((open) => !open);
            setCopyAllOpen(false);
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
