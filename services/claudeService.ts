import Anthropic from '@anthropic-ai/sdk';
import { NodeType, AgentResponse, ToolCall, StreamEvent } from '../types';

const apiKey = process.env.ANTHROPIC_API_KEY || '';
const baseURL = process.env.ANTHROPIC_API_BASE || undefined;

// Debug: log config on load
console.log('[Claude Service] API Key set:', !!apiKey, 'Base URL:', baseURL || 'default');

const client = new Anthropic({
  apiKey,
  baseURL,
  dangerouslyAllowBrowser: true, // Required for browser environment
});

// Default model - can be overridden per request
const defaultModelName = 'pz/gpt-5';


// Tool definitions for structured output
const brainstormTool: Anthropic.Tool = {
  name: 'generate_nodes',
  description: 'Generate logical child nodes for the mind map based on the 5-stage thought framework',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['topic', 'problem', 'hypothesis', 'action', 'evidence'],
              description: 'The type of the node following the 5-stage framework'
            },
            content: {
              type: 'string',
              description: 'The content of the node (under 20 words, in Simplified Chinese)'
            }
          },
          required: ['type', 'content']
        },
        description: 'Array of 3-4 logical child nodes'
      }
    },
    required: ['nodes']
  }
};

// 独立的画布操作工具
const addNodeTool: Anthropic.Tool = {
  name: 'add_node',
  description: 'Add a new child node to an existing node in the mind map',
  input_schema: {
    type: 'object' as const,
    properties: {
      parent_id: {
        type: 'string',
        description: 'The ID of the parent node to add the child to'
      },
      node_type: {
        type: 'string',
        enum: ['topic', 'problem', 'hypothesis', 'action', 'evidence'],
        description: 'The type of the new node'
      },
      content: {
        type: 'string',
        description: 'The content of the new node (in Simplified Chinese)'
      }
    },
    required: ['parent_id', 'node_type', 'content']
  }
};

const updateNodeTool: Anthropic.Tool = {
  name: 'update_node',
  description: 'Update the content of an existing node in the mind map',
  input_schema: {
    type: 'object' as const,
    properties: {
      node_id: {
        type: 'string',
        description: 'The ID of the node to update'
      },
      content: {
        type: 'string',
        description: 'The new content for the node (in Simplified Chinese)'
      }
    },
    required: ['node_id', 'content']
  }
};

const deleteNodeTool: Anthropic.Tool = {
  name: 'delete_node',
  description: 'Delete a node and all its descendants from the mind map',
  input_schema: {
    type: 'object' as const,
    properties: {
      node_id: {
        type: 'string',
        description: 'The ID of the node to delete'
      }
    },
    required: ['node_id']
  }
};

// Agent 工具列表
const agentTools: Anthropic.Tool[] = [addNodeTool, updateNodeTool, deleteNodeTool];

const systemPromptBrainstorm = `You are a rigorous logical thinking assistant using a specific 5-stage thought framework.
All output must be in Simplified Chinese.

Strict Node Definitions & Rules:

1. TOPIC (主题)
   - Definition: The context/boundary. The container of thought.
   - Syntax: Declarative.

2. PROBLEM (难题/挑战)
   - Definition: Current Blockers (cannot proceed) or Future Risks (will fail). The gap between reality and goal.
   - Syntax: Question (How/Why) OR Negative Declaration.
   - Flow: Usually follows TOPIC or EVIDENCE.

3. HYPOTHESIS (假说/设想)
   - Definition: Subjective prediction/answer to a PROBLEM. A "simulation" in the mind. Not a fact yet.
   - Syntax: Declarative (Judgment/Assertion).
   - Flow: Must follow PROBLEM.

4. ACTION (行动/实验)
   - Definition: Concrete step to verify the HYPOTHESIS. Must be actionable and produce EVIDENCE.
   - Syntax: Imperative (Verb-Object).
   - Flow: Must follow HYPOTHESIS.

5. EVIDENCE (事实/证据)
   - Definition: Objective result/data from an ACTION. Neutral observation. Anchors/Verifies the HYPOTHESIS.
   - Syntax: Declarative (Fact).
   - Flow: Must follow ACTION.

Goal: Generate 3-4 logical child nodes based on the Parent Node.

Logical Flow Rules:
- If Parent is TOPIC -> Suggest PROBLEMS (What prevents this topic from succeeding?).
- If Parent is PROBLEM -> Suggest HYPOTHESES (Possible solutions or root causes).
- If Parent is HYPOTHESIS -> Suggest ACTIONS (How to prove this is true?).
- If Parent is ACTION -> Suggest potential EVIDENCE (What results might we see? Simulated outcomes).
- If Parent is EVIDENCE -> Suggest derived PROBLEM (New issues found) or Refined HYPOTHESIS.

Keep content concise (under 20 words).
You MUST use the generate_nodes tool to output your response.`;

const systemPromptAgent = `You are a Mind Map Assistant (思维助理). You can converse with the user and also MODIFY the mind map directly using tools.

You have access to the current state of the mind map (Nodes with IDs, Types, Content).

Your Available Tools:
1. add_node: Add a new child node to an existing node. Use "type" rules (Topic -> Problem -> Hypothesis -> Action -> Evidence).
2. update_node: Update the content of an existing node.
3. delete_node: Delete an existing node and all its descendants.

Guidelines:
- Only use tools if the user explicitly asks for changes or if it adds significant value.
- If just chatting or answering questions, don't use any tools.
- Refer to nodes by their exact IDs provided in the context.
- CRITICAL: DO NOT repeat or echo the input mind map data in your response.
- You can call multiple tools in sequence if needed.
- Always respond in Simplified Chinese.`;

