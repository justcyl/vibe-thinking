
import React, { useState, useRef, useEffect } from 'react';
import { MindMapProject, LayoutNode, LayoutLink, ViewSettings } from '../types';
import { calculateTreeLayout } from '../utils/layout';
import { NodeItem } from './NodeItem';
import { NODE_HEIGHT, NODE_HEIGHT_MAP, NODE_WIDTH } from '../constants';
import { Plus, Minus } from 'lucide-react';

const DRAG_THRESHOLD = 4;

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
  onReparentNode: (id: string, newParentId: string | null) => void;
  onCopyContext: (id: string) => void;
  onReorderChildren: (parentId: string, orderedChildIds: string[]) => void;
  onCommitReorder: () => void;
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
  onReparentNode,
  onCopyContext,
  onReorderChildren,
  onCommitReorder,
  isGenerating
}) => {
  const [layout, setLayout] = useState<{ nodes: LayoutNode[], links: LayoutLink[] }>({ nodes: [], links: [] });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 0.8 });
  
  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'root' | 'reorder' | null>(null);
  const [draggedParentId, setDraggedParentId] = useState<string | null>(null);
  const [hasSiblingReordered, setHasSiblingReordered] = useState(false);
  const [hasDragMoved, setHasDragMoved] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [dragStartMousePos, setDragStartMousePos] = useState({ x: 0, y: 0 });
  const [dragStartNodePos, setDragStartNodePos] = useState<{ x: number; y: number } | null>(null);
  const [dragPreviewOffset, setDragPreviewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const isVertical = settings.orientation === 'vertical';
  const nodeHeight = NODE_HEIGHT_MAP[settings.nodeSize] ?? NODE_HEIGHT;

  // Calculate layout whenever data or orientation changes
  useEffect(() => {
    const { nodes, links } = calculateTreeLayout(data, settings.orientation, nodeHeight);
    setLayout({ nodes, links });
  }, [data, settings.orientation, nodeHeight]);

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

  const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((id, idx) => id === b[idx]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    window.getSelection()?.removeAllRanges();
    suppressClickRef.current = false;
    setHasDragMoved(false);
    setDragPreviewOffset({ x: 0, y: 0 });

    // Background click -> Pan
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('svg')) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      setDragStartMousePos({ x: e.clientX, y: e.clientY });
      onSelect(null);
      onEditEnd();
    }
  };

  const getWorldPosition = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    };
  };

  const isInDraggedSubtree = (candidateId: string, draggedId: string) => {
    const root = data.nodes[draggedId];
    if (!root) return false;
    const stack = [...root.children];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === candidateId) return true;
      const currentNode = data.nodes[current];
      if (currentNode) {
        stack.push(...currentNode.children);
      }
    }
    return false;
  };

  const findDropTarget = (worldX: number, worldY: number, draggedId: string) => {
    const draggedNode = data.nodes[draggedId];
    if (!draggedNode) return null;
    const padding = 8;

    const candidate = layout.nodes.find((node) => {
      if (node.id === draggedId) return false;
      if (node.id === draggedNode.parentId) return false;
      if (isInDraggedSubtree(node.id, draggedId)) return false;

      const halfW = NODE_WIDTH / 2 + padding;
      const halfH = nodeHeight / 2 + padding;
      return Math.abs(worldX - node.x) <= halfW && Math.abs(worldY - node.y) <= halfH;
    });

    return candidate?.id ?? null;
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      suppressClickRef.current = false;

      // Check if it's a root node in our layout
      const node = layout.nodes.find(n => n.id === nodeId);
      if (!node) return;

      setHasDragMoved(false);
      setDragPreviewOffset({ x: 0, y: 0 });
      setDraggedNodeId(nodeId);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      setDragStartMousePos({ x: e.clientX, y: e.clientY });
      setDragStartNodePos({ x: node.x, y: node.y });

      if (!node.parentId) {
        setDragMode('root');
        setDraggedParentId(null);
      } else {
        setDragMode('reorder');
        setDraggedParentId(node.parentId);
        setHasSiblingReordered(false);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    const totalDx = e.clientX - dragStartMousePos.x;
    const totalDy = e.clientY - dragStartMousePos.y;
    setLastMousePos({ x: e.clientX, y: e.clientY });

    if ((isPanning || draggedNodeId) && !hasDragMoved) {
      const movedDistance = Math.hypot(totalDx, totalDy);
      if (movedDistance > DRAG_THRESHOLD) {
        setHasDragMoved(true);
      }
    }

    if (isPanning) {
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setDragPreviewOffset({ x: 0, y: 0 });
      setDropTargetId(null);
    } else if (draggedNodeId && dragMode === 'root') {
        const node = layout.nodes.find(n => n.id === draggedNodeId);
        if (node) {
            const worldDx = dx / viewport.scale;
            const worldDy = dy / viewport.scale;
            
            const currentRootData = node.data; 
            const currentX = currentRootData.x || 0;
            const currentY = currentRootData.y || 0;

            onMoveRoot(draggedNodeId, currentX + worldDx, currentY + worldDy);
        }
        setDragPreviewOffset({ x: 0, y: 0 });
    } else if (draggedNodeId && dragMode === 'reorder' && draggedParentId) {
        const node = layout.nodes.find(n => n.id === draggedNodeId);
        const parent = data.nodes[draggedParentId];
        if (!node || !parent || !dragStartNodePos) return;

        const worldDx = totalDx / viewport.scale;
        const worldDy = totalDy / viewport.scale;
        const projectedAxis = isVertical ? dragStartNodePos.x + worldDx : dragStartNodePos.y + worldDy;

        const siblings = layout.nodes.filter(n => n.parentId === draggedParentId);
        if (siblings.length <= 1 || parent.children.length <= 1) return;

        const reordered = siblings
          .map((sib) => ({
            id: sib.id,
            axis: sib.id === draggedNodeId ? projectedAxis : (isVertical ? sib.x : sib.y),
            originalIndex: parent.children.indexOf(sib.id)
          }))
          .sort((a, b) => (a.axis === b.axis ? a.originalIndex - b.originalIndex : a.axis - b.axis))
          .map(item => item.id);

        if (!arraysEqual(reordered, parent.children)) {
          onReorderChildren(draggedParentId, reordered);
          setHasSiblingReordered(true);
        }

        const currentAxis = isVertical ? node.x : node.y;
        const axisDelta = projectedAxis - currentAxis;
        setDragPreviewOffset(isVertical ? { x: axisDelta, y: 0 } : { x: 0, y: axisDelta });
    } else {
        setDragPreviewOffset({ x: 0, y: 0 });
    }

    if (draggedNodeId) {
      const worldPos = getWorldPosition(e.clientX, e.clientY);
      if (worldPos) {
        const targetId = findDropTarget(worldPos.x, worldPos.y, draggedNodeId);
        setDropTargetId(targetId);
      }
    } else if (dropTargetId) {
      setDropTargetId(null);
    }
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    const draggedNodeParent = draggedNodeId ? data.nodes[draggedNodeId]?.parentId ?? null : null;
    let targetId = dropTargetId;
    if (draggedNodeId && e) {
      const worldPos = getWorldPosition(e.clientX, e.clientY);
      if (worldPos) {
        targetId = findDropTarget(worldPos.x, worldPos.y, draggedNodeId);
      }
    }

    if (draggedNodeId && targetId && targetId !== draggedNodeParent) {
      onReparentNode(draggedNodeId, targetId);
    } else if (dragMode === 'reorder' && hasSiblingReordered) {
      onCommitReorder();
    }

    suppressClickRef.current = hasDragMoved;
    if (hasDragMoved) {
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    setIsPanning(false);
    setDraggedNodeId(null);
    setDraggedParentId(null);
    setDragMode(null);
    setHasSiblingReordered(false);
    setHasDragMoved(false);
    setDragStartNodePos(null);
    setDragPreviewOffset({ x: 0, y: 0 });
    setDropTargetId(null);
  };

  // 防止拖拽松手时触发点击选择
  const handleClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  // Path Generators: Connect from edge to edge (Top/Bottom or Left/Right)
  const getPath = (source: LayoutNode, target: LayoutNode) => {
    const sourceHalfH = nodeHeight / 2;
    const sourceHalfW = NODE_WIDTH / 2;
    const targetHalfH = nodeHeight / 2;
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
      onClickCapture={handleClickCapture}
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
              isDragging={draggedNodeId === node.id && hasDragMoved}
              dragOffset={draggedNodeId === node.id && hasDragMoved ? dragPreviewOffset : { x: 0, y: 0 }}
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
              nodeHeight={nodeHeight}
              isDropTarget={dropTargetId === node.id}
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
