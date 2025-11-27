import Anthropic from '@anthropic-ai/sdk';
import { NodeType, AgentResponse } from '../types';

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

const agentResponseTool: Anthropic.Tool = {
  name: 'respond_with_operations',
  description: 'Respond to the user and optionally perform operations on the mind map',
  input_schema: {
    type: 'object' as const,
    properties: {
      reply: {
        type: 'string',
        description: 'Conversational response to the user (in Simplified Chinese)'
      },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['ADD_CHILD', 'UPDATE_CONTENT', 'DELETE_NODE'],
              description: 'The type of operation'
            },
            parentId: {
              type: 'string',
              description: 'Parent node ID (for ADD_CHILD)'
            },
            nodeId: {
              type: 'string',
              description: 'Target node ID (for UPDATE_CONTENT, DELETE_NODE)'
            },
            nodeType: {
              type: 'string',
              enum: ['topic', 'problem', 'hypothesis', 'action', 'evidence'],
              description: 'Type of the new node (for ADD_CHILD)'
            },
            content: {
              type: 'string',
              description: 'Content for the node (for ADD_CHILD, UPDATE_CONTENT)'
            }
          },
          required: ['action']
        },
        description: 'Array of operations to perform on the mind map'
      }
    },
    required: ['reply', 'operations']
  }
};

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

const systemPromptAgent = `You are a Mind Map Assistant (思维助理). You can converse with the user and also MODIFY the mind map directly.

You have access to the current state of the mind map (Nodes with IDs, Types, Content).

Your Capabilities:
1. Answer questions based on the mind map context.
2. Suggest improvements.
3. Execute operations to ADD, UPDATE, or DELETE nodes.

Operations Types:
1. ADD_CHILD: Add a new child node to a parent. Use "type" rules (Topic -> Problem -> Hypothesis -> Action -> Evidence).
2. UPDATE_CONTENT: Update the content of an existing node.
3. DELETE_NODE: Delete an existing node.

Constraint:
- Only perform operations if the user explicitly asks for changes or if it adds significant value.
- If just chatting, return empty operations array.
- Refer to nodes by their exact IDs provided in the context.
- CRITICAL: DO NOT repeat or echo the input mind map data in your response.

You MUST use the respond_with_operations tool to output your response.`;

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

// --- Agent Interaction ---

export const chatWithAgent = async (
  userMessage: string,
  currentMapData: any[],
  modelId?: string
): Promise<AgentResponse> => {
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  const userPrompt = `Current Mind Map State (Flat List):
${JSON.stringify(currentMapData, null, 2)}

User Message:
"${userMessage}"`;

  try {
    const response = await client.messages.create({
      model: modelId || defaultModelName,
      max_tokens: 2048,
      system: systemPromptAgent,
      tools: [agentResponseTool],
      tool_choice: { type: 'tool', name: 'respond_with_operations' },
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    // Extract tool use result
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUseBlock || toolUseBlock.name !== 'respond_with_operations') {
      return {
        reply: "抱歉，我在处理您的请求时遇到了问题。请重试。",
        operations: []
      };
    }

    const input = toolUseBlock.input as AgentResponse;

    return {
      reply: input.reply || "已处理您的请求。",
      operations: input.operations || []
    };

  } catch (error) {
    console.error("Agent Error:", error);
    return {
      reply: "抱歉，我在处理您的请求时遇到了问题。请尝试减少思维导图的大小或重试。",
      operations: []
    };
  }
};
