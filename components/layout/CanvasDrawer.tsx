import React from 'react';
import { Canvas, ViewSettings } from '@/types';
import { LABELS } from '@/constants';
import { Edit2, FileText, Plus, Trash2, X } from 'lucide-react';

interface CanvasDrawerProps {
  canvases: Canvas[];
  currentCanvasId: string;
  viewSettings: ViewSettings;
  isOpen: boolean;
  labels?: typeof LABELS;
  editSource: 'sidebar' | 'header' | null;
  editingCanvasId: string | null;
  tempCanvasName: string;
  onTempCanvasNameChange: (value: string) => void;
  onSelectCanvas: (id: string) => void;
  onCreateCanvas: () => void;
  onDeleteCanvas: (id: string) => void;
  onStartRename: (id: string, source: 'sidebar' | 'header') => void;
  onSaveRename: (id: string, nextName?: string) => void;
  onClose: () => void;
}

/**
 * 左侧画布抽屉，独立管理多画布列表操作，降低 App.tsx 中 UI 与状态的耦合。
 */
export const CanvasDrawer: React.FC<CanvasDrawerProps> = ({
  canvases,
  currentCanvasId,
  viewSettings,
  isOpen,
  labels = LABELS,
  editSource,
  editingCanvasId,
  tempCanvasName,
  onTempCanvasNameChange,
  onSelectCanvas,
  onCreateCanvas,
  onDeleteCanvas,
  onStartRename,
  onSaveRename,
  onClose,
}) => {
  const sidebarBg = viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800' : 'bg-neutral-50 border-neutral-200';

  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 z-[100] w-64 transform transition-transform duration-300 ease-in-out border-r shadow-2xl flex flex-col ${
          sidebarBg
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`h-14 flex items-center justify-between px-4 border-b ${
            viewSettings.theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'
          }`}
        >
          <h2 className="text-xs font-bold uppercase tracking-wider opacity-70">{labels.myCanvases}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              onClick={() => onSelectCanvas(canvas.id)}
              className={`flex items-center justify-between p-2 cursor-pointer rounded transition-colors ${
                currentCanvasId === canvas.id
                  ? viewSettings.theme === 'dark'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-white border border-neutral-200'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={14} />
                {editingCanvasId === canvas.id && editSource === 'sidebar' ? (
                  <input
                    autoFocus
                    value={tempCanvasName}
                    onChange={(event) => onTempCanvasNameChange(event.target.value)}
                    onBlur={(event) => onSaveRename(canvas.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onSaveRename(canvas.id, (event.target as HTMLInputElement).value);
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={(event) => event.currentTarget.select()}
                    className="bg-transparent border-b outline-none text-xs w-full"
                  />
                ) : (
                  <span className="text-xs truncate select-none">{canvas.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartRename(canvas.id, 'sidebar');
                  }}
                  className="p-1 hover:text-blue-500"
                >
                  <Edit2 size={10} />
                </button>
                {canvases.length > 1 && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteCanvas(canvas.id);
                    }}
                    className="p-1 hover:text-red-500"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className={`p-4 border-t ${viewSettings.theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'}`}>
          <button
            onClick={onCreateCanvas}
            className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase border transition-colors ${
              viewSettings.theme === 'dark' ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-300 hover:bg-neutral-100'
            }`}
          >
            <Plus size={14} /> {labels.newCanvas}
          </button>
        </div>
      </div>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onClose} />}
    </>
  );
};
