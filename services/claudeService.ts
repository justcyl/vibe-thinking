import { NodeType } from '../types';

// Backend API URL - 可通过环境变量配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Default model
const defaultModelName = 'claude-sonnet-4-20250514';

/**
 * 调用后端脑暴接口生成节点建议。
 */
export const generateBrainstormIdeas = async (
  parentNodeContent: string,
  parentNodeType: NodeType,
  contextTrace: string[],
  modelId?: string
): Promise<{ type: NodeType; content: string }[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/brainstorm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parentContent: parentNodeContent,
        parentType: parentNodeType,
        contextTrace,
        modelId: modelId || defaultModelName
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.nodes || [];

  } catch (error) {
    console.error("Brainstorm API Error:", error);
    throw error;
  }
};
