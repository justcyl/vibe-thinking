import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentMessage, AgentOperation, MindMapNode, MindMapProject, NodeType, ModelId, Conversation } from '@/types';
import { chatWithAgent } from '@/services/claudeService';
import { addNode, deleteNode, generateNodeId, serializeForestForAgent, updateNode } from '@/utils/layout';
import { DEFAULT_MODEL_ID } from '@/constants';

interface UseAgentInterfaceOptions {
  data: MindMapProject;
  pushState: (project: MindMapProject) => void;
  getGlobalNodeIds: () => Set<string>;
  currentCanvasId: string;
  currentCanvasName: string;
}

interface AgentInterface {
  isAgentOpen: boolean;
  toggleAgent: () => void;
  closeAgent: () => void;
  agentPanelWidth: number;
  startResizing: () => void;
  // 当前对话
  currentConversation: Conversation | null;
  messages: AgentMessage[];
  isAgentProcessing: boolean;
  sendMessage: (text: string) => Promise<void>;
  availableNodes: { id: string; parentId: string | null; type: NodeType; content: string }[];
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  // 对话管理
  conversations: Conversation[];
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
}

const applyOperation = (
  project: MindMapProject,
  operation: AgentOperation,
  usedIds?: Set<string>
): { next: MindMapProject; changed: boolean } => {
  if (operation.action === 'ADD_CHILD' && operation.parentId && operation.nodeType && operation.content) {
    const newChild: MindMapNode = {
      id: generateNodeId(usedIds),
      type: operation.nodeType,
      content: operation.content,
      children: [],
      parentId: operation.parentId,
    };
    return { next: addNode(project, newChild), changed: true };
  }
  if (operation.action === 'UPDATE_CONTENT' && operation.nodeId && operation.content) {
    return {
      next: updateNode(project, operation.nodeId, () => ({ content: operation.content! })),
      changed: true,
    };
  }
  if (operation.action === 'DELETE_NODE' && operation.nodeId) {
    return {
      next: deleteNode(project, operation.nodeId),
      changed: true,
    };
  }
  return { next: project, changed: false };
};

const STORAGE_KEY = 'vibe-thinking-conversations';

/**
 * Agent 交互 Hook
 * - 支持多对话历史管理
 * - 每个对话绑定一个画布作为上下文
 * - 画布内容实时更新到上下文
 * - 对话历史持久化到 localStorage
 */
export const useAgentInterface = ({
  data,
  pushState,
  getGlobalNodeIds,
  currentCanvasId,
  currentCanvasName
}: UseAgentInterfaceOptions): AgentInterface => {
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [agentPanelWidth, setAgentPanelWidth] = useState(350);
  const [isResizingAgent, setIsResizingAgent] = useState(false);
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL_ID as ModelId);

  // 对话管理 - 从 localStorage 初始化
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load conversations from localStorage:', e);
    }
    return [];
  });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 保存对话到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save conversations to localStorage:', e);
    }
  }, [conversations]);

  // 获取当前对话
  const currentConversation = useMemo(() =>
    conversations.find(c => c.id === currentConversationId) || null,
    [conversations, currentConversationId]
  );

  // 当前对话的消息
  const messages = currentConversation?.messages || [];

  // 当前对话绑定的画布数据（实时更新）
  // 如果当前对话绑定的画布就是当前画布，使用实时数据
  const contextData = useMemo(() => {
    if (!currentConversation) return data;
    // 当前对话绑定的画布 ID 与当前画布相同时，使用实时数据
    if (currentConversation.canvasId === currentCanvasId) {
      return data;
    }
    // 否则返回当前画布数据（因为我们无法访问其他画布的实时数据）
    return data;
  }, [currentConversation, currentCanvasId, data]);

  const availableNodes = useMemo(() => serializeForestForAgent(contextData), [contextData]);

  useEffect(() => {
    if (!isResizingAgent) return;

    const handleMouseMove = (event: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(event.clientX, 600));
      setAgentPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingAgent(false);
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAgent]);

  const toggleAgent = useCallback(() => setIsAgentOpen((prev) => !prev), []);
  const closeAgent = useCallback(() => setIsAgentOpen(false), []);

  const startResizing = useCallback(() => {
    setIsResizingAgent(true);
  }, []);

  // 新建对话 - 只清空当前对话ID，实际对话在发送第一条消息时创建
  const newConversation = useCallback(() => {
    setCurrentConversationId(null);
    setShowHistory(false);
  }, []);

  // 选择对话
  const selectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setShowHistory(false);
  }, []);

  // 删除对话
  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
  }, [currentConversationId]);

  // 更新对话消息的辅助函数
  const updateConversationMessages = useCallback((convId: string, updater: (messages: AgentMessage[]) => AgentMessage[]) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === convId) {
        return {
          ...conv,
          messages: updater(conv.messages),
          updatedAt: Date.now(),
          // 如果是第一条用户消息，更新标题
          title: conv.messages.length === 0 ? updater(conv.messages)[0]?.content.slice(0, 20) || conv.title : conv.title,
        };
      }
      return conv;
    }));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // 如果没有当前对话，先创建一个
      let convId = currentConversationId;
      if (!convId) {
        const now = Date.now();
        const newConv: Conversation = {
          id: generateNodeId(),
          title: text.slice(0, 20),
          messages: [],
          canvasId: currentCanvasId,
          canvasName: currentCanvasName,
          createdAt: now,
          updatedAt: now,
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
        convId = newConv.id;
      }

      const userMessage: AgentMessage = {
        id: generateNodeId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      updateConversationMessages(convId, (msgs) => [...msgs, userMessage]);
      setIsAgentProcessing(true);

      try {
        const response = await chatWithAgent(text, availableNodes, selectedModel);
        if (response.operations && response.operations.length > 0) {
          let nextProject = data;
          let changed = false;
          const usedIds = getGlobalNodeIds();
          response.operations.forEach((operation) => {
            const result = applyOperation(nextProject, operation, usedIds);
            nextProject = result.next;
            changed = changed || result.changed;
          });
          if (changed) pushState(nextProject);
        }

        const assistantMessage: AgentMessage = {
          id: generateNodeId(),
          role: 'assistant',
          content: response.reply,
          timestamp: Date.now(),
        };
        updateConversationMessages(convId, (msgs) => [...msgs, assistantMessage]);
      } catch (error) {
        const errorMessage: AgentMessage = {
          id: generateNodeId(),
          role: 'assistant',
          content: 'Error processing request.',
          timestamp: Date.now(),
        };
        updateConversationMessages(convId, (msgs) => [...msgs, errorMessage]);
      } finally {
        setIsAgentProcessing(false);
      }
    },
    [availableNodes, data, pushState, getGlobalNodeIds, selectedModel, currentConversationId, currentCanvasId, currentCanvasName, updateConversationMessages]
  );

  return {
    isAgentOpen,
    toggleAgent,
    closeAgent,
    agentPanelWidth,
    startResizing,
    currentConversation,
    messages,
    isAgentProcessing,
    sendMessage,
    availableNodes,
    selectedModel,
    setSelectedModel,
    conversations,
    newConversation,
    selectConversation,
    deleteConversation,
    showHistory,
    setShowHistory,
  };
};
