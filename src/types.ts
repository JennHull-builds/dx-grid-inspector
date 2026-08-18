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
 * “Read from preview” copies computed border-radius, padding, background,
 * and border-colour into these fields.
 */
export interface DesignProperties {
  radius: number | string;
  padding: number | string;
  bgPreset: string;
  borderPreset: string;
}

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
