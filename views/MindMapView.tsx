import { useRef } from 'react';
import { MindMapViewModel } from '@/viewmodels/useMindMapViewModel';
import { Whiteboard } from '@/components/Whiteboard';
import { AgentPanel } from '@/components/AgentPanel';
import { CanvasDrawer } from '@/components/layout/CanvasDrawer';
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

interface MindMapViewProps {
  viewModel: MindMapViewModel;
}

export const MindMapView = ({ viewModel }: MindMapViewProps) => {
  const {
    t,
    data,
    canvases,
    currentCanvas,
    currentCanvasId,
    selectedId,
    setSelectedId,
    editingNodeId,
    setEditingNodeId,
    viewSettings,
    isSettingsOpen,
    setIsSettingsOpen,
    isExportOpen,
    setIsExportOpen,
    notification,
    isGenerating,
    handleAddChild,
    handleAddFloatingNode,
    handleDelete,
    handleUpdateContent,
    handleGenerateAI,
    handleMoveRoot,
    handleCopyContext,
    handleExportJson,
    handleExportImage,
    handleCopyGlobalContext,
    toggleSetting,
    handleCreateCanvas,
    handleSwitchCanvas,
    handleDeleteCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
    isSidebarOpen,
    openSidebar,
    closeSidebar,
    editingCanvasId,
    tempCanvasName,
    setTempCanvasName,
    startRename,
    saveRename,
    isAgentOpen,
    toggleAgent,
    closeAgent,
    agentMessages,
    sendAgentMessage,
    isAgentProcessing,
    agentPanelWidth,
    startResizing,
    availableNodes,
  } = viewModel;

  const exportRef = useRef<HTMLDivElement>(null);
  const topBtnDark = 'bg-[#18181b] hover:bg-neutral-800 text-neutral-300 border-neutral-800';
  const topBtnLight = 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200';
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

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div ref={exportRef} className="flex-1 relative w-full h-full">
          <Whiteboard
            data={data}
            settings={viewSettings}
            selectedId={selectedId}
            editingNodeId={editingNodeId}
            onSelect={setSelectedId}
            onAddChild={handleAddChild}
            onDelete={handleDelete}
            onUpdateContent={handleUpdateContent}
            onEditStart={setEditingNodeId}
            onEditEnd={() => setEditingNodeId(null)}
            onGenerateAI={handleGenerateAI}
            onMoveRoot={handleMoveRoot}
            onCopyContext={handleCopyContext}
            isGenerating={isGenerating}
          />
        </div>

        <div className="absolute inset-0 pointer-events-none z-50">
          <div className="absolute top-6 left-6 flex items-center gap-3 pointer-events-auto">
            <button onClick={openSidebar} className={`${topBtnStyle} rounded-full`}>
              <Menu size={18} />
            </button>

            <div
              className={`h-10 px-4 rounded-full flex items-center gap-3 shadow-lg border ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200 text-neutral-800'}`}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-purple-500" />
                <span className="font-bold tracking-tight text-sm">Vibe-Thinking</span>
              </div>
              <div className="h-4 w-px bg-neutral-700/50 mx-1" />
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
                  <span className="text-xs opacity-70 cursor-text hover:opacity-100 transition-opacity" title="Double click to rename">
                    {currentCanvas?.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="absolute top-6 right-6 flex items-center gap-3 pointer-events-auto">
            <button onClick={undo} disabled={!canUndo} className={`${topBtnStyle} ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Undo2 size={16} />
            </button>
            <button onClick={redo} disabled={!canRedo} className={`${topBtnStyle} ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Redo2 size={16} />
            </button>

            <div className="relative group">
              <button onClick={() => setIsExportOpen(!isExportOpen)} className={`${topBtnStyle}`}>
                <Download size={16} />
              </button>
              {isExportOpen && (
                <div
                  className={`absolute top-full right-0 mt-2 w-48 rounded-lg border shadow-xl py-1 z-50 ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200 text-black'}`}
                >
                  <button onClick={handleExportJson} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2">
                    <FileJson size={14} /> {t.exportJson}
                  </button>
                  <button onClick={() => handleExportImage(exportRef.current)} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2">
                    <ImageIcon size={14} /> {t.exportImage}
                  </button>
                  <div className={`h-px mx-2 my-1 ${viewSettings.theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
                  <button onClick={handleCopyGlobalContext} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2">
                    <Clipboard size={14} /> {t.copyGlobal}
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`${topBtnStyle}`}>
              <Settings size={16} />
            </button>

            <button onClick={toggleAgent} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white">
              <Bot size={18} />
            </button>
          </div>

          {isSettingsOpen && (
            <div
              className={`absolute top-20 right-6 w-56 rounded-lg border shadow-xl p-3 z-50 pointer-events-auto ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200'}`}
            >
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => toggleSetting('theme', 'dark')}
                  className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.theme === 'dark' ? 'bg-white text-black border-white' : 'opacity-50'}`}
                >
                  <Moon size={10} className="inline mr-1" />
                  {t.dark}
                </button>
                <button
                  onClick={() => toggleSetting('theme', 'light')}
                  className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.theme === 'light' ? 'bg-black text-white border-black' : 'opacity-50'}`}
                >
                  <Sun size={10} className="inline mr-1" />
                  {t.light}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSetting('orientation', 'vertical')}
                  className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.orientation === 'vertical' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}
                >
                  <ArrowDown size={10} className="inline mr-1" />
                  {t.vertical}
                </button>
                <button
                  onClick={() => toggleSetting('orientation', 'horizontal')}
                  className={`flex-1 py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.orientation === 'horizontal' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}
                >
                  <ArrowRight size={10} className="inline mr-1" />
                  {t.horizontal}
                </button>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-6 pointer-events-auto">
            <button
              onClick={handleAddFloatingNode}
              className="flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-6 py-3 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 font-medium tracking-wide"
            >
              <Plus size={20} />
              <span>{t.floatingNode}</span>
            </button>
          </div>

          {notification && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full text-xs font-bold uppercase animate-bounce z-50 border border-white/20 shadow-xl pointer-events-auto">
              {notification}
            </div>
          )}
        </div>

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
            <div
              className="absolute top-0 left-[-4px] bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-blue-500/20 transition-colors flex items-center justify-center group"
              onMouseDown={(e) => {
                e.preventDefault();
                startResizing();
              }}
            >
              <div className="h-8 w-1 rounded-full bg-neutral-600 group-hover:bg-blue-500 transition-colors" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
