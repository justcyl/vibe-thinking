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

export interface MindMapSnapshotNode {
  id: string;
  type: NodeType;
  content: string;
  children: string[];
}

export interface MindMapSnapshot {
  nodes: Record<string, MindMapSnapshotNode>;
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
  nodeSize: NodeSize;
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

// 工具调用状态
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error';

// 工具调用记录
export interface ToolCall {
  id: string;
  name: string;           // 工具名称: add_node, update_node, delete_node
  arguments: Record<string, unknown>;  // 工具参数
  status: ToolCallStatus;
  result?: unknown;       // 工具执行结果
  error?: string;         // 错误信息
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  // 助手消息可能包含工具调用
  toolCalls?: ToolCall[];
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
  // 新增：工具调用记录
  toolCalls?: ToolCall[];
}

// 流式回调事件类型
export type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; toolCall: ToolCall }
  | { type: 'tool_end'; toolCall: ToolCall }
  | { type: 'done'; response: AgentResponse }
  | { type: 'error'; error: string };

export type NodeSize = 'small' | 'medium' | 'large';

// --- Model Types ---
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export type ModelId = 'pz/gpt-5' | 'anthropic/claude-sonnet-4.5';

// --- Conversation Types ---
export interface Conversation {
  id: string;
  title: string;
  messages: AgentMessage[];
  canvasId: string;      // 绑定的画布 ID
  canvasName: string;    // 绑定的画布名称（创建时快照）
  createdAt: number;
  updatedAt: number;
}
