
import * as d3 from 'd3-hierarchy';
import { MindMapProject, MindMapNode, LayoutNode, LayoutLink, Orientation, NodeType, MindMapSnapshot } from '../types';
import { NODE_WIDTH, NODE_HEIGHT } from '../constants';

// --- ID Generation ---
const NODE_ID_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NODE_ID_DIGITS = '0123456789';
const NODE_ID_CHARSET = `${NODE_ID_LETTERS}${NODE_ID_DIGITS}`;
const NODE_ID_LENGTH = 6;
const NODE_ID_MAX_ATTEMPTS = 1000;

/**
 * 生成随机 6 位节点 ID，保证在给定集合中唯一。
 */
export const generateNodeId = (existingIds?: Set<string> | string[]): string => {
  const usedIds = existingIds instanceof Set ? existingIds : new Set(existingIds ?? []);
  let attempt = 0;
  let candidate = '';

  const cryptoRef: Crypto | null =
    typeof crypto !== 'undefined' && crypto?.getRandomValues ? crypto : null;

  const getRandomIndex = (max: number): number => {
    if (cryptoRef) {
      const array = new Uint8Array(1);
      let rand = 0;
      do {
        cryptoRef.getRandomValues(array);
        rand = array[0];
      } while (rand >= 256 - (256 % max));
      return rand % max;
    }
    return Math.floor(Math.random() * max);
  };

  const createCandidate = () => {
    const chars: string[] = [];
    for (let i = 0; i < NODE_ID_LENGTH; i++) {
      chars.push(NODE_ID_CHARSET[getRandomIndex(NODE_ID_CHARSET.length)]);
    }
    return chars.join('');
  };

  do {
    if (attempt >= NODE_ID_MAX_ATTEMPTS) {
      throw new Error('无法生成唯一节点 ID');
    }
    candidate = createCandidate();
    attempt += 1;
  } while (usedIds.has(candidate));

  usedIds.add(candidate);
  return candidate;
};

// --- D3 Integration ---
// We need to construct a hierarchy object that D3 understands from our flat map
interface D3Data extends MindMapNode {
    childrenRefs?: D3Data[]; // Helper for D3 construction
}

export const calculateTreeLayout = (
  project: MindMapProject, 
  orientation: Orientation,
  nodeHeight: number = NODE_HEIGHT
): { nodes: LayoutNode[], links: LayoutLink[] } => {
  
  let allNodes: LayoutNode[] = [];
  let allLinks: LayoutLink[] = [];

  const isVertical = orientation === 'vertical';
  
  // Compact Spacing configurations
  const nodeSize: [number, number] = isVertical 
    ? [NODE_WIDTH * 1.1, nodeHeight * 1.5] 
    : [nodeHeight * 1.5, NODE_WIDTH * 1.2];

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

/**
 * 重新排序父节点的 children 列表，保持集合一致。
 */
export const reorderChildren = (
  project: MindMapProject,
  parentId: string,
  orderedChildIds: string[]
): MindMapProject => {
  const parent = project.nodes[parentId];
  if (!parent) return project;

  const currentChildren = parent.children;
  if (currentChildren.length !== orderedChildIds.length) return project;

  const sameSet =
    orderedChildIds.every((id) => currentChildren.includes(id)) &&
    currentChildren.every((id) => orderedChildIds.includes(id));
  if (!sameSet) return project;

  const noChange = currentChildren.every((id, index) => id === orderedChildIds[index]);
  if (noChange) return project;

  return {
    ...project,
    nodes: {
      ...project.nodes,
      [parentId]: {
        ...parent,
        children: [...orderedChildIds],
      },
    },
  };
};

const collectDescendants = (project: MindMapProject, nodeId: string, acc: Set<string>) => {
  const node = project.nodes[nodeId];
  if (!node) return acc;
  node.children.forEach((childId) => {
    if (acc.has(childId)) return;
    acc.add(childId);
    collectDescendants(project, childId, acc);
  });
  return acc;
};

/**
 * 将节点嫁接到新的父节点下，保证树结构无环。
 */
export const reparentNode = (
  project: MindMapProject,
  nodeId: string,
  newParentId: string | null,
  position?: number
): MindMapProject => {
  const node = project.nodes[nodeId];
  if (!node) return project;
  if (newParentId === node.parentId) return project;
  if (newParentId === nodeId) return project;

  if (newParentId) {
    const targetParent = project.nodes[newParentId];
    if (!targetParent) return project;
    const descendants = collectDescendants(project, nodeId, new Set<string>());
    if (descendants.has(newParentId)) {
      // 避免将节点挂到自己的子树下导致环
      return project;
    }
  }

  const newNodes = { ...project.nodes };
  let newRootIds = [...project.rootIds];

  if (node.parentId) {
    const oldParent = newNodes[node.parentId];
    if (oldParent) {
      newNodes[node.parentId] = {
        ...oldParent,
        children: oldParent.children.filter((id) => id !== nodeId),
      };
    }
  } else {
    newRootIds = newRootIds.filter((id) => id !== nodeId);
  }

  const updatedNode: MindMapNode = {
    ...node,
    parentId: newParentId,
    ...(newParentId === null ? { x: node.x ?? 0, y: node.y ?? 0 } : {}),
  };
  newNodes[nodeId] = updatedNode;

  if (newParentId) {
    const parent = newNodes[newParentId];
    if (!parent) return project;
    const safePosition = Math.max(0, Math.min(position ?? parent.children.length, parent.children.length));
    const newChildren = parent.children.filter((id) => id !== nodeId);
    newChildren.splice(safePosition, 0, nodeId);
    newNodes[newParentId] = { ...parent, children: newChildren };
  } else if (!newRootIds.includes(nodeId)) {
    newRootIds.push(nodeId);
  }

  return {
    nodes: newNodes,
    rootIds: newRootIds,
  };
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
export const getLayoutBounds = (nodes: LayoutNode[], padding: number = 100, nodeHeight: number = NODE_HEIGHT) => {
    if (nodes.length === 0) return { x: 0, y: 0, width: 800, height: 600 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        // Assume node.x and node.y are center points based on NodeItem styling
        minX = Math.min(minX, node.x - NODE_WIDTH / 2);
        maxX = Math.max(maxX, node.x + NODE_WIDTH / 2);
        minY = Math.min(minY, node.y - nodeHeight / 2);
        maxY = Math.max(maxY, node.y + nodeHeight / 2);
    });

    return {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2)
    };
};

/**
 * 导出保存时仅保留节点树必要字段。
 */
export const serializeProjectForExport = (project: MindMapProject): MindMapSnapshot => {
  const nodes = Object.values(project.nodes).reduce<MindMapSnapshot['nodes']>((acc, node) => {
    acc[node.id] = {
      id: node.id,
      type: node.type,
      content: node.content,
      children: [...node.children],
    };
    return acc;
  }, {});

  return {
    nodes,
    rootIds: [...project.rootIds],
  };
};
