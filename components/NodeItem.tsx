
import React, { useState, useRef, useEffect } from 'react';
import { LayoutNode, Theme, Orientation } from '../types';
import { THEME_COLORS, NODE_ICONS, NODE_WIDTH } from '../constants';
import { Plus, Trash2, Sparkles, Edit2, Copy } from 'lucide-react';

interface NodeItemProps {
  node: LayoutNode;
  nodeHeight: number;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  onGenerateAI: (id: string) => void;
  onCopyContext: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  isRoot: boolean;
  isGenerating: boolean;
  theme: Theme;
  orientation: Orientation;
}

export const NodeItem: React.FC<NodeItemProps> = ({
  node,
  isSelected,
  isEditing,
  onSelect,
  onAddChild,
  onDelete,
  onUpdateContent,
  onEditStart,
  onEditEnd,
  onGenerateAI,
  onCopyContext,
  onMouseDown,
  isRoot,
  isGenerating,
  theme,
  orientation,
  nodeHeight,
}) => {
  const [tempContent, setTempContent] = useState(node.content);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const styleConfig = THEME_COLORS[theme][node.type];
  const Icon = NODE_ICONS[node.type];

  // Minimalist Input Styles
  const inputStyles = theme === 'dark' 
    ? 'bg-[#18181b] text-white border-neutral-700 focus:ring-0' 
    : 'bg-white text-black border-neutral-300 focus:ring-0';

  // Toolbar Styles
  const toolbarBg = theme === 'dark' ? 'bg-[#09090b] border-neutral-800' : 'bg-white border-black';
  const toolbarHover = theme === 'dark' ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100';
  const toolbarIcon = theme === 'dark' ? 'text-white' : 'text-black';
  const nodeIdTextClass = theme === 'dark' ? 'text-white/70' : 'text-black/70';

  useEffect(() => {
    setTempContent(node.content);
  }, [node.content]);

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (tempContent.trim() !== '') {
      onUpdateContent(node.id, tempContent);
    } else {
      setTempContent(node.content);
    }
    onEditEnd();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); 
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setTempContent(node.content);
      onEditEnd();
    }
  };

  // Connection Dots Positioning - Center of edges
  const incomingDotClass = orientation === 'vertical'
    ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'
    : 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2';
  
  const outgoingDotClass = orientation === 'vertical'
    ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2'
    : 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2';

  // Visual Styling matching screenshot
  const borderClass = isSelected 
    ? (theme === 'dark' ? 'border-2 border-white/80 ring-2 ring-purple-500/20' : 'border-2 border-black/80')
    : `border ${styleConfig.border}`;

  const shadowClass = theme === 'dark' 
    ? 'shadow-lg shadow-black/40' 
    : 'shadow-sm';

  return (
    <div
      className={`absolute transform transition-transform duration-75 ease-out group`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: nodeHeight,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 50 : 10,
        cursor: !isEditing ? 'move' : 'default'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onMouseDown={(e) => {
          if (isEditing) return;
          onMouseDown(e, node.id);
      }}
    >
      {/* Card Body */}
      <div
        className={`
          relative flex flex-col w-full h-full rounded-md overflow-hidden
          ${styleConfig.bg} 
          ${borderClass}
          ${shadowClass}
        `}
      >
        {/* Header: Full Width Colored Strip */}
        <div 
            className={`px-3 py-1.5 flex flex-shrink-0 items-center justify-between ${styleConfig.headerBg} ${styleConfig.headerText} cursor-pointer`}
            title="Click to select"
        >
          <div className="flex items-center gap-2">
            <Icon size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {node.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] italic tracking-[0.18em] uppercase ${nodeIdTextClass}`}>
              {node.id}
            </span>
            {isSelected && (
               <button 
                 onClick={(e) => { 
                     e.preventDefault(); 
                     e.stopPropagation(); 
                     onDelete(node.id); 
                 }}
                 onMouseDown={(e) => e.stopPropagation()}
                 className={`p-0.5 hover:bg-black/20 rounded transition-colors text-white cursor-pointer z-50`}
                 title="Delete Node"
               >
                 <Trash2 size={12} />
               </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div 
            className="flex-1 p-3 flex items-start cursor-text overflow-hidden"
            onClick={(e) => {
                e.stopPropagation();
                onSelect(node.id);
                onEditStart(node.id);
            }}
            onMouseDown={(e) => e.stopPropagation()} 
        >
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={tempContent}
              onChange={(e) => setTempContent(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className={`w-full h-full p-0 text-xs focus:outline-none resize-none bg-transparent ${theme === 'dark' ? 'text-white' : 'text-black'} leading-relaxed font-medium`}
              onMouseDown={(e) => e.stopPropagation()} 
            />
          ) : (
            <p 
              className={`text-xs font-medium leading-relaxed ${styleConfig.text} break-words w-full h-full select-none overflow-y-auto custom-scrollbar`}
              style={{ scrollbarWidth: 'none' }}
            >
              {node.content}
            </p>
          )}
        </div>
      </div>

      {/* Toolbar - Floating below */}
      {isSelected && !isEditing && (
          <div 
             className={`absolute -bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-1 border shadow-xl p-1 px-2 z-50 animate-in fade-in zoom-in duration-200 rounded-md ${toolbarBg}`}
             onMouseDown={(e) => e.stopPropagation()} 
          >
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
              className={`p-1.5 rounded transition-colors ${toolbarIcon} ${toolbarHover}`}
              title="Add Child Node (Enter)"
            >
              <Plus size={14} />
            </button>
            <div className={`w-px h-3 mx-1 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
            <button
              onClick={(e) => { e.stopPropagation(); onEditStart(node.id); }}
              className={`p-1.5 rounded transition-colors ${toolbarIcon} ${toolbarHover}`}
              title="Edit Text"
            >
              <Edit2 size={12} />
            </button>
             <div className={`w-px h-3 mx-1 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
            <button
              onClick={(e) => { e.stopPropagation(); onCopyContext(node.id); }}
              className={`p-1.5 rounded transition-colors ${toolbarIcon} ${toolbarHover}`}
              title="Copy Context Path"
            >
              <Copy size={12} />
            </button>
            <div className={`w-px h-3 mx-1 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateAI(node.id); }}
              disabled={isGenerating}
              className={`p-1.5 rounded flex items-center gap-1 transition-colors ${toolbarIcon} ${toolbarHover} ${isGenerating ? 'opacity-50' : ''}`}
              title="Brainstorm with Gemini"
            >
              <Sparkles size={12} className={isGenerating ? 'animate-spin' : ''} />
            </button>
          </div>
      )}

      {/* Connector Dots */}
       <div className={`absolute w-1.5 h-1.5 rounded-full ${styleConfig.indicator} transform ${outgoingDotClass} z-0`} />
       {!isRoot && <div className={`absolute w-1.5 h-1.5 rounded-full ${styleConfig.indicator} transform ${incomingDotClass} z-0`} />}
    </div>
  );
};
