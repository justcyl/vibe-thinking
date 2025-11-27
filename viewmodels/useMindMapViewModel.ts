import { useCallback, useEffect, useRef, useState } from 'react';
import { LABELS, INITIAL_DATA } from '@/constants';
import {
  MindMapNode,
  MindMapProject,
  NodeType,
  ViewSettings,
  Canvas,
  AgentMessage,
  Theme,
  Orientation,
} from '@/types';
import {
  addNode,
  deleteNode,
  updateNode,
  getPathToNode,
  updateRootPosition,
  reorderChildren,
  getParentId,
  reparentNode,
  generateNodeId,
  getContextJsonString,
  getFormattedGlobalContextString,
  serializeProjectForExport,
} from '@/utils/layout';
import { generateBrainstormIdeas } from '@/services/geminiService';
import { useCanvasManager } from '@/hooks/useCanvasManager';
import { useHistoryManager } from '@/hooks/useHistoryManager';
import { useAgentInterface } from '@/hooks/useAgentInterface';

export interface MindMapViewModel {
  t: typeof LABELS;
  data: MindMapProject;
  canvases: Canvas[];
  currentCanvasId: string;
  currentCanvas?: Canvas;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  viewSettings: ViewSettings;
  toggleSetting: <K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isExportOpen: boolean;
  setIsExportOpen: (open: boolean) => void;
  notification: string | null;
  isGenerating: boolean;
  handleAddChild: (parentId: string) => void;
  handleAddFloatingNode: () => void;
  handleAddSibling: (nodeId: string) => void;
  handleDelete: (nodeId: string) => void;
  handleUpdateContent: (nodeId: string, content: string) => void;
  handleTypeChange: (nodeId: string, newType: NodeType) => void;
  handleCycleType: (nodeId: string) => void;
  handleMoveRoot: (id: string, x: number, y: number) => void;
  handleReorderChildren: (parentId: string, orderedChildIds: string[]) => void;
  handleCommitReorder: () => void;
  handleReparentNode: (nodeId: string, newParentId: string | null) => void;
  handleCopyContext: (nodeId: string) => void;
  handleCopyGlobalContext: () => void;
  handleExportJson: () => void;
  handleGenerateAI: (nodeId: string) => Promise<void>;
  handleCreateCanvas: () => void;
  handleSwitchCanvas: (id: string) => void;
  handleDeleteCanvas: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
  editSource: 'sidebar' | 'header' | null;
  editingCanvasId: string | null;
  tempCanvasName: string;
  setTempCanvasName: (value: string) => void;
  startRename: (canvasId: string, source: 'sidebar' | 'header') => void;
  saveRename: (canvasId: string, name?: string) => void;
  getCurrentCanvasId: () => string;
  isAgentOpen: boolean;
  toggleAgent: () => void;
  closeAgent: () => void;
  agentPanelWidth: number;
  startResizing: () => void;
  agentMessages: AgentMessage[];
  isAgentProcessing: boolean;
  sendAgentMessage: ReturnType<typeof useAgentInterface>['sendMessage'];
  availableNodes: ReturnType<typeof useAgentInterface>['availableNodes'];
}

const getNextLogicalType = (parentType: NodeType): NodeType => {
  switch (parentType) {
    case NodeType.TOPIC:
      return NodeType.PROBLEM;
    case NodeType.PROBLEM:
      return NodeType.HYPOTHESIS;
    case NodeType.HYPOTHESIS:
      return NodeType.ACTION;
    case NodeType.ACTION:
      return NodeType.EVIDENCE;
    case NodeType.EVIDENCE:
      return NodeType.PROBLEM;
    default:
      return NodeType.PROBLEM;
  }
};

