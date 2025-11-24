
import * as d3 from 'd3-hierarchy';
import { MindMapProject, MindMapNode, LayoutNode, LayoutLink, Orientation, NodeType } from '../types';
import { NODE_WIDTH, NODE_HEIGHT } from '../constants';

// --- ID Generation ---
export const generateNodeId = (): string => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// --- D3 Integration ---
// We need to construct a hierarchy object that D3 understands from our flat map
interface D3Data extends MindMapNode {
    childrenRefs?: D3Data[]; // Helper for D3 construction
}

export const calculateTreeLayout = (
  project: MindMapProject, 
  orientation: Orientation
): { nodes: LayoutNode[], links: LayoutLink[] } => {
  
  let allNodes: LayoutNode[] = [];
  let allLinks: LayoutLink[] = [];

  const isVertical = orientation === 'vertical';
  
  // Compact Spacing configurations
  const nodeSize: [number, number] = isVertical 
    ? [NODE_WIDTH * 1.1, NODE_HEIGHT * 1.5] 
    : [NODE_HEIGHT * 1.5, NODE_WIDTH * 1.2];

  // 1. Build D3 Hierarchy for each root
  project.rootIds.forEach(rootId => {
      const rootNode = project.nodes[rootId];
      if (!rootNode) return;

      // Recursive function to build the tree object for D3
      const buildHierarchy = (nodeId: string): D3Data | null => {
          const node = project.nodes[nodeId];
          if (!node) return null;
          
          const d3Node: D3Data = { ...node, childrenRefs: [] };
          
          if (node.children && node.children.length > 0) {
              d3Node.childrenRefs = node.children
                  .map(childId => buildHierarchy(childId))
                  .filter((n): n is D3Data => n !== null);
          }
          return d3Node;
      };

      const hierarchyData = buildHierarchy(rootId);
      if (!hierarchyData) return;

      const root = d3.hierarchy<D3Data>(hierarchyData, d => d.childrenRefs);
      
      const treeLayout = d3.tree<D3Data>()
        .nodeSize(nodeSize) 
        .separation((a, b) => (a.parent === b.parent ? 1.1 : 1.2));

      treeLayout(root);

      // Get the tree's root offset
      const offsetX = rootNode.x || 0;
      const offsetY = rootNode.y || 0;

      root.descendants().forEach((d) => {
        let x, y;

        // d3.tree returns x as the breadth variable and y as depth
        if (isVertical) {
          x = d.x + offsetX;
          y = d.y + offsetY;
        } else {
          // Horizontal: depth (y) becomes X, breadth (x) becomes Y
          x = d.y + offsetX;
          y = d.x + offsetY;
        }

        allNodes.push({
          id: d.data.id,
          type: d.data.type,
          content: d.data.content,
          x: x, 
          y: y,
          parentId: d.parent?.data.id || null,
          data: project.nodes[d.data.id], // Reference back to the flat store
          depth: d.depth,
        });
      });

      root.links().forEach((link) => {
        const sourceNode = allNodes.find(n => n.id === link.source.data.id)!;
        const targetNode = allNodes.find(n => n.id === link.target.data.id)!;
        if(sourceNode && targetNode) {
            allLinks.push({
                source: sourceNode,
                target: targetNode
            });
        }
      });
  });

  return { nodes: allNodes, links: allLinks };
};

// --- CRUD Operations (Immutable) ---

export const addNode = (
  project: MindMapProject,
  newNode: MindMapNode
): MindMapProject => {
    const newProject = { 
        nodes: { ...project.nodes, [newNode.id]: newNode },
        rootIds: [...project.rootIds]
    };

    if (newNode.parentId) {
        const parent = newProject.nodes[newNode.parentId];
        if (parent) {
            newProject.nodes[newNode.parentId] = {
                ...parent,
                children: [...parent.children, newNode.id]
            };
        }
    } else {
        // It's a root
        newProject.rootIds.push(newNode.id);
    }
    return newProject;
};

export const updateNode = (
  project: MindMapProject,
  nodeId: string,
  updater: (node: MindMapNode) => Partial<MindMapNode>
): MindMapProject => {
    const node = project.nodes[nodeId];
    if (!node) return project;

    const changes = updater(node);
    return {
        ...project,
        nodes: {
            ...project.nodes,
            [nodeId]: { ...node, ...changes }
        }
    };
};

