import { useCallback, useMemo, useState } from 'react';
import { MindMapProject } from '@/types';

interface UseHistoryManagerOptions {
  initialData: MindMapProject;
  onChange?: (project: MindMapProject) => void;
}

interface HistoryManager {
  data: MindMapProject;
  pushState: (project: MindMapProject) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historyLength: number;
  load: (project: MindMapProject) => void;
  updateCurrent: (updater: (project: MindMapProject) => MindMapProject) => void;
}

/**
 * 管理思维导图数据的历史栈，保证各个功能模块在统一接口下操作数据。
 */
export const useHistoryManager = ({ initialData, onChange }: UseHistoryManagerOptions): HistoryManager => {
  const [history, setHistory] = useState<MindMapProject[]>([initialData]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const current = useMemo(() => history[historyIndex] ?? initialData, [history, historyIndex, initialData]);

  const sync = useCallback(
    (next: MindMapProject) => {
      onChange?.(next);
    },
    [onChange]
  );

  const pushState = useCallback(
    (project: MindMapProject) => {
      setHistory((prev) => {
        const preserved = prev.slice(0, historyIndex + 1);
        return [...preserved, project];
      });
      setHistoryIndex((prev) => prev + 1);
      sync(project);
    },
    [historyIndex, sync]
  );

  const undo = useCallback(() => {
    setHistoryIndex((prev) => {
      if (prev === 0) return prev;
      const nextIndex = prev - 1;
      sync(history[nextIndex]);
      return nextIndex;
    });
  }, [history, sync]);

  const redo = useCallback(() => {
    setHistoryIndex((prev) => {
      if (prev >= history.length - 1) return prev;
      const nextIndex = prev + 1;
      sync(history[nextIndex]);
      return nextIndex;
    });
  }, [history, sync]);

  const load = useCallback(
    (project: MindMapProject) => {
      setHistory([project]);
      setHistoryIndex(0);
      sync(project);
    },
    [sync]
  );

  const updateCurrent = useCallback(
    (updater: (project: MindMapProject) => MindMapProject) => {
      setHistory((prev) => {
        const clone = [...prev];
        const target = clone[historyIndex] ?? prev[prev.length - 1];
        const updated = updater(target);
        clone[historyIndex] = updated;
        sync(updated);
        return clone;
      });
    },
    [historyIndex, sync]
  );

  return {
    data: current,
    pushState,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    historyLength: history.length,
    load,
    updateCurrent,
  };
};
