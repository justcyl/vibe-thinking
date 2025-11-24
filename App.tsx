
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { AgentPanel } from './components/AgentPanel';
import { CanvasDrawer } from './components/layout/CanvasDrawer';
import { MindMapNode, NodeType, ViewSettings } from './types';
import { INITIAL_DATA, LABELS } from './constants';
import {
  addNode,
  deleteNode,
  updateNode,
  getPathToNode,
  updateRootPosition,
  getParentId,
  generateNodeId,
  getFormattedContextString,
  getFormattedGlobalContextString,
  getContextJsonString,
  getLayoutBounds,
  calculateTreeLayout,
  serializeProjectForExport,
} from './utils/layout';
import { generateBrainstormIdeas } from './services/geminiService';
import { useCanvasManager } from '@/hooks/useCanvasManager';
import { useHistoryManager } from '@/hooks/useHistoryManager';
import { useAgentInterface } from '@/hooks/useAgentInterface';
import {
  Sparkles,
  Download,
  Settings,
  Moon,
  Sun,
  ArrowDown,
  ArrowRight,
  Undo2,
  Redo2,
  Menu,
  Plus,
  Clipboard,
  Bot,
  Image as ImageIcon,
  FileJson,
} from 'lucide-react';
import { toPng } from 'html-to-image';

