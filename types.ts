import { SimulationNodeDatum } from 'd3-force';

export enum NodeType {
  TOPIC = 'topic',
  PROBLEM = 'problem',
  HYPOTHESIS = 'hypothesis',
  ACTION = 'action',
  EVIDENCE = 'evidence',
}

// Normalized Node (Flat)
export interface MindMapNode {
  id: string;
  type: NodeType;
  content: string;
  parentId: string | null;
  children: string[]; // Array of IDs
  // Coordinates for root nodes
  x?: number;
  y?: number;
}

// Normalized State (The Project)
export interface MindMapProject {
  nodes: Record<string, MindMapNode>;
  rootIds: string[];
}

// Flattened node with layout coordinates (For Rendering)
export interface LayoutNode {
  id: string;
  type: NodeType;
  content: string;
  x: number;
  y: number;
  parentId: string | null;
  data: MindMapNode; // Reference to original data
  depth: number;
}

export interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export type Theme = 'dark' | 'light';
export type Orientation = 'vertical' | 'horizontal';

export interface ViewSettings {
  theme: Theme;
  orientation: Orientation;
}

export interface Canvas {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: MindMapProject; // Updated to use Project type
}

// --- Agent Types ---

export type AgentRole = 'user' | 'assistant' | 'system';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
}

export type AgentOperationType = 'ADD_CHILD' | 'UPDATE_CONTENT' | 'DELETE_NODE';

export interface AgentOperation {
  action: AgentOperationType;
  // For ADD_CHILD
  parentId?: string;
  nodeType?: NodeType;
  content?: string;
  // For UPDATE/DELETE
  nodeId?: string;
}

export interface AgentResponse {
  reply: string;
  operations: AgentOperation[];
}