export const generateBrainstormIdeas = async (
  parentNodeContent: string,
  parentNodeType: NodeType,
  contextTrace: string[],
  modelId?: string
): Promise<{ type: NodeType; content: string }[]> => {

  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is missing");
    return [];
  }

  const userPrompt = `Context Path:
${contextTrace.join(' -> ')}

Parent Node Type: ${parentNodeType}
Parent Node Content: "${parentNodeContent}"

Generate 3-4 next logical steps following the "Logical Flow Rules".`;

  try {
    const response = await client.messages.create({
      model: modelId || defaultModelName,
      max_tokens: 1024,
      system: systemPromptBrainstorm,
      tools: [brainstormTool],
      tool_choice: { type: 'tool', name: 'generate_nodes' },
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    // Extract tool use result
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUseBlock || toolUseBlock.name !== 'generate_nodes') {
      console.warn("Claude did not use the expected tool");
      return [];
    }

    const input = toolUseBlock.input as { nodes: { type: string; content: string }[] };

    if (!input.nodes || !Array.isArray(input.nodes)) {
      console.warn("Invalid tool response:", input);
      return [];
    }

    return input.nodes.map(node => ({
      type: node.type as NodeType,
      content: node.content
    }));

  } catch (error) {
    console.error("Claude API Error:", error);
    throw error;
  }
};

// --- Streaming Agent Interaction ---

interface ToolResult {
  tool_use_id: string;
  content: string;
}

/**
 * 非流式 Agent 交互 - 支持多轮工具调用
 * 使用非流式 API 以兼容更多 API 代理
 */
export const chatWithAgentStream = async (
  userMessage: string,
  currentMapData: any[],
  modelId?: string,
  onEvent?: (event: StreamEvent) => void
): Promise<AgentResponse> => {
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  const emit = onEvent || (() => {});

  const userPrompt = `Current Mind Map State (Flat List):
${JSON.stringify(currentMapData, null, 2)}

User Message:
"${userMessage}"`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt }
  ];

  const allToolCalls: ToolCall[] = [];
  const allOperations: AgentResponse['operations'] = [];
  let finalReply = '';

  try {
    // 多轮工具调用循环
    let continueLoop = true;
    while (continueLoop) {
      const response = await client.messages.create({
        model: modelId || defaultModelName,
        max_tokens: 2048,
        system: systemPromptAgent,
        tools: agentTools,
        messages
      });

      const toolResults: ToolResult[] = [];

      // 处理响应内容
      for (const block of response.content) {
        if (block.type === 'text') {
          finalReply += block.text;
          // 发送文本事件
          emit({ type: 'text_delta', text: block.text });
        } else if (block.type === 'tool_use') {
          // 创建工具调用记录
          const toolCall: ToolCall = {
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
            status: 'running'
          };

          // 通知 UI 工具开始执行
          emit({ type: 'tool_start', toolCall: { ...toolCall } });

          // 将工具调用转换为操作
          const input = block.input as Record<string, unknown>;
          let result = '';

          if (block.name === 'add_node') {
            const operation = {
              action: 'ADD_CHILD' as const,
              parentId: input.parent_id as string,
              nodeType: input.node_type as NodeType,
              content: input.content as string
            };
            allOperations.push(operation);
            result = `Added node "${input.content}" under parent ${input.parent_id}`;
            toolCall.result = { success: true, operation };
          } else if (block.name === 'update_node') {
            const operation = {
              action: 'UPDATE_CONTENT' as const,
              nodeId: input.node_id as string,
              content: input.content as string
            };
            allOperations.push(operation);
            result = `Updated node ${input.node_id} with content "${input.content}"`;
            toolCall.result = { success: true, operation };
          } else if (block.name === 'delete_node') {
            const operation = {
              action: 'DELETE_NODE' as const,
              nodeId: input.node_id as string
            };
            allOperations.push(operation);
            result = `Deleted node ${input.node_id}`;
            toolCall.result = { success: true, operation };
          }

          toolCall.status = 'completed';
          allToolCalls.push(toolCall);

          // 通知 UI 工具执行完成
          emit({ type: 'tool_end', toolCall: { ...toolCall } });

          toolResults.push({
            tool_use_id: block.id,
            content: result
          });
        }
      }

      // 如果有工具调用，添加助手消息和工具结果，继续循环
      if (toolResults.length > 0) {
        messages.push({
          role: 'assistant',
          content: response.content
        });
        messages.push({
          role: 'user',
          content: toolResults.map(r => ({
            type: 'tool_result' as const,
            tool_use_id: r.tool_use_id,
            content: r.content
          }))
        });
      }

      // 检查是否需要继续循环
      if (response.stop_reason === 'end_turn' || toolResults.length === 0) {
        continueLoop = false;
      }
    }

    const agentResponse: AgentResponse = {
      reply: finalReply || "已处理您的请求。",
      operations: allOperations,
      toolCalls: allToolCalls
    };

    emit({ type: 'done', response: agentResponse });

    return agentResponse;

  } catch (error) {
    console.error("Agent Error:", error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    emit({ type: 'error', error: errorMsg });

    return {
      reply: "抱歉，我在处理您的请求时遇到了问题。请尝试减少思维导图的大小或重试。",
      operations: [],
      toolCalls: []
    };
  }
};

// 保留旧的 API 名称作为别名
export const chatWithAgent = chatWithAgentStream;