export default function App() {
  const t = LABELS;

  const {
    canvases,
    currentCanvasId,
    currentCanvas,
    isSidebarOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    editingCanvasId,
    tempCanvasName,
    setTempCanvasName,
    startRename,
    saveRename,
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
    historyIndex,
    load: loadHistory,
    updateCurrent,
  } = useHistoryManager({
    initialData: INITIAL_DATA,
    onChange: (project) => updateCanvasData(currentCanvasId, project),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    theme: 'dark',
    orientation: 'vertical',
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const exportRef = useRef<HTMLDivElement>(null);
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
    sendMessage: sendAgentMessage,
    availableNodes,
  } = useAgentInterface({ data, pushState, getGlobalNodeIds });
  
  const getNextLogicalType = (parentType: NodeType): NodeType => {
      switch (parentType) {
          case NodeType.TOPIC: return NodeType.PROBLEM;
          case NodeType.PROBLEM: return NodeType.HYPOTHESIS;
          case NodeType.HYPOTHESIS: return NodeType.ACTION;
          case NodeType.ACTION: return NodeType.EVIDENCE;
          case NodeType.EVIDENCE: return NodeType.PROBLEM;
          default: return NodeType.PROBLEM;
      }
  };

  const handleAddChild = useCallback((parentId: string) => {
    const parentNode = data.nodes[parentId];
    if (!parentNode) return;
    const nextType = getNextLogicalType(parentNode.type);
    const idRegistry = getGlobalNodeIds();
    const newChild: MindMapNode = {
      id: generateNodeId(idRegistry), type: nextType, content: t.newIdea, children: [], parentId: parentId
    };
    const newData = addNode(data, newChild);
    pushState(newData);
    setTimeout(() => { setSelectedId(newChild.id); setEditingNodeId(newChild.id); }, 0);
  }, [data, t, pushState, getGlobalNodeIds]);

  const handleAddFloatingNode = useCallback(() => {
    const idRegistry = getGlobalNodeIds();
    const newNode: MindMapNode = {
      id: generateNodeId(idRegistry), type: NodeType.TOPIC, content: t.newIdea, children: [], parentId: null, x: 0, y: 0,
    };
    const newData = addNode(data, newNode);
    pushState(newData);
    setTimeout(() => { setSelectedId(newNode.id); setEditingNodeId(newNode.id); }, 0);
  }, [data, t, pushState, getGlobalNodeIds]);

  const handleAddSibling = useCallback((id: string) => {
      const parentId = getParentId(data, id);
      if (parentId) handleAddChild(parentId);
      else handleAddFloatingNode();
  }, [data, handleAddChild, handleAddFloatingNode]);

  const handleDelete = useCallback((id: string) => {
    const newData = deleteNode(data, id);
    pushState(newData);
    setSelectedId(null);
  }, [data, pushState]);

  const handleUpdateContent = useCallback((id: string, content: string) => {
    const newData = updateNode(data, id, () => ({ content }));
    pushState(newData);
  }, [data, pushState]);

  const handleTypeChange = useCallback((id: string, newType: NodeType) => {
    const newData = updateNode(data, id, () => ({ type: newType }));
    pushState(newData);
  }, [data, pushState]);

  const handleCycleType = useCallback((id: string) => {
      const types = [NodeType.TOPIC, NodeType.PROBLEM, NodeType.HYPOTHESIS, NodeType.ACTION, NodeType.EVIDENCE];
      const node = data.nodes[id];
      if (node) {
          const currentIndex = types.indexOf(node.type);
          const nextIndex = (currentIndex + 1) % types.length;
          handleTypeChange(id, types[nextIndex]);
      }
  }, [data, handleTypeChange]);

  const handleMoveRoot = useCallback(
    (id: string, x: number, y: number) => {
      updateCurrent((project) => updateRootPosition(project, id, x, y));
    },
    [updateCurrent]
  );

  const handleCopyContext = useCallback((id: string) => {
      // Use JSON format
      const jsonStr = getContextJsonString(data, id);
      if (jsonStr) {
          navigator.clipboard.writeText(jsonStr).then(() => {
              setNotification(t.contextCopied);
              setTimeout(() => setNotification(null), 2000);
          });
      }
  }, [data, t]);

  const handleCopyGlobalContext = useCallback(() => {
      const text = getFormattedGlobalContextString(data);
      if (text) {
          navigator.clipboard.writeText(text).then(() => {
              setNotification(t.globalCopied);
              setTimeout(() => setNotification(null), 2000);
          });
      }
      setIsExportOpen(false);
  }, [data, t]);

  const handleExportJson = useCallback(() => {
     const serialized = JSON.stringify(serializeProjectForExport(data), null, 2);
     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(serialized);
     const downloadAnchorNode = document.createElement('a');
     downloadAnchorNode.setAttribute("href", dataStr);
     downloadAnchorNode.setAttribute("download", `${canvases.find(c => c.id === currentCanvasId)?.name || 'brainstorm'}.json`);
     document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
     setIsExportOpen(false);
  }, [data, canvases, currentCanvasId]);

  const handleExportImage = useCallback(() => {
      if (exportRef.current === null) return;
      
      const filter = (node: HTMLElement) => {
        // Exclude UI elements from screenshot
        return !node.classList?.contains('exclude-from-export');
      };

      // 1. Calculate Bounds of Content
      const { nodes } = calculateTreeLayout(data, viewSettings.orientation);
      const bounds = getLayoutBounds(nodes, 100); // 100px Padding

      toPng(exportRef.current, { 
          cacheBust: true, 
          backgroundColor: viewSettings.theme === 'dark' ? '#09090b' : '#ffffff',
          filter: filter,
          fontEmbedCSS: '', 
          width: bounds.width,
          height: bounds.height,
          style: {
             width: `${bounds.width}px`,
             height: `${bounds.height}px`,
             overflow: 'visible', 
             maxHeight: 'none',
             maxWidth: 'none'
          },
          onClone: (clonedDoc: any) => {
            const viewport = clonedDoc.getElementById('whiteboard-viewport');
            const grid = clonedDoc.getElementById('whiteboard-grid');
            if (viewport) {
                viewport.style.transform = `translate(${-bounds.x}px, ${-bounds.y}px) scale(1)`;
                viewport.style.transformOrigin = '0 0';
            }
            if (grid) {
                grid.style.width = '100%';
                grid.style.height = '100%';
                grid.style.backgroundPosition = `${-bounds.x}px ${-bounds.y}px`;
            }
          }
      } as any)
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${canvases.find(c => c.id === currentCanvasId)?.name || 'brainstorm'}.png`;
        link.href = dataUrl;
        link.click();
        setIsExportOpen(false);
      })
      .catch((err) => {
        console.error('Export failed', err);
        setNotification('导出图片失败');
        setTimeout(() => setNotification(null), 3000);
      });
  }, [exportRef, viewSettings.theme, canvases, currentCanvasId, data, viewSettings.orientation]);

  const handleGenerateAI = useCallback(async (nodeId: string) => {
    const targetNode = data.nodes[nodeId];
    if (!targetNode) return;
    setIsGenerating(true);
    const contextTrace = getPathToNode(data, nodeId) || [];
    try {
      const suggestions = await generateBrainstormIdeas(targetNode.content, targetNode.type, contextTrace);
      if (suggestions.length === 0) {
          setNotification(t.noIdeas);
          setTimeout(() => setNotification(null), 3000);
      }
      const idRegistry = getGlobalNodeIds();
      let currentProject = data;
      suggestions.forEach(suggestion => {
        const newChild: MindMapNode = {
           id: generateNodeId(idRegistry), type: suggestion.type, content: suggestion.content, children: [], parentId: nodeId
        };
        currentProject = addNode(currentProject, newChild);
      });
      pushState(currentProject);
    } catch (error) {
      setNotification(t.failedConnect);
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  }, [data, t, pushState, getGlobalNodeIds]);

  const handleCreateCanvas = useCallback(() => {
    const nextData = createCanvas();
    loadHistory(nextData);
    setSelectedId(null);
    setEditingNodeId(null);
  }, [createCanvas, loadHistory]);

  const handleSwitchCanvas = useCallback(
    (id: string) => {
      const loaded = selectCanvas(id);
      if (loaded) {
        loadHistory(loaded);
        setSelectedId(null);
        setEditingNodeId(null);
      }
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

  const toggleSetting = (key: keyof ViewSettings, value: any) => {
    setViewSettings(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (editingNodeId || editingCanvasId) return;
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
          if (selectedId) {
              if (e.key === 'Tab') { e.preventDefault(); handleCycleType(selectedId); }
              if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? handleAddSibling(selectedId) : handleAddChild(selectedId); }
              if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); handleDelete(selectedId); }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingNodeId, editingCanvasId, handleAddChild, handleAddSibling, handleDelete, undo, redo, handleCycleType]);

  // Floating Control Styles
  const topBtnClass = "w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg border";
  const topBtnDark = "bg-[#18181b] hover:bg-neutral-800 text-neutral-300 border-neutral-800";
  const topBtnLight = "bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200";
  const topBtnStyle = viewSettings.theme === 'dark' ? topBtnDark : topBtnLight;

  return (
    <div className={`w-full h-screen flex overflow-hidden relative ${viewSettings.theme === 'dark' ? 'bg-[#09090b]' : 'bg-white'}`}>
      
      <CanvasDrawer
        canvases={canvases}
        currentCanvasId={currentCanvasId}
        viewSettings={viewSettings}
        isOpen={isSidebarOpen}
        labels={t}
        editingCanvasId={editingCanvasId}
        tempCanvasName={tempCanvasName}
        onTempCanvasNameChange={setTempCanvasName}
        onSelectCanvas={handleSwitchCanvas}
        onCreateCanvas={handleCreateCanvas}
        onDeleteCanvas={handleDeleteCanvas}
        onStartRename={startRename}
        onSaveRename={saveRename}
        onClose={closeSidebar}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Canvas */}
        <div ref={exportRef} className="flex-1 relative w-full h-full">
            <Whiteboard 
                data={data} settings={viewSettings} selectedId={selectedId} editingNodeId={editingNodeId}
                onSelect={setSelectedId} onAddChild={handleAddChild} onDelete={handleDelete}
                onUpdateContent={handleUpdateContent} onEditStart={setEditingNodeId} onEditEnd={() => setEditingNodeId(null)}
                onGenerateAI={handleGenerateAI} onMoveRoot={handleMoveRoot} onCopyContext={handleCopyContext}
                isGenerating={isGenerating}
            />
        </div>

        {/* --- Floating UI Overlay --- */}
        <div className="absolute inset-0 pointer-events-none z-50">
            
            {/* Top Left: Menu & Title */}
            <div className="absolute top-6 left-6 flex items-center gap-3 pointer-events-auto">
                <button 
                   onClick={openSidebar} 
                   className={`${topBtnStyle} rounded-full`}
                >
                    <Menu size={18} />
                </button>
                
                <div className={`h-10 px-4 rounded-full flex items-center gap-3 shadow-lg border ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200 text-neutral-800'}`}>
                    <div className="flex items-center gap-2">
                         <Sparkles size={14} className="text-purple-500" />
                         <span className="font-bold tracking-tight text-sm">Vibe-Thinking</span>
                    </div>
                    <div className="h-4 w-px bg-neutral-700/50 mx-1"></div>
                    <div className="min-w-[80px]" onDoubleClick={() => currentCanvas && startRename(currentCanvas.id)}>
                        {editingCanvasId === currentCanvasId ? (
                        <input 
                            autoFocus 
                            value={tempCanvasName} 
                            onChange={(e) => setTempCanvasName(e.target.value)} 
                            onBlur={() => saveRename(currentCanvasId)} 
                            onKeyDown={(e) => e.key === 'Enter' && saveRename(currentCanvasId)} 
                            className="bg-transparent border-b outline-none text-xs font-mono w-full"
                        />
                        ) : (
                        <span className="text-xs opacity-70 cursor-text hover:opacity-100 transition-opacity" title="Double click to rename">{currentCanvas?.name}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Right: Actions */}
            <div className="absolute top-6 right-6 flex items-center gap-3 pointer-events-auto">
                 <button onClick={undo} disabled={!canUndo} className={`${topBtnStyle} ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Undo2 size={16} />
                 </button>
                 <button onClick={redo} disabled={!canRedo} className={`${topBtnStyle} ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Redo2 size={16} />
                 </button>
                 
                 {/* Export Dropdown */}
                 <div className="relative group">
                    <button onClick={() => setIsExportOpen(!isExportOpen)} className={`${topBtnStyle}`}>
                        <Download size={16} />
                    </button>
                    {isExportOpen && (
                        <div className={`absolute top-full right-0 mt-2 w-48 rounded-lg border shadow-xl py-1 z-50 ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200 text-black'}`}>
                        <button onClick={handleExportJson} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2`}>
                            <FileJson size={14} /> {t.exportJson}
                        </button>
                        <button onClick={handleExportImage} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2`}>
                            <ImageIcon size={14} /> {t.exportImage}
                        </button>
                        <div className={`h-px mx-2 my-1 ${viewSettings.theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
                        <button onClick={handleCopyGlobalContext} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2`}>
                            <Clipboard size={14} /> {t.copyGlobal}
                        </button>
                        </div>
                    )}
                 </div>

                 <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`${topBtnStyle}`}>
                    <Settings size={16} />
                 </button>

                 {/* Theme/Agent Toggle (Purple Button) */}
                 <button onClick={toggleAgent} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white`}>
                    <Bot size={18} />
                 </button>
            </div>
             
             {/* Settings Popover */}
             {isSettingsOpen && (
                <div className={`absolute top-20 right-6 w-56 rounded-lg border shadow-xl p-3 z-50 pointer-events-auto ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200'}`}>
                     <div className="flex gap-2 mb-2">
                        <button onClick={() => toggleSetting('theme', 'dark')} className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.theme === 'dark' ? 'bg-white text-black border-white' : 'opacity-50'}`}><Moon size={10} className="inline mr-1"/>{t.dark}</button>
                        <button onClick={() => toggleSetting('theme', 'light')} className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.theme === 'light' ? 'bg-black text-white border-black' : 'opacity-50'}`}><Sun size={10} className="inline mr-1"/>{t.light}</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => toggleSetting('orientation', 'vertical')} className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.orientation === 'vertical' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}><ArrowDown size={10} className="inline mr-1"/>{t.vertical}</button>
                        <button onClick={() => toggleSetting('orientation', 'horizontal')} className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.orientation === 'horizontal' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}><ArrowRight size={10} className="inline mr-1"/>{t.horizontal}</button>
                    </div>
                </div>
             )}

            {/* Bottom Left: FAB (Add Floating Node) */}
            <div className="absolute bottom-6 left-6 pointer-events-auto">
                 <button 
                   onClick={handleAddFloatingNode}
                   className="flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-6 py-3 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 font-medium tracking-wide"
                 >
                    <Plus size={20} />
                    <span>{t.floatingNode}</span>
                 </button>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full text-xs font-bold uppercase animate-bounce z-50 border border-white/20 shadow-xl pointer-events-auto">
                    {notification}
                </div>
            )}
        </div>

        {/* Agent Panel (Slide over) */}
        {isAgentOpen && (
          <div 
             style={{ width: agentPanelWidth }} 
             className={`absolute top-0 right-0 bottom-0 z-[60] border-l shadow-2xl flex flex-col ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800' : 'bg-white border-neutral-200'}`}
          >
             <AgentPanel 
                isOpen={isAgentOpen}
                onClose={closeAgent}
                messages={agentMessages}
                onSendMessage={sendAgentMessage}
                isProcessing={isAgentProcessing}
                theme={viewSettings.theme}
                availableNodes={availableNodes}
            />
            {/* Draggable Handle */}
            <div 
                className="absolute top-0 left-[-4px] bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-blue-500/20 transition-colors flex items-center justify-center group"
                onMouseDown={(e) => { e.preventDefault(); startResizing(); }}
            >
               <div className={`h-8 w-1 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors`} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
