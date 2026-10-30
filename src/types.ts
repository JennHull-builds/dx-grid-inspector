/**
 * High-level grouping used to filter nodes in the Template Grid Manager.
 */
export type NodeCategory = 'Display' | 'Content' | 'Navigation' | 'Functional';

/**
 * Workflow status shown on each template grid node.
 */
export type NodeStatus = 'Ready' | 'In Progress';

/**
 * Editable layout and surface tokens for a design node.
 * “Read from preview/target” copies computed border-radius, padding, gap, margin,
 * background, and border-colour into these fields. Overlay apply writes them back as
 * inline styles.
 */
export interface DesignProperties {
  radius: number | string;
  padding: number | string;
  /**
   * Space between the element's children, one value like padding: the `column-gap` of a
   * flex row, otherwise the `row-gap`. Absent in tokens saved before gap existed; it only
   * has an effect on a flex or grid container.
   */
  gap?: number | string;
  /**
   * Space outside the element (`margin-top`), one value like padding. Writing it sets all
   * four sides. Absent in tokens saved before margin existed.
   */
  margin?: number | string;
  bgPreset: string;
  borderPreset: string;
}

/**
 * One element's tokens for “Copy all”: a short label, the values it was read with, and
 * its current values.
 */
export interface TokenSessionEntry {
  label: string;
  before: DesignProperties;
  after: DesignProperties;
}

/**
 * The colours the HUD's colour picker measures contrast against, as CSS colours. A host
 * supplies them for the selected element.
 */
export interface ContrastContext {
  /** The element's own text colour. A surface fill is measured against it. */
  textColour: string;
  /** The background behind the element. A border colour is measured against it. */
  backgroundColour: string;
}

/**
 * The name of one editable token in `DesignProperties`.
 */
export type DesignField = keyof DesignProperties;

/**
 * Canonical design node used across the grid overlay, calibration HUD, and harness.
 */
export interface DesignNode {
  id: string;
  name: string;
  category: NodeCategory;
  status: NodeStatus;
  properties: DesignProperties;
}
