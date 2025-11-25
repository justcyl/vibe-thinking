
import React, { useState, useRef, useEffect } from 'react';
import { MindMapProject, LayoutNode, LayoutLink, ViewSettings } from '../types';
import { calculateTreeLayout } from '../utils/layout';
import { NodeItem } from './NodeItem';
import { NODE_HEIGHT, NODE_WIDTH } from '../constants';
import { Plus, Minus, RotateCcw } from 'lucide-react';

interface WhiteboardProps {
  data: MindMapProject;
  settings: ViewSettings;
  selectedId: string | null;
  editingNodeId: string | null;
  onSelect: (id: string | null) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  onGenerateAI: (id: string) => void;
  onMoveRoot: (id: string, x: number, y: number) => void;
  onCopyContext: (id: string) => void;
  isGenerating: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  data,
  settings,
  selectedId,
  editingNodeId,
  onSelect,
  onAddChild,
  onDelete,
  onUpdateContent,
  onEditStart,
  onEditEnd,
  onGenerateAI,
  onMoveRoot,
  onCopyContext,
  isGenerating
}) => {
  const [layout, setLayout] = useState<{ nodes: LayoutNode[], links: LayoutLink[] }>({ nodes: [], links: [] });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 0.8 });
  
  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate layout whenever data or orientation changes
  useEffect(() => {
    const { nodes, links } = calculateTreeLayout(data, settings.orientation);
    setLayout({ nodes, links });
  }, [data, settings.orientation]);

  // Center the view on mount
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setViewport({
        x: width / 2,
        y: settings.orientation === 'vertical' ? 100 : height / 2, 
        scale: 0.8
      });
    }
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, viewport.scale - e.deltaY * zoomSensitivity), 3);
      setViewport(prev => ({ ...prev, scale: newScale }));
    } else {
      setViewport(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Background click -> Pan
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('svg')) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      onSelect(null);
      onEditEnd();
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
      // Check if it's a root node in our layout
      const node = layout.nodes.find(n => n.id === nodeId);
      if (node && !node.parentId) {
          setDraggedNodeId(nodeId);
          setLastMousePos({ x: e.clientX, y: e.clientY });
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    setLastMousePos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    } else if (draggedNodeId) {
        const node = layout.nodes.find(n => n.id === draggedNodeId);
        if (node) {
            const worldDx = dx / viewport.scale;
            const worldDy = dy / viewport.scale;
            
            const currentRootData = node.data; 
            const currentX = currentRootData.x || 0;
            const currentY = currentRootData.y || 0;

            onMoveRoot(draggedNodeId, currentX + worldDx, currentY + worldDy);
        }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Path Generators: Connect from edge to edge (Top/Bottom or Left/Right)
  const getPath = (source: LayoutNode, target: LayoutNode) => {
    const sourceHalfH = NODE_HEIGHT / 2;
    const sourceHalfW = NODE_WIDTH / 2;
    const targetHalfH = NODE_HEIGHT / 2;
    const targetHalfW = NODE_WIDTH / 2;

    if (settings.orientation === 'vertical') {
        // From Source Bottom to Target Top
        const startX = source.x;
        const startY = source.y + sourceHalfH;
        const endX = target.x;
        const endY = target.y - targetHalfH;

        const midY = (startY + endY) / 2;
        return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    } else {
        // From Source Right to Target Left
        const startX = source.x + sourceHalfW;
        const startY = source.y;
        const endX = target.x - targetHalfW;
        const endY = target.y;

        const midX = (startX + endX) / 2;
        return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
    }
  };

  // Styles
  const gridColor = settings.theme === 'dark' ? '#333333' : '#e5e5e5';
  const lineColor = settings.theme === 'dark' ? '#525252' : '#a3a3a3'; 
  const bgColor = settings.theme === 'dark' ? 'bg-[#09090b]' : 'bg-white'; // Darker bg
  
  // Zoom Controls Style (Vertical Stack)
  const zoomBtnClass = "p-2 hover:bg-neutral-800 text-white flex items-center justify-center transition-colors";
  const zoomContainerClass = "absolute bottom-6 right-6 flex flex-col z-50 rounded-lg border shadow-2xl overflow-hidden select-none exclude-from-export";
  const zoomContainerStyle = settings.theme === 'dark' 
      ? "bg-black border-neutral-800" 
      : "bg-white border-neutral-200 text-black";

  return (
    <div
      id="whiteboard-root"
      ref={containerRef}
      className={`w-full h-full overflow-hidden relative cursor-default ${bgColor} ${isPanning ? 'cursor-grabbing' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Dot Grid Background */}
      <div 
        id="whiteboard-grid"
        className="absolute inset-0 pointer-events-none"
        style={{
            backgroundImage: `radial-gradient(${gridColor} 1.5px, transparent 1.5px)`,
            backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            opacity: 0.5
        }}
      />

      <div
        id="whiteboard-viewport"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        {/* SVG Connections Layer */}
        <svg className="absolute overflow-visible top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <g>
            {layout.links.map((link, i) => {
               const path = getPath(link.source, link.target);
               return (
                  <path
                    key={i}
                    d={path}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1.5"
                    className="transition-all duration-300"
                  />
               );
            })}
          </g>
        </svg>

        {/* Nodes Layer */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-auto" style={{ zIndex: 1 }}>
          {layout.nodes.map(node => (
            <NodeItem
              key={node.id}
              node={node}
              isSelected={selectedId === node.id}
              isEditing={editingNodeId === node.id}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onUpdateContent={onUpdateContent}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
              onGenerateAI={onGenerateAI}
              onCopyContext={onCopyContext}
              onMouseDown={handleNodeMouseDown}
              isRoot={!node.parentId}
              isGenerating={isGenerating && selectedId === node.id}
              theme={settings.theme}
              orientation={settings.orientation}
            />
          ))}
        </div>
      </div>

      {/* HUD Controls (Vertical Stack like Screenshot) */}
      <div className={`${zoomContainerClass} ${zoomContainerStyle}`}>
        <button 
          className={`${zoomBtnClass} border-b border-neutral-800`}
          onClick={() => setViewport(prev => ({ ...prev, scale: prev.scale + 0.1 }))}
          title="Zoom In"
        >
           <Plus size={16} />
        </button>
        <div className={`py-2 text-[10px] font-mono font-bold text-center w-10 border-b border-neutral-800 ${settings.theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {Math.round(viewport.scale * 100)}%
        </div>
        <button 
          className={`${zoomBtnClass} border-b border-neutral-800`}
          onClick={() => setViewport(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }))}
          title="Zoom Out"
        >
           <Minus size={16} />
        </button>
        <button 
          className={`${zoomBtnClass} text-[10px] font-bold font-mono tracking-wider`}
          onClick={() => setViewport({ x: containerRef.current?.clientWidth! / 2, y: settings.orientation === 'vertical' ? 100 : containerRef.current?.clientHeight! / 2, scale: 0.8 })}
          title="Reset View"
        >
           RST
        </button>
      </div>
    </div>
  );
};
