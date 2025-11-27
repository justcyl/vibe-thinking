import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { NodeType } from "../types.js";

// Zod 验证 schema
const NodeTypeEnum = z.enum(['topic', 'problem', 'hypothesis', 'action', 'evidence']);

// 定义思维导图操作接口
export interface MindMapOperation {
  action: 'ADD_CHILD' | 'UPDATE_CONTENT' | 'DELETE_NODE';
  parentId?: string;
  nodeId?: string;
  nodeType?: NodeType;
  content?: string;
}

// 用于存储操作的全局数组（每个会话独立）
const operationStore = new Map<string, MindMapOperation[]>();

export function getOperations(sessionId: string): MindMapOperation[] {
  return operationStore.get(sessionId) || [];
}

export function clearOperations(sessionId: string): void {
  operationStore.delete(sessionId);
}

// 创建 MCP 服务器（直接定义工具，不使用 tool() 函数）
export const mindMapMcpServer = createSdkMcpServer({
  name: "mindmap",
  version: "1.0.0",
  description: "Mind map operations for Vibe-Thinking whiteboard",

  tools: [
    {
      name: "add_node",
      description: "Add a new child node to an existing node in the mind map. Follow the 5-stage framework: Topic -> Problem -> Hypothesis -> Action -> Evidence.",
      input: z.object({
        parent_id: z.string().describe("The ID of the parent node to add the child to"),
        node_type: NodeTypeEnum.describe("The type of the new node following the framework"),
        content: z.string().describe("The content of the new node (in Simplified Chinese)"),
        session_id: z.string().describe("Session identifier")
      }),
      execute: async ({ parent_id, node_type, content, session_id }: any) => {
        const operation: MindMapOperation = {
          action: 'ADD_CHILD',
          parentId: parent_id,
          nodeType: node_type as NodeType,
          content
        };

        if (!operationStore.has(session_id)) {
          operationStore.set(session_id, []);
        }
        operationStore.get(session_id)!.push(operation);

        return {
          success: true,
          message: `Added "${content}" (${node_type}) under parent ${parent_id}`,
          operation
        };
      }
    },
    {
      name: "update_node",
      description: "Update the content of an existing node in the mind map",
      input: z.object({
        node_id: z.string().describe("The ID of the node to update"),
        content: z.string().describe("The new content for the node (in Simplified Chinese)"),
        session_id: z.string().describe("Session identifier")
      }),
      execute: async ({ node_id, content, session_id }: any) => {
        const operation: MindMapOperation = {
          action: 'UPDATE_CONTENT',
          nodeId: node_id,
          content
        };

        if (!operationStore.has(session_id)) {
          operationStore.set(session_id, []);
        }
        operationStore.get(session_id)!.push(operation);

        return {
          success: true,
          message: `Updated node ${node_id} with content "${content}"`,
          operation
        };
      }
    },
    {
      name: "delete_node",
      description: "Delete a node and all its descendants from the mind map",
      input: z.object({
        node_id: z.string().describe("The ID of the node to delete"),
        session_id: z.string().describe("Session identifier")
      }),
      execute: async ({ node_id, session_id }: any) => {
        const operation: MindMapOperation = {
          action: 'DELETE_NODE',
          nodeId: node_id
        };

        if (!operationStore.has(session_id)) {
          operationStore.set(session_id, []);
        }
        operationStore.get(session_id)!.push(operation);

        return {
          success: true,
          message: `Deleted node ${node_id} and its descendants`,
          operation
        };
      }
    }
  ]
});
