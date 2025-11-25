import { useCallback, useMemo, useRef, useState } from 'react';
import { Canvas, MindMapProject, NodeType } from '@/types';
import { LABELS } from '@/constants';
import { generateNodeId } from '@/utils/layout';

interface UseCanvasManagerOptions {
  initialData: MindMapProject;
  labels?: typeof LABELS;
}

interface CanvasManager {
  canvases: Canvas[];
  currentCanvasId: string;
  currentCanvas?: Canvas;
  isSidebarOpen: boolean;
  editSource: 'sidebar' | 'header' | null;
  editingCanvasId: string | null;
  tempCanvasName: string;
  getCurrentCanvasId: () => string;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  selectCanvas: (id: string) => MindMapProject | null;
  createCanvas: () => MindMapProject;
  deleteCanvas: (id: string) => MindMapProject | null;
  startRename: (canvasId: string, source: 'sidebar' | 'header') => void;
  saveRename: (canvasId: string, nextName?: string) => void;
  cancelRename: () => void;
  setTempCanvasName: (value: string) => void;
  updateCanvasData: (canvasId: string, project: MindMapProject) => void;
}

/**
 * 统一管理画布列表、切换与重命名，以便画布相关开发可以独立进行。
 */
export const useCanvasManager = ({ initialData, labels = LABELS }: UseCanvasManagerOptions): CanvasManager => {
  const initialCanvas: Canvas = useMemo(
    () => ({
      id: 'default-canvas',
      name: labels.untitledCanvas,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: initialData,
    }),
    [initialData, labels.untitledCanvas]
  );

  const [canvases, setCanvases] = useState<Canvas[]>([initialCanvas]);
  const [currentCanvasId, setCurrentCanvasId] = useState(initialCanvas.id);
  const currentCanvasIdRef = useRef(initialCanvas.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editSource, setEditSource] = useState<'sidebar' | 'header' | null>(null);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [tempCanvasName, setTempCanvasName] = useState('');

  const currentCanvas = useMemo(() => canvases.find((canvas) => canvas.id === currentCanvasId), [canvases, currentCanvasId]);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  const selectCanvas = useCallback(
    (id: string) => {
      const target = canvases.find((canvas) => canvas.id === id);
      if (!target) return null;
      setEditingCanvasId(null);
      setEditSource(null);
      if (target.id === currentCanvasId) {
        return null;
      }
      currentCanvasIdRef.current = target.id;
      setCurrentCanvasId(target.id);
      return target.data;
    },
    [canvases, currentCanvasId]
  );

  const getGlobalNodeIds = useCallback(() => {
    const ids = new Set<string>();
    canvases.forEach((canvas) => {
      Object.keys(canvas.data.nodes).forEach((nodeId) => ids.add(nodeId));
    });
    return ids;
  }, [canvases]);

  const createCanvas = useCallback(() => {
    const rootId = generateNodeId(getGlobalNodeIds());
    const data: MindMapProject = {
      nodes: {
        [rootId]: {
          id: rootId,
          type: NodeType.TOPIC,
          content: labels.newIdea,
          children: [],
          parentId: null,
          x: 0,
          y: 0,
        },
      },
      rootIds: [rootId],
    };
    const canvas: Canvas = {
      id: `canvas_${Date.now()}`,
      name: `${labels.untitledCanvas} ${canvases.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data,
    };
    setCanvases((prev) => [...prev, canvas]);
    currentCanvasIdRef.current = canvas.id;
    setCurrentCanvasId(canvas.id);
    setEditingCanvasId(null);
    setEditSource(null);
    return data;
  }, [canvases.length, labels.newIdea, labels.untitledCanvas, getGlobalNodeIds]);

  const deleteCanvas = useCallback(
    (id: string) => {
      if (canvases.length <= 1) return null;
      const filtered = canvases.filter((canvas) => canvas.id !== id);
      if (!filtered.length) return null;
      if (id === currentCanvasId) {
        const fallback = filtered[0];
        setCanvases(filtered);
        currentCanvasIdRef.current = fallback.id;
        setCurrentCanvasId(fallback.id);
        setEditingCanvasId(null);
        setEditSource(null);
        return fallback.data;
      }
      setCanvases(filtered);
      return null;
    },
    [canvases, currentCanvasId]
  );

  const startRename = useCallback(
    (canvasId: string, source: 'sidebar' | 'header') => {
      const target = canvases.find((canvas) => canvas.id === canvasId);
      if (!target) return;
      setEditingCanvasId(canvasId);
      setEditSource(source);
      setTempCanvasName(target.name);
    },
    [canvases]
  );

  const saveRename = useCallback(
    (canvasId: string, nextName?: string) => {
      const trimmed = (nextName ?? tempCanvasName).trim();
      setCanvases((prev) =>
        prev.map((canvas) =>
          canvas.id === canvasId
            ? {
                ...canvas,
                name: trimmed || canvas.name,
                updatedAt: Date.now(),
              }
            : canvas
        )
      );
      setEditingCanvasId(null);
      setEditSource(null);
      setTempCanvasName('');
    },
    [tempCanvasName]
  );

  const cancelRename = useCallback(() => {
    setEditingCanvasId(null);
    setEditSource(null);
    setTempCanvasName('');
  }, []);

  const updateCanvasData = useCallback((canvasId: string, project: MindMapProject) => {
    setCanvases((prev) =>
      prev.map((canvas) =>
        canvas.id === canvasId
          ? {
              ...canvas,
              data: project,
              updatedAt: Date.now(),
            }
          : canvas
      )
    );
  }, []);

  return {
    canvases,
    currentCanvasId,
    currentCanvas,
    isSidebarOpen,
    editSource,
    editingCanvasId,
    tempCanvasName,
    getCurrentCanvasId: () => currentCanvasIdRef.current,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    selectCanvas,
    createCanvas,
    deleteCanvas,
    startRename,
    saveRename,
    cancelRename,
    setTempCanvasName,
    updateCanvasData,
  };
};
