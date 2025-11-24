import {
  addNode,
  deleteNode,
  getFormattedContextString,
  getFormattedGlobalContextString,
  getLayoutBounds,
  serializeForestForAgent,
  serializeProjectForExport,
  updateNode
} from '@/utils/layout';
import { NODE_HEIGHT, NODE_WIDTH } from '@/constants';
import { LayoutNode, MindMapNode, MindMapProject, NodeType } from '@/types';

const createProject = (): MindMapProject => ({
  nodes: {
    root: {
      id: 'root',
      type: NodeType.TOPIC,
      content: '主议题',
      parentId: null,
      children: ['child_action', 'child_evidence'],
      x: 0,
      y: 0
    },
    child_action: {
      id: 'child_action',
      type: NodeType.ACTION,
      content: '行动节点',
      parentId: 'root',
      children: []
    },
    child_evidence: {
      id: 'child_evidence',
      type: NodeType.EVIDENCE,
      content: '证据节点',
      parentId: 'root',
      children: ['grandchild']
    },
    grandchild: {
      id: 'grandchild',
      type: NodeType.HYPOTHESIS,
      content: '假设节点',
      parentId: 'child_evidence',
      children: []
    }
  },
  rootIds: ['root']
});

const createNode = (overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id: 'new_node',
  type: NodeType.PROBLEM,
  content: '新增节点',
  parentId: 'root',
  children: [],
  ...overrides
});

describe('layout utils mutations', () => {
  it('adds new child nodes immutably', () => {
    const project = createProject();
    const nodeToAdd = createNode();
    const updated = addNode(project, nodeToAdd);

    expect(updated).not.toBe(project);
    expect(updated.nodes[nodeToAdd.id]).toMatchObject({
      id: nodeToAdd.id,
      parentId: 'root'
    });
    expect(updated.nodes.root.children).toContain(nodeToAdd.id);
    expect(project.nodes.root.children).not.toContain(nodeToAdd.id);
  });

  it('supports adding additional roots when parentId为空', () => {
    const project = createProject();
    const nodeToAdd = createNode({ id: 'floating', parentId: null });
    const updated = addNode(project, nodeToAdd);

    expect(updated.rootIds).toContain('floating');
    expect(project.rootIds).not.toContain('floating');
  });

  it('updates nodes via回调并保持其他引用不变', () => {
    const project = createProject();
    const updated = updateNode(project, 'child_action', () => ({ content: '更新后的行动' }));

    expect(updated.nodes.child_action.content).toBe('更新后的行动');
    expect(project.nodes.child_action.content).toBe('行动节点');
  });

  it('删除节点时会同步移除子树与父引用', () => {
    const project = createProject();
    const updated = deleteNode(project, 'child_evidence');

    expect(updated.nodes.child_evidence).toBeUndefined();
    expect(updated.nodes.grandchild).toBeUndefined();
    expect(updated.nodes.root.children).not.toContain('child_evidence');
  });
});

describe('layout path helpers', () => {
  it('格式化上下文路径时保持节点顺序', () => {
    const project = createProject();
    const context = getFormattedContextString(project, 'grandchild');

    expect(context).toBe('[topic] 主议题 -> [evidence] 证据节点 -> [hypothesis] 假设节点');
  });

  it('输出全局上下文文本树', () => {
    const project = createProject();
    const globalContext = getFormattedGlobalContextString(project);
    const expected = `[topic] 主议题
├── [action] 行动节点
└── [evidence] 证据节点
    └── [hypothesis] 假设节点

`;

    expect(globalContext).toBe(expected);
  });
});

describe('layout utilities', () => {
  it('导出项目时遵循节点映射结构', () => {
    const project = createProject();
    const snapshot = serializeProjectForExport(project);

    expect(snapshot.rootIds).toEqual(project.rootIds);
    expect(snapshot.nodes.root).toEqual({
      id: 'root',
      type: NodeType.TOPIC,
      content: '主议题',
      children: ['child_action', 'child_evidence']
    });
    expect((snapshot.nodes.root as any).parentId).toBeUndefined();
  });

  it('根据节点坐标计算导出边界', () => {
    const project = createProject();
    const nodes: LayoutNode[] = [
      {
        id: 'root',
        type: NodeType.TOPIC,
        content: '主议题',
        x: 0,
        y: 0,
        parentId: null,
        depth: 0,
        data: project.nodes.root
      },
      {
        id: 'child_action',
        type: NodeType.ACTION,
        content: '行动节点',
        x: 300,
        y: 200,
        parentId: 'root',
        depth: 1,
        data: project.nodes.child_action
      }
    ];

    const padding = 50;
    const bounds = getLayoutBounds(nodes, padding);

    const minX = Math.min(
      -NODE_WIDTH / 2,
      300 - NODE_WIDTH / 2
    );
    const maxX = Math.max(
      NODE_WIDTH / 2,
      300 + NODE_WIDTH / 2
    );
    const minY = Math.min(
      -NODE_HEIGHT / 2,
      200 - NODE_HEIGHT / 2
    );
    const maxY = Math.max(
      NODE_HEIGHT / 2,
      200 + NODE_HEIGHT / 2
    );

    expect(bounds).toEqual({
      x: minX - padding,
      y: minY - padding,
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2
    });
  });

  it('序列化森林数据供 Agent 使用', () => {
    const project = createProject();
    const serialized = serializeForestForAgent(project);

    const expectedEntries = Object.values(project.nodes).map(({ id, parentId, type, content }) => ({
      id,
      parentId,
      type,
      content
    }));

    expect(serialized).toEqual(expectedEntries);
    expect(serialized).toHaveLength(expectedEntries.length);
  });
});