export const deleteNode = (
  project: MindMapProject,
  nodeId: string
): MindMapProject => {
    const nodeToDelete = project.nodes[nodeId];
    if (!nodeToDelete) return project;

    const newNodes = { ...project.nodes };
    const newRootIds = [...project.rootIds];

    // 1. Remove from parent's children list OR rootIds
    if (nodeToDelete.parentId) {
        const parent = newNodes[nodeToDelete.parentId];
        if (parent) {
            newNodes[nodeToDelete.parentId] = {
                ...parent,
                children: parent.children.filter(id => id !== nodeId)
            };
        }
    } else {
        const rootIndex = newRootIds.indexOf(nodeId);
        if (rootIndex !== -1) newRootIds.splice(rootIndex, 1);
    }

    // 2. Recursively identify all descendants to remove
    const idsToRemove = new Set<string>();
    const collectIds = (id: string) => {
        idsToRemove.add(id);
        const node = newNodes[id];
        if (node && node.children) {
            node.children.forEach(childId => collectIds(childId));
        }
    };
    collectIds(nodeId);

    // 3. Delete from lookup table
    idsToRemove.forEach(id => {
        delete newNodes[id];
    });

    return {
        nodes: newNodes,
        rootIds: newRootIds
    };
};

export const updateRootPosition = (
    project: MindMapProject,
    rootId: string,
    x: number,
    y: number
): MindMapProject => {
    return updateNode(project, rootId, () => ({ x, y }));
};

// --- Helpers ---

export const getParentId = (project: MindMapProject, nodeId: string): string | null => {
    return project.nodes[nodeId]?.parentId || null;
};

export const getPathToNode = (project: MindMapProject, nodeId: string): string[] | null => {
    const path: string[] = [];
    let currentId: string | null = nodeId;
    
    // Safety break to prevent infinite loops in malformed graphs
    let depth = 0;
    const maxDepth = 1000;

    const nodePath: MindMapNode[] = [];

    while (currentId && depth < maxDepth) {
        const node = project.nodes[currentId];
        if (!node) break;
        nodePath.unshift(node); // Add to front
        currentId = node.parentId;
        depth++;
    }

    return nodePath.map(n => `[${n.type}] ${n.content}`);
};

export const getFormattedContextString = (project: MindMapProject, nodeId: string): string => {
    const path = getPathToNode(project, nodeId);
    return path ? path.join(' -> ') : "";
};

export const getContextJsonString = (project: MindMapProject, nodeId: string): string => {
    const path = [];
    let currentId: string | null = nodeId;
    
    // Safety break to prevent infinite loops in malformed graphs
    let depth = 0;
    const maxDepth = 1000;

    while (currentId && depth < maxDepth) {
        const node = project.nodes[currentId];
        if (!node) break;
        // Include full node details for consistency
        path.unshift({ 
            id: node.id,
            type: node.type, 
            content: node.content,
            parentId: node.parentId
        });
        currentId = node.parentId;
        depth++;
    }

    return JSON.stringify(path, null, 2);
};

// Generate Global Context String (Text Tree)
export const getFormattedGlobalContextString = (project: MindMapProject): string => {
    let result = "";
    
    const traverse = (nodeId: string, depth: number, prefix: string) => {
        const node = project.nodes[nodeId];
        if (!node) return;

        result += `${prefix}[${node.type}] ${node.content}\n`;
        
        if (node.children && node.children.length > 0) {
            const childPrefix = prefix.replace('└── ', '    ').replace('├── ', '│   ');
            node.children.forEach((childId, index) => {
                const isLast = index === node.children.length - 1;
                const pointer = isLast ? '└── ' : '├── ';
                traverse(childId, depth + 1, childPrefix + pointer);
            });
        }
    };

    project.rootIds.forEach((rootId) => {
        traverse(rootId, 0, "");
        result += "\n"; 
    });

    return result;
};

// Calculate total bounds of the layout for export
export const getLayoutBounds = (nodes: LayoutNode[], padding: number = 100) => {
    if (nodes.length === 0) return { x: 0, y: 0, width: 800, height: 600 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        // Assume node.x and node.y are center points based on NodeItem styling
        minX = Math.min(minX, node.x - NODE_WIDTH / 2);
        maxX = Math.max(maxX, node.x + NODE_WIDTH / 2);
        minY = Math.min(minY, node.y - NODE_HEIGHT / 2);
        maxY = Math.max(maxY, node.y + NODE_HEIGHT / 2);
    });

    return {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2)
    };
};

// --- Agent Helpers ---
export const serializeForestForAgent = (project: MindMapProject) => {
    return Object.values(project.nodes).map(node => ({
        id: node.id,
        parentId: node.parentId,
        type: node.type,
        content: node.content
    }));
};
