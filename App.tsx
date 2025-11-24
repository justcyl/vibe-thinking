
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { AgentPanel } from './components/AgentPanel';
import { MindMapProject, MindMapNode, NodeType, ViewSettings, Canvas, AgentMessage, AgentOperation } from './types';
import { INITIAL_DATA, LABELS, TYPE_DESCRIPTIONS, AGENT_ICONS } from './constants';
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
  serializeForestForAgent
} from './utils/layout';
import { generateBrainstormIdeas, chatWithAgent } from './services/geminiService';
import { 
  Sparkles, Layout, Download, Settings, Moon, Sun, ArrowDown, ArrowRight, 
  PlusCircle, Undo2, Redo2, Copy, Menu, X, Trash2, Plus, FileText, Edit2, Clipboard,
  Bot, Image as ImageIcon, FileJson, Palette
} from 'lucide-react';
import { toPng } from 'html-to-image';

export default function App() {
  const t = LABELS;

  // --- Canvas State ---
  const [canvases, setCanvases] = useState<Canvas[]>([{
    id: 'default-canvas',
    name: t.untitledCanvas,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data: INITIAL_DATA
  }]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string>('default-canvas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- History ---
  const [history, setHistory] = useState<MindMapProject[]>([INITIAL_DATA]);
  const [historyIndex, setHistoryIndex] = useState(0);

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
  
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [tempCanvasName, setTempCanvasName] = useState("");

  // --- Agent State ---
  const [isAgentOpen, setIsAgentOpen] = useState(false); // Default closed in this UI
  const [agentPanelWidth, setAgentPanelWidth] = useState(350);
  const [isResizingAgent, setIsResizingAgent] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  
  const exportRef = useRef<HTMLDivElement>(null);
  
  const data = history[historyIndex] || INITIAL_DATA;

  const updateCurrentCanvasData = useCallback((newData: MindMapProject) => {
      setCanvases(prev => prev.map(c => 
          c.id === currentCanvasId 
              ? { ...c, data: newData, updatedAt: Date.now() }
              : c
      ));
  }, [currentCanvasId]);

  const pushState = useCallback((newData: MindMapProject) => {
    setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, newData];
    });
    setHistoryIndex(prev => prev + 1);
    updateCurrentCanvasData(newData);
  }, [historyIndex, updateCurrentCanvasData]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        updateCurrentCanvasData(history[newIndex]);
    }
  }, [historyIndex, history, updateCurrentCanvasData]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        updateCurrentCanvasData(history[newIndex]);
    }
  }, [historyIndex, history.length, history, updateCurrentCanvasData]);

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
    const newChild: MindMapNode = {
      id: generateNodeId(), type: nextType, content: t.newIdea, children: [], parentId: parentId
    };
    const newData = addNode(data, newChild);
    pushState(newData);
    setTimeout(() => { setSelectedId(newChild.id); setEditingNodeId(newChild.id); }, 0);
  }, [data, t, pushState]);

  const handleAddFloatingNode = useCallback(() => {
    const newNode: MindMapNode = {
      id: generateNodeId(), type: NodeType.TOPIC, content: t.newIdea, children: [], parentId: null, x: 0, y: 0,
    };
    const newData = addNode(data, newNode);
    pushState(newData);
    setTimeout(() => { setSelectedId(newNode.id); setEditingNodeId(newNode.id); }, 0);
  }, [data, t, pushState]);

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

  const handleMoveRoot = useCallback((id: string, x: number, y: number) => {
      setHistory(prev => {
          const currentHistory = [...prev];
          const currentData = currentHistory[historyIndex];
          if (currentData) {
             currentHistory[historyIndex] = updateRootPosition(currentData, id, x, y); 
          }
          return currentHistory;
      });
      setCanvases(prev => prev.map(c => {
          if (c.id === currentCanvasId) {
               const currentData = history[historyIndex];
               if (currentData) return { ...c, data: updateRootPosition(currentData, id, x, y) };
          }
          return c;
      }));
  }, [historyIndex, currentCanvasId, history]);

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
     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
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
      let currentProject = data;
      suggestions.forEach(suggestion => {
        const newChild: MindMapNode = {
           id: generateNodeId(), type: suggestion.type, content: suggestion.content, children: [], parentId: nodeId
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
  }, [data, t, pushState]);

  const handleAgentMessage = useCallback(async (text: string) => {
    const newMessage: AgentMessage = { id: generateNodeId(), role: 'user', content: text, timestamp: Date.now() };
    setAgentMessages(prev => [...prev, newMessage]);
    setIsAgentProcessing(true);
    try {
        const flattenedContext = serializeForestForAgent(data);
        const response = await chatWithAgent(text, flattenedContext);
        if (response.operations && response.operations.length > 0) {
            let currentData = data;
            let changesMade = false;
            for (const op of response.operations) {
                if (op.action === 'ADD_CHILD' && op.parentId && op.nodeType && op.content) {
                     const newChild: MindMapNode = {
                        id: generateNodeId(), type: op.nodeType as NodeType, content: op.content, children: [], parentId: op.parentId
                    };
                    currentData = addNode(currentData, newChild);
                    changesMade = true;
                } else if (op.action === 'UPDATE_CONTENT' && op.nodeId && op.content) {
                    currentData = updateNode(currentData, op.nodeId, () => ({ content: op.content! }));
                    changesMade = true;
                } else if (op.action === 'DELETE_NODE' && op.nodeId) {
                    currentData = deleteNode(currentData, op.nodeId);
                    changesMade = true;
                }
            }
            if (changesMade) pushState(currentData);
        }
        setAgentMessages(prev => [...prev, { id: generateNodeId(), role: 'assistant', content: response.reply, timestamp: Date.now() }]);
    } catch (error) {
        setAgentMessages(prev => [...prev, { id: generateNodeId(), role: 'assistant', content: "Error processing request.", timestamp: Date.now() }]);
    } finally {
        setIsAgentProcessing(false);
    }
  }, [data, pushState]);

  const handleCreateCanvas = () => {
      const rootId = generateNodeId();
      const newCanvas: Canvas = {
          id: `canvas_${Date.now()}`, name: t.untitledCanvas + ' ' + (canvases.length + 1), createdAt: Date.now(), updatedAt: Date.now(),
          data: { nodes: { [rootId]: { id: rootId, type: NodeType.TOPIC, content: t.newIdea, children: [], parentId: null, x: 0, y: 0 } }, rootIds: [rootId] }
      };
      setCanvases(prev => [...prev, newCanvas]);
      handleSwitchCanvas(newCanvas.id, newCanvas.data);
      setIsSidebarOpen(false);
  };

  const handleSwitchCanvas = (id: string, canvasData?: MindMapProject) => {
      const targetCanvas = canvases.find(c => c.id === id);
      if (!targetCanvas && !canvasData) return;
      const dataToLoad = canvasData || targetCanvas!.data;
      setCurrentCanvasId(id);
      setHistory([dataToLoad]);
      setHistoryIndex(0);
      setSelectedId(null);
      setEditingNodeId(null);
      setIsSidebarOpen(false);
  };

  const handleDeleteCanvas = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (canvases.length <= 1 || !window.confirm(t.confirmDelete)) return;
      const newCanvases = canvases.filter(c => c.id !== id);
      setCanvases(newCanvases);
      if (id === currentCanvasId) handleSwitchCanvas(newCanvases[0].id, newCanvases[0].data);
  };

  const handleStartRename = (e: React.MouseEvent, canvas: Canvas) => {
      e.stopPropagation();
      setEditingCanvasId(canvas.id);
      setTempCanvasName(canvas.name);
  };

  const handleSaveRename = (id: string) => {
      setCanvases(prev => prev.map(c => c.id === id ? { ...c, name: tempCanvasName } : c));
      setEditingCanvasId(null);
  };

  const toggleSetting = (key: keyof ViewSettings, value: any) => {
    setViewSettings(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingAgent) {
        const newWidth = Math.max(250, Math.min(e.clientX, 600));
        setAgentPanelWidth(newWidth);
      }
    };
    const handleMouseUp = () => { if (isResizingAgent) setIsResizingAgent(false); };
    if (isResizingAgent) {
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = 'default';
    }
    return () => {
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAgent]);

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

  const sidebarBg = viewSettings.theme === 'dark' ? 'bg-[#18181b] border-r border-neutral-800' : 'bg-neutral-50 border-r border-neutral-200';
  const currentCanvas = canvases.find(c => c.id === currentCanvasId);

  // Floating Control Styles
  const topBtnClass = "w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg border";
  const topBtnDark = "bg-[#18181b] hover:bg-neutral-800 text-neutral-300 border-neutral-800";
  const topBtnLight = "bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200";
  const topBtnStyle = viewSettings.theme === 'dark' ? topBtnDark : topBtnLight;

  return (
    <div className={`w-full h-screen flex overflow-hidden relative ${viewSettings.theme === 'dark' ? 'bg-[#09090b]' : 'bg-white'}`}>
      
      {/* Left Canvas Drawer */}
      <div className={`fixed inset-y-0 left-0 z-[100] w-64 transform transition-transform duration-300 ease-in-out ${sidebarBg} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl flex flex-col`}>
          <div className={`h-14 flex items-center justify-between px-4 border-b ${viewSettings.theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'}`}>
              <h2 className="text-xs font-bold uppercase tracking-wider opacity-70">{t.myCanvases}</h2>
              <button onClick={() => setIsSidebarOpen(false)} className={`p-1 rounded hover:bg-white/10`}><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {canvases.map(canvas => (
                  <div key={canvas.id} onClick={() => handleSwitchCanvas(canvas.id)} className={`flex items-center justify-between p-2 cursor-pointer rounded transition-colors ${currentCanvasId === canvas.id ? (viewSettings.theme === 'dark' ? 'bg-neutral-800 text-white' : 'bg-white border border-neutral-200') : 'opacity-70 hover:opacity-100'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={14} />
                          {editingCanvasId === canvas.id ? (
                              <input autoFocus value={tempCanvasName} onChange={(e) => setTempCanvasName(e.target.value)} onBlur={() => handleSaveRename(canvas.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(canvas.id)} onClick={(e) => e.stopPropagation()} className="bg-transparent border-b outline-none text-xs w-full" />
                          ) : <span className="text-xs truncate select-none">{canvas.name}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                          <button onClick={(e) => handleStartRename(e, canvas)} className="p-1 hover:text-blue-500"><Edit2 size={10} /></button>
                          {canvases.length > 1 && <button onClick={(e) => handleDeleteCanvas(e, canvas.id)} className="p-1 hover:text-red-500"><Trash2 size={10} /></button>}
                      </div>
                  </div>
              ))}
          </div>
          <div className={`p-4 border-t ${viewSettings.theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'}`}>
              <button onClick={handleCreateCanvas} className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase border transition-colors ${viewSettings.theme === 'dark' ? 'border-neutral-700 hover:bg-neutral-800' : 'border-neutral-300 hover:bg-neutral-100'}`}><Plus size={14} /> {t.newCanvas}</button>
          </div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[90]" onClick={() => setIsSidebarOpen(false)} />}

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
                   onClick={() => setIsSidebarOpen(true)} 
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
                    <div className="min-w-[80px]" onDoubleClick={(e) => currentCanvas && handleStartRename(e, currentCanvas)}>
                        {editingCanvasId === currentCanvasId ? (
                        <input 
                            autoFocus 
                            value={tempCanvasName} 
                            onChange={(e) => setTempCanvasName(e.target.value)} 
                            onBlur={() => handleSaveRename(currentCanvasId)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(currentCanvasId)} 
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
                 <button onClick={undo} disabled={historyIndex === 0} className={`${topBtnStyle} ${historyIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Undo2 size={16} />
                 </button>
                 <button onClick={redo} disabled={historyIndex === history.length - 1} className={`${topBtnStyle} ${historyIndex === history.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                 <button onClick={() => setIsAgentOpen(!isAgentOpen)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white`}>
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
                onClose={() => setIsAgentOpen(false)}
                messages={agentMessages}
                onSendMessage={handleAgentMessage}
                isProcessing={isAgentProcessing}
                theme={viewSettings.theme}
                availableNodes={serializeForestForAgent(data)}
            />
            {/* Draggable Handle */}
            <div 
                className="absolute top-0 left-[-4px] bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-blue-500/20 transition-colors flex items-center justify-center group"
                onMouseDown={(e) => { e.preventDefault(); setIsResizingAgent(true); }}
            >
               <div className={`h-8 w-1 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors`} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