export const useMindMapViewModel = (): MindMapViewModel => {
  const t = LABELS;

  const {
    canvases,
    currentCanvasId,
    currentCanvas,
    isSidebarOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    editSource,
    editingCanvasId,
    tempCanvasName,
    setTempCanvasName,
    startRename,
    saveRename,
    getCurrentCanvasId,
    createCanvas,
    selectCanvas,
    deleteCanvas,
    updateCanvasData,
  } = useCanvasManager({ initialData: INITIAL_DATA, labels: LABELS });

  const {
    data,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    load: loadHistory,
    updateCurrent,
  } = useHistoryManager({
    initialData: INITIAL_DATA,
    onChange: (project) => updateCanvasData(getCurrentCanvasId(), project),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    theme: 'dark',
    orientation: 'vertical',
    nodeSize: 'medium',
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const getGlobalNodeIds = useCallback(() => {
    const ids = new Set<string>();
    canvases.forEach((canvas) => {
      Object.keys(canvas.data.nodes).forEach((id) => ids.add(id));
    });
    return ids;
  }, [canvases]);

  const {
    isAgentOpen,
    toggleAgent,
    closeAgent,
    agentPanelWidth,
    startResizing,
    messages: agentMessages,
    isAgentProcessing,
    sendMessage,
    availableNodes,
  } = useAgentInterface({ data, pushState, getGlobalNodeIds });

  const latestProjectRef = useRef<MindMapProject>(data);

  const handleAddChild = useCallback(
    (parentId: string) => {
      const parentNode = data.nodes[parentId];
      if (!parentNode) return;
      const nextType = getNextLogicalType(parentNode.type);
      const idRegistry = getGlobalNodeIds();
      const newChild: MindMapNode = {
        id: generateNodeId(idRegistry),
        type: nextType,
        content: t.newIdea,
        children: [],
        parentId,
      };
      const newData = addNode(data, newChild);
      pushState(newData);
      setTimeout(() => {
        setSelectedId(newChild.id);
        setEditingNodeId(newChild.id);
      }, 0);
    },
    [data, t.newIdea, pushState, getGlobalNodeIds]
  );

  const handleAddFloatingNode = useCallback(() => {
    const idRegistry = getGlobalNodeIds();
    const newNode: MindMapNode = {
      id: generateNodeId(idRegistry),
      type: NodeType.TOPIC,
      content: t.newIdea,
      children: [],
      parentId: null,
      x: 0,
      y: 0,
    };
    const newData = addNode(data, newNode);
    pushState(newData);
    setTimeout(() => {
      setSelectedId(newNode.id);
      setEditingNodeId(newNode.id);
    }, 0);
  }, [data, t.newIdea, pushState, getGlobalNodeIds]);

  const handleAddSibling = useCallback(
    (id: string) => {
      const parentId = getParentId(data, id);
      if (parentId) {
        handleAddChild(parentId);
      } else {
        handleAddFloatingNode();
      }
    },
    [data, handleAddChild, handleAddFloatingNode]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const newData = deleteNode(data, id);
      pushState(newData);
      setSelectedId(null);
    },
    [data, pushState]
  );

  const handleUpdateContent = useCallback(
    (id: string, content: string) => {
      const newData = updateNode(data, id, () => ({ content }));
      pushState(newData);
    },
    [data, pushState]
  );

  const handleTypeChange = useCallback(
    (id: string, newType: NodeType) => {
      const newData = updateNode(data, id, () => ({ type: newType }));
      pushState(newData);
    },
    [data, pushState]
  );

  const handleCycleType = useCallback(
    (id: string) => {
      const types = [NodeType.TOPIC, NodeType.PROBLEM, NodeType.HYPOTHESIS, NodeType.ACTION, NodeType.EVIDENCE];
      const node = data.nodes[id];
      if (!node) return;
      const currentIndex = types.indexOf(node.type);
      const nextIndex = (currentIndex + 1) % types.length;
      handleTypeChange(id, types[nextIndex]);
    },
    [data, handleTypeChange]
  );

  const handleMoveRoot = useCallback(
    (id: string, x: number, y: number) => {
      updateCurrent((project) => updateRootPosition(project, id, x, y));
    },
    [updateCurrent]
  );

  useEffect(() => {
    latestProjectRef.current = data;
  }, [data]);

  const handleReorderChildren = useCallback(
    (parentId: string, orderedChildIds: string[]) => {
      updateCurrent((project) => {
        const nextProject = reorderChildren(project, parentId, orderedChildIds);
        latestProjectRef.current = nextProject;
        return nextProject;
      });
    },
    [updateCurrent]
  );

  const handleCommitReorder = useCallback(() => {
    pushState(latestProjectRef.current);
  }, [pushState]);

  // Initialize history manager with current canvas data on mount
  useEffect(() => {
    if (currentCanvas?.data) {
      loadHistory(currentCanvas.data);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReparentNode = useCallback(
    (nodeId: string, newParentId: string | null) => {
      const nextProject = reparentNode(data, nodeId, newParentId);
      if (nextProject === data) return;
      pushState(nextProject);
    },
    [data, pushState]
  );

  const showNotification = useCallback((message: string, duration = 2000) => {
    setNotification(message);
    setTimeout(() => setNotification(null), duration);
  }, []);

  const handleCopyContext = useCallback(
    (id: string) => {
      const jsonStr = getContextJsonString(data, id);
      if (!jsonStr) return;
      navigator.clipboard.writeText(jsonStr).then(() => showNotification(t.contextCopied));
    },
    [data, t.contextCopied, showNotification]
  );

  const handleCopyGlobalContext = useCallback(() => {
    const text = getFormattedGlobalContextString(data);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => showNotification(t.globalCopied));
    setIsExportOpen(false);
  }, [data, t.globalCopied, showNotification, setIsExportOpen]);

  const handleExportJson = useCallback(() => {
    const serialized = JSON.stringify(serializeProjectForExport(data), null, 2);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(serialized);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `${canvases.find((c) => c.id === currentCanvasId)?.name || 'brainstorm'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setIsExportOpen(false);
  }, [data, canvases, currentCanvasId, setIsExportOpen]);

  const handleGenerateAI = useCallback(
    async (nodeId: string) => {
      const targetNode = data.nodes[nodeId];
      if (!targetNode) return;
      setIsGenerating(true);
      const contextTrace = getPathToNode(data, nodeId) || [];
      try {
        const suggestions = await generateBrainstormIdeas(targetNode.content, targetNode.type, contextTrace);
        if (!suggestions.length) {
          showNotification(t.noIdeas, 3000);
          return;
        }
        const idRegistry = getGlobalNodeIds();
        let currentProject = data;
        suggestions.forEach((suggestion) => {
          const newChild: MindMapNode = {
            id: generateNodeId(idRegistry),
            type: suggestion.type,
            content: suggestion.content,
            children: [],
            parentId: nodeId,
          };
          currentProject = addNode(currentProject, newChild);
        });
        pushState(currentProject);
      } catch {
        showNotification(t.failedConnect, 3000);
      } finally {
        setIsGenerating(false);
      }
    },
    [data, t.noIdeas, t.failedConnect, pushState, getGlobalNodeIds, showNotification]
  );

  const handleCreateCanvas = useCallback(() => {
    const nextData = createCanvas();
    loadHistory(nextData);
    setSelectedId(null);
    setEditingNodeId(null);
  }, [createCanvas, loadHistory]);

  const handleSwitchCanvas = useCallback(
    (id: string) => {
      const loaded = selectCanvas(id);
      if (!loaded) return;
      loadHistory(loaded);
      setSelectedId(null);
      setEditingNodeId(null);
    },
    [selectCanvas, loadHistory]
  );

  const handleDeleteCanvas = useCallback(
    (id: string) => {
      if (canvases.length <= 1 || !window.confirm(t.confirmDelete)) return;
      const loaded = deleteCanvas(id);
      if (loaded) {
        loadHistory(loaded);
        setSelectedId(null);
        setEditingNodeId(null);
      }
    },
    [canvases.length, deleteCanvas, loadHistory, t.confirmDelete]
  );

  const toggleSetting = useCallback(<K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => {
    setViewSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingNodeId || editingCanvasId) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (!selectedId) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        handleCycleType(selectedId);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.shiftKey ? handleAddSibling(selectedId) : handleAddChild(selectedId);
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedId,
    editingNodeId,
    editingCanvasId,
    handleAddChild,
    handleAddSibling,
    handleDelete,
    undo,
    redo,
    handleCycleType,
  ]);

  return {
    t,
    data,
    canvases,
    currentCanvasId,
    currentCanvas,
    selectedId,
    setSelectedId,
    editingNodeId,
    setEditingNodeId,
    viewSettings,
    toggleSetting,
    isSettingsOpen,
    setIsSettingsOpen,
    isExportOpen,
    setIsExportOpen,
    notification,
    isGenerating,
    handleAddChild,
    handleAddFloatingNode,
    handleAddSibling,
    handleDelete,
    handleUpdateContent,
    handleTypeChange,
    handleCycleType,
    handleMoveRoot,
    handleReorderChildren,
    handleCommitReorder,
    handleReparentNode,
    handleCopyContext,
    handleCopyGlobalContext,
    handleExportJson,
    handleGenerateAI,
    handleCreateCanvas,
    handleSwitchCanvas,
    handleDeleteCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    isSidebarOpen,
    editSource,
    editingCanvasId,
    tempCanvasName,
    setTempCanvasName,
    startRename,
    saveRename,
    isAgentOpen,
    toggleAgent,
    closeAgent,
    agentPanelWidth,
    startResizing,
    agentMessages,
    isAgentProcessing,
    sendAgentMessage: sendMessage,
    availableNodes,
  };
};
