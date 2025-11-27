import { NodeType, AgentResponse, StreamEvent } from '../types';

// Backend API URL - 可通过环境变量配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Default model
const defaultModelName = 'claude-sonnet-4-20250514';

/**
 * Generate brainstorm ideas by calling backend Agent SDK
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

/**
 * Chat with Agent using backend Agent SDK with SSE streaming
 */
export const chatWithAgentStream = async (
  userMessage: string,
  currentMapData: any[],
  modelId?: string,
  onEvent?: (event: StreamEvent) => void
): Promise<AgentResponse> => {
  const emit = onEvent || (() => {});

  try {
    const response = await fetch(`${API_BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        currentMapData,
        modelId: modelId || defaultModelName,
        sessionId: crypto.randomUUID() // 生成会话 ID
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // 处理 SSE 流
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse: AgentResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // 解析 SSE 数据
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;

        if (line.startsWith('event:')) {
          const eventType = line.slice(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          try {
            const data = JSON.parse(dataStr);

            // 根据事件类型分发
            if (data.text !== undefined) {
              emit({ type: 'text_delta', text: data.text });
            } else if (data.reply !== undefined) {
              // done 事件
              finalResponse = {
                reply: data.reply,
                operations: data.operations || [],
                toolCalls: data.toolCalls || []
              };
              emit({ type: 'done', response: finalResponse });
            } else if (data.message) {
              // error 事件
              emit({ type: 'error', error: data.message });
              throw new Error(data.message);
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', dataStr, e);
          }
        }
      }
    }

    if (!finalResponse) {
      throw new Error('No final response received from agent');
    }

    return finalResponse;

  } catch (error) {
    console.error("Agent Stream Error:", error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    emit({ type: 'error', error: errorMsg });

    return {
      reply: "抱歉，我在处理您的请求时遇到了问题。请确保后端服务已启动（npm run server）。",
      operations: [],
      toolCalls: []
    };
  }
};

// 保留旧的 API 名称作为别名
export const chatWithAgent = chatWithAgentStream;
