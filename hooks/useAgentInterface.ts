import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentMessage, AgentOperation, MindMapNode, MindMapProject, NodeType } from '@/types';
import { chatWithAgent } from '@/services/geminiService';
import { addNode, deleteNode, generateNodeId, serializeForestForAgent, updateNode } from '@/utils/layout';

interface UseAgentInterfaceOptions {
  data: MindMapProject;
  pushState: (project: MindMapProject) => void;
  getGlobalNodeIds: () => Set<string>;
}

interface AgentInterface {
  isAgentOpen: boolean;
  toggleAgent: () => void;
  closeAgent: () => void;
  agentPanelWidth: number;
  startResizing: () => void;
  messages: AgentMessage[];
  isAgentProcessing: boolean;
  sendMessage: (text: string) => Promise<void>;
  availableNodes: { id: string; parentId: string | null; type: NodeType; content: string }[];
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

/**
 * 将 Agent 交互、拖拽宽度等状态集中在一个 Hook 中，方便团队独立维护 Agent 功能。
 */
export const useAgentInterface = ({ data, pushState, getGlobalNodeIds }: UseAgentInterfaceOptions): AgentInterface => {
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [agentPanelWidth, setAgentPanelWidth] = useState(350);
  const [isResizingAgent, setIsResizingAgent] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);

  const availableNodes = useMemo(() => serializeForestForAgent(data), [data]);

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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const userMessage: AgentMessage = {
        id: generateNodeId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsAgentProcessing(true);
      try {
        const response = await chatWithAgent(text, availableNodes);
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
        setMessages((prev) => [
          ...prev,
          {
            id: generateNodeId(),
            role: 'assistant',
            content: response.reply,
            timestamp: Date.now(),
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateNodeId(),
            role: 'assistant',
            content: 'Error processing request.',
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsAgentProcessing(false);
      }
    },
    [availableNodes, data, pushState, getGlobalNodeIds]
  );

  return {
    isAgentOpen,
    toggleAgent,
    closeAgent,
    agentPanelWidth,
    startResizing,
    messages,
    isAgentProcessing,
    sendMessage,
    availableNodes,
  };
};
