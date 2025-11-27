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
    getCurrentCanvasId,
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
    handleReorderChildren,
    handleCommitReorder,
    handleReparentNode,
    handleCopyContext,
    handleExportJson,
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
    editSource,
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
    selectedModel,
    setSelectedModel,
    currentConversation,
    conversations,
    newConversation,
    selectConversation,
    deleteConversation,
    showHistory,
    setShowHistory,
  } = viewModel;

  const topBtnStyle =
    'w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-zinc-900/50 hover:bg-zinc-800 text-neutral-100 shadow-lg border border-zinc-800/60';

  const topBtnActiveStyle =
    'w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-purple-600 hover:bg-purple-500 text-white shadow-lg border border-purple-500/60';

  return (
    <div className={`w-full h-screen flex overflow-hidden relative ${viewSettings.theme === 'dark' ? 'bg-[#09090b]' : 'bg-white'}`}>
      <CanvasDrawer
        canvases={canvases}
        currentCanvasId={currentCanvasId}
        viewSettings={viewSettings}
        isOpen={isSidebarOpen}
        labels={t}
        editSource={editSource}
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

      {/* Main content area with flex layout for split-screen */}
      <main className="flex-1 flex overflow-hidden">
        {/* Whiteboard area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 relative w-full h-full">
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
              onReparentNode={handleReparentNode}
              onReorderChildren={handleReorderChildren}
              onCommitReorder={handleCommitReorder}
              onCopyContext={handleCopyContext}
              isGenerating={isGenerating}
            />
          </div>

          {/* Floating UI controls */}
          <div className="absolute inset-0 pointer-events-none z-50">
            <div className="absolute top-6 left-6 flex items-center gap-3 pointer-events-auto">
              <button onClick={openSidebar} className={topBtnStyle}>
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
                <div className="min-w-[80px]" onDoubleClick={() => startRename(currentCanvasId, 'header')}>
                  {editingCanvasId === currentCanvasId && editSource === 'header' ? (
                    <input
                      autoFocus
                      value={tempCanvasName}
                      onChange={(e) => setTempCanvasName(e.target.value)}
                      onBlur={(e) => saveRename(currentCanvasId, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRename(currentCanvasId, e.currentTarget.value)}
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
              <button onClick={handleAddFloatingNode} className={topBtnStyle}>
                <Plus size={18} />
              </button>

              <div className="h-5 w-px bg-neutral-700/50 mx-2" />

              <div className="flex items-center gap-2">
                <button onClick={undo} disabled={!canUndo} className={`${topBtnStyle} ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Undo2 size={16} />
                </button>
                <button onClick={redo} disabled={!canRedo} className={`${topBtnStyle} ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Redo2 size={16} />
                </button>
              </div>

              <div className="h-5 w-px bg-neutral-700/50 mx-2" />

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button onClick={() => setIsExportOpen(!isExportOpen)} className={isExportOpen ? topBtnActiveStyle : topBtnStyle}>
                    <Download size={16} />
                  </button>
                  {isExportOpen && (
                    <div
                      className={`absolute top-full right-0 mt-2 w-48 rounded-lg border shadow-xl py-1 z-50 ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200 text-black'}`}
                    >
                      <button onClick={handleExportJson} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2">
                        <FileJson size={14} /> {t.exportJson}
                      </button>
                      <div className={`h-px mx-2 my-1 ${viewSettings.theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
                      <button onClick={handleCopyGlobalContext} className="w-full text-left px-4 py-2 text-xs hover:bg-white/10 flex items-center gap-2">
                        <Clipboard size={14} /> {t.copyGlobal}
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={isSettingsOpen ? topBtnActiveStyle : topBtnStyle}>
                  <Settings size={16} />
                </button>

                <button onClick={toggleAgent} className={isAgentOpen ? topBtnActiveStyle : topBtnStyle}>
                  <Bot size={18} />
                </button>
              </div>
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
                <div className="mt-3">
                  <div className="text-[10px] font-bold uppercase mb-1 opacity-70">{t.nodeSize}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => toggleSetting('nodeSize', 'small')}
                      className={`py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.nodeSize === 'small' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}
                    >
                      {t.sizeSmall}
                    </button>
                    <button
                      onClick={() => toggleSetting('nodeSize', 'medium')}
                      className={`py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.nodeSize === 'medium' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}
                    >
                      {t.sizeMedium}
                    </button>
                    <button
                      onClick={() => toggleSetting('nodeSize', 'large')}
                      className={`py-1.5 border text-[10px] font-bold uppercase rounded ${viewSettings.nodeSize === 'large' ? 'bg-white/20 border-white/40' : 'opacity-50'}`}
                    >
                      {t.sizeLarge}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {notification && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full text-xs font-bold uppercase animate-bounce z-50 border border-white/20 shadow-xl pointer-events-auto">
                {notification}
              </div>
            )}
          </div>
        </div>

        {/* Agent Panel - Split screen layout */}
        {isAgentOpen && (
          <div
            style={{ width: agentPanelWidth }}
            className={`flex-shrink-0 border-l flex flex-col relative ${viewSettings.theme === 'dark' ? 'bg-[#18181b] border-neutral-800' : 'bg-white border-neutral-200'}`}
          >
            {/* Resize handle */}
            <div
              className="absolute top-0 left-0 bottom-0 w-[4px] cursor-col-resize z-50 hover:bg-blue-500/30 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                startResizing();
              }}
            />
            <AgentPanel
              isOpen={isAgentOpen}
              onClose={closeAgent}
              messages={agentMessages}
              onSendMessage={sendAgentMessage}
              isProcessing={isAgentProcessing}
              theme={viewSettings.theme}
              availableNodes={availableNodes}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              currentConversation={currentConversation}
              conversations={conversations}
              onNewConversation={newConversation}
              onSelectConversation={selectConversation}
              onDeleteConversation={deleteConversation}
              showHistory={showHistory}
              onShowHistoryChange={setShowHistory}
            />
          </div>
        )}
      </main>
    </div>
  );
};
