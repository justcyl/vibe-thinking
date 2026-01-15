import express from 'express';
import cors from 'cors';
import { config as dotenvConfig } from 'dotenv';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { mindMapMcpServer, getOperations, clearOperations } from './mindMapMcp.js';
import { getStorageState, updateStorageState } from './storage.js';
import { randomBytes } from 'crypto';

// 从 .env 文件加载环境变量
console.log('📄 Loading environment variables from .env file...');
dotenvConfig();

const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;

const hasAnthropicToken = Boolean(ANTHROPIC_AUTH_TOKEN && ANTHROPIC_AUTH_TOKEN !== 'your_api_key_here');

if (hasAnthropicToken) {
  console.log('✅ ANTHROPIC_AUTH_TOKEN loaded');
  if (ANTHROPIC_BASE_URL) {
    console.log(`✅ Using custom endpoint: ${ANTHROPIC_BASE_URL}`);
  }
} else {
  console.warn('⚠️  ANTHROPIC_AUTH_TOKEN 未配置，仅可使用本地存储接口');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));


// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/storage/canvases', async (_req, res) => {
  try {
    const state = await getStorageState();
    res.json({ canvases: state.canvases });
  } catch (error: any) {
    console.error('Failed to load canvases', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/storage/canvases', async (req, res) => {
  const { canvases } = req.body;
  if (!Array.isArray(canvases)) {
    return res.status(400).json({ error: 'Invalid canvases payload' });
  }
  try {
    const state = await updateStorageState({ canvases });
    res.json({ canvases: state.canvases });
  } catch (error: any) {
    console.error('Failed to save canvases', error);
    res.status(500).json({ error: error.message });
  }
});

// Brainstorm endpoint
app.post('/api/brainstorm', async (req, res) => {
  const { parentContent, parentType, contextTrace, modelId } = req.body;

  if (!parentContent || !parentType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!hasAnthropicToken) {
    return res.status(503).json({ error: 'ANTHROPIC_AUTH_TOKEN is not configured' });
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
