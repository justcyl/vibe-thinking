import express from 'express';
import cors from 'cors';
import { config as dotenvConfig } from 'dotenv';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { mindMapMcpServer, getOperations, clearOperations } from './mindMapMcp.js';
import { randomBytes } from 'crypto';

// 从 .env 文件加载环境变量
console.log('📄 Loading environment variables from .env file...');
dotenvConfig();

const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;

// 验证必需的环境变量
if (!ANTHROPIC_AUTH_TOKEN || ANTHROPIC_AUTH_TOKEN === 'your_api_key_here') {
  console.error('❌ Error: ANTHROPIC_AUTH_TOKEN is not configured in .env file');
  console.error('');
  console.error('Please edit .env file and set:');
  console.error('  ANTHROPIC_AUTH_TOKEN=your_api_key');
  console.error('  ANTHROPIC_BASE_URL=http://your-api-endpoint (optional)');
  console.error('');
  process.exit(1);
}

// 显示配置信息
console.log('✅ ANTHROPIC_AUTH_TOKEN loaded');
if (ANTHROPIC_BASE_URL) {
  console.log(`✅ Using custom endpoint: ${ANTHROPIC_BASE_URL}`);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// System prompt for the agent
const SYSTEM_PROMPT = `You are a PROACTIVE Mind Map Assistant (思维助理). You actively help users build mind maps by using tools when appropriate.

You have access to the current state of the mind map (Nodes with IDs, Types, Content).

Your Available Tools:
1. add_node: Add a new child node to an existing node. Use "type" rules (Topic -> Problem -> Hypothesis -> Action -> Evidence).
2. update_node: Update the content of an existing node.
3. delete_node: Delete an existing node and all its descendants.

Guidelines:
- Proactively use tools to help users - don't wait for explicit permission.
- If just chatting or answering questions, don't use any tools.
- Refer to nodes by their exact IDs provided in the context.
- CRITICAL: DO NOT repeat or echo the input mind map data in your response.
- You can call multiple tools in sequence if needed.
- Always respond in Simplified Chinese.`;

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stream agent response using SSE
app.post('/api/agent/chat', async (req, res) => {
  const { message, currentMapData, modelId, sessionId: clientSessionId } = req.body;

  if (!message || !currentMapData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Generate session ID
  const sessionId = clientSessionId || randomBytes(16).toString('hex');

  // Clear previous operations for this session
  clearOperations(sessionId);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Helper to send SSE events
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Build prompt with context
    const userPrompt = `Current Mind Map State (Flat List):
${JSON.stringify(currentMapData, null, 2)}

User Message:
"${message}"

Remember to pass session_id: "${sessionId}" in all tool calls.`;

    // Use Agent SDK query
    // 注意：Agent SDK 可能通过环境变量读取 baseURL，不需要显式传递
    const queryStream = query({
      prompt: userPrompt,
      options: {
        model: modelId || 'claude-sonnet-4-20250514',
        systemPrompt: SYSTEM_PROMPT,
        // 移除显式的 apiKey 和 baseURL，让 Agent SDK 从环境变量读取
        // apiKey: ANTHROPIC_API_KEY,
        // ...(ANTHROPIC_API_BASE && { baseURL: ANTHROPIC_API_BASE }),
        mcpServers: {
          mindmap: mindMapMcpServer
        },
        permissionMode: 'bypassPermissions', // 自动执行工具
        maxTurns: 10, // 限制最大工具调用轮数
      }
    });

    let textBuffer = '';
    let toolCallsBuffer: any[] = [];

    // Stream messages
    for await (const message of queryStream) {
      if (message.type === 'assistant') {
        // Assistant 消息（包含完整响应）
        const content = (message as any).text || (message as any).content || '';
        if (content) {
          textBuffer += content;
          sendEvent('text_delta', { text: content });
        }
      } else if (message.type === 'stream_event') {
        // 流式事件
        const eventData = message as any;
        if (eventData.content) {
          textBuffer += eventData.content;
          sendEvent('text_delta', { text: eventData.content });
        }
      } else if (message.type === 'result') {
        // 最终结果
        const operations = getOperations(sessionId);
        const resultMsg = message as any;

        sendEvent('done', {
          reply: resultMsg.result || textBuffer || '已处理您的请求。',
          operations,
          toolCalls: toolCallsBuffer,
          usage: resultMsg.usage,
          cost: resultMsg.total_cost_usd || 0
        });

        // 清理操作存储
        clearOperations(sessionId);
      }
    }

    res.end();

  } catch (error: any) {
    console.error('Agent Error:', error);
    sendEvent('error', {
      message: error.message || 'Unknown error occurred',
      details: error.toString()
    });
    res.end();
  }
});

// Brainstorm endpoint (可选保留，或改用 agent)
app.post('/api/brainstorm', async (req, res) => {
  const { parentContent, parentType, contextTrace, modelId } = req.body;

  if (!parentContent || !parentType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sessionId = randomBytes(16).toString('hex');
    clearOperations(sessionId);

    const systemPrompt = `You are a rigorous logical thinking assistant using a specific 5-stage thought framework.
All output must be in Simplified Chinese.

Strict Node Definitions & Rules:
1. TOPIC (主题) - Definition: The context/boundary. The container of thought. Syntax: Declarative.
2. PROBLEM (难题/挑战) - Current Blockers or Future Risks. Question (How/Why) OR Negative Declaration.
3. HYPOTHESIS (假说/设想) - Subjective prediction/answer to PROBLEM. Declarative.
4. ACTION (行动/实验) - Concrete step to verify HYPOTHESIS. Imperative (Verb-Object).
5. EVIDENCE (事实/证据) - Objective result/data from ACTION. Declarative (Fact).

Goal: Generate 3-4 logical child nodes based on the Parent Node.

Logical Flow Rules:
- If Parent is TOPIC -> Suggest PROBLEMS
- If Parent is PROBLEM -> Suggest HYPOTHESES
- If Parent is HYPOTHESIS -> Suggest ACTIONS
- If Parent is ACTION -> Suggest potential EVIDENCE
- If Parent is EVIDENCE -> Suggest derived PROBLEM or Refined HYPOTHESIS

Use add_node tool to create each child node.`;

    const userPrompt = `Context Path: ${contextTrace?.join(' -> ') || ''}
Parent Node Type: ${parentType}
Parent Node Content: "${parentContent}"

Generate 3-4 next logical steps. Use add_node tool with session_id: "${sessionId}".`;

    const queryStream = query({
      prompt: userPrompt,
      options: {
        model: modelId || 'claude-sonnet-4-20250514',
        systemPrompt,
        // 移除显式的 apiKey 和 baseURL，让 Agent SDK 从环境变量读取
        // apiKey: ANTHROPIC_API_KEY,
        // ...(ANTHROPIC_API_BASE && { baseURL: ANTHROPIC_API_BASE }),
        mcpServers: { mindmap: mindMapMcpServer },
        permissionMode: 'bypassPermissions',
        maxTurns: 5
      }
    });

    for await (const message of queryStream) {
      if (message.type === 'result') {
        const operations = getOperations(sessionId);
        const nodes = operations
          .filter(op => op.action === 'ADD_CHILD')
          .map(op => ({
            type: op.nodeType!,
            content: op.content!
          }));

        clearOperations(sessionId);
        return res.json({ nodes });
      }
    }

    res.json({ nodes: [] });

  } catch (error: any) {
    console.error('Brainstorm Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Agent server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
