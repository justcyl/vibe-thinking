
import { NodeType, MindMapProject, NodeSize, ModelOption } from './types';
import { Lightbulb, Search, Box, AlertCircle, Play, Paperclip, AtSign, File, GripVertical } from 'lucide-react';

// Minimalist Dark Theme with Colored Headers - Updated for vibrancy
const DARK_COLORS = {
  [NodeType.TOPIC]: {
    bg: 'bg-[#18181b]', // zinc-950/black
    border: 'border-purple-500/30',
    text: 'text-neutral-200',
    headerBg: 'bg-[#7c3aed]', // violet-600
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-[#7c3aed]',
  },
  [NodeType.PROBLEM]: {
    bg: 'bg-[#18181b]',
    border: 'border-orange-500/30',
    text: 'text-neutral-200',
    headerBg: 'bg-[#ea580c]', // orange-600
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-[#ea580c]',
  },
  [NodeType.HYPOTHESIS]: {
    bg: 'bg-[#18181b]',
    border: 'border-sky-500/30',
    text: 'text-neutral-200',
    headerBg: 'bg-[#0ea5e9]', // sky-500
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-[#0ea5e9]',
  },
  [NodeType.ACTION]: {
    bg: 'bg-[#18181b]',
    border: 'border-rose-500/30',
    text: 'text-neutral-200',
    headerBg: 'bg-[#e11d48]', // rose-600
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-[#e11d48]',
  },
  [NodeType.EVIDENCE]: {
    bg: 'bg-[#18181b]',
    border: 'border-emerald-500/30',
    text: 'text-neutral-200',
    headerBg: 'bg-[#059669]', // emerald-600
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-[#059669]',
  },
};

// Minimalist Light Theme with Colored Headers
const LIGHT_COLORS = {
  [NodeType.TOPIC]: {
    bg: 'bg-white',
    border: 'border-purple-200',
    text: 'text-black',
    headerBg: 'bg-purple-600',
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-purple-600',
  },
  [NodeType.PROBLEM]: {
    bg: 'bg-white',
    border: 'border-orange-200',
    text: 'text-black',
    headerBg: 'bg-orange-600',
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-orange-600',
  },
  [NodeType.HYPOTHESIS]: {
    bg: 'bg-white',
    border: 'border-sky-200',
    text: 'text-black',
    headerBg: 'bg-sky-600',
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-sky-600',
  },
  [NodeType.ACTION]: {
    bg: 'bg-white',
    border: 'border-rose-200',
    text: 'text-black',
    headerBg: 'bg-rose-600',
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-rose-600',
  },
  [NodeType.EVIDENCE]: {
    bg: 'bg-white',
    border: 'border-emerald-200',
    text: 'text-black',
    headerBg: 'bg-emerald-600',
    headerText: 'text-white',
    icon: 'text-white',
    indicator: 'bg-emerald-600',
  },
};

export const THEME_COLORS = {
  dark: DARK_COLORS,
  light: LIGHT_COLORS,
};

export const NODE_ICONS = {
  [NodeType.TOPIC]: Box,
  [NodeType.PROBLEM]: AlertCircle,
  [NodeType.HYPOTHESIS]: Lightbulb,
  [NodeType.ACTION]: Play,
  [NodeType.EVIDENCE]: Search,
};

export const TYPE_DESCRIPTIONS = {
  [NodeType.TOPIC]: {
    label: "TOPIC (主题)",
    syntax: "陈述句",
    definition: "思考的边界与上下文。你承诺要专注的范围。",
    example: "用户登录模块重构"
  },
  [NodeType.PROBLEM]: {
    label: "PROBLEM (难题/挑战)",
    syntax: "问句 (How/Why) 或 负面陈述",
    definition: "推进过程中的阻碍（Current Blocker）或预判风险（Future Risk）。",
    example: "如何在大流量下保证数据一致性？"
  },
  [NodeType.HYPOTHESIS]: {
    label: "HYPOTHESIS (假说/设想)",
    syntax: "陈述句 (断言/判断)",
    definition: "对 PROBLEM 的主观解答。脑海中的模拟运行，待验证。",
    example: "使用 Redis 分布式锁可以解决一致性问题。"
  },
  [NodeType.ACTION]: {
    label: "ACTION (行动/实验)",
    syntax: "祈使句 (动宾结构)",
    definition: "为验证 HYPOTHESIS 必须执行的动作。必须产出 Evidence。",
    example: "编写一个并发测试脚本模拟抢单。"
  },
  [NodeType.EVIDENCE]: {
    label: "EVIDENCE (事实/证据)",
    syntax: "陈述句 (客观结果)",
    definition: "执行 ACTION 后的客观结果。用于证实或证伪 HYPOTHESIS。",
    example: "脚本运行后，有 0.5% 的订单出现了超卖。"
  }
};

// Normalized Initial Data
export const INITIAL_DATA: MindMapProject = {
  nodes: {
    ROOT001: {
      id: 'ROOT001',
      type: NodeType.TOPIC,
      content: '新节点...',
      children: [],
      parentId: null,
      x: 0,
      y: 0
    }
  },
  rootIds: ['ROOT001']
};

// Fixed dimensions for compact view
export const NODE_WIDTH = 260; 
export const NODE_HEIGHT_MAP: Record<NodeSize, number> = {
  small: 120,
  medium: 140,
  large: 180,
};
export const NODE_HEIGHT = NODE_HEIGHT_MAP.medium;

export const LABELS = {
  appTitle: "Vibe-Thinking",
  aiPowered: "AI 驱动",
  viewSettings: "视图设置",
  theme: "主题",
  dark: "深色",
  light: "浅色",
  orientation: "排列方向",
  vertical: "纵向",
  horizontal: "横向",
  nodeSize: "节点高度",
  sizeSmall: "紧凑",
  sizeMedium: "适中",
  sizeLarge: "宽松",
  export: "导出",
  exportJson: "导出 JSON",
  nodeProperties: "节点属性",
  type: "类型",
  actions: "操作",
  brainstormAI: "AI 头脑风暴",
  thinking: "思考中...",
  deleteNode: "删除节点",
  cannotDeleteRoot: "无法直接删除根节点。请删除整棵树或清空内容。",
  newIdea: "新节点...",
  floatingNode: "添加游离节点",
  addFloating: "添加节点",
  resetView: "重置",
  noIdeas: "未生成想法，请尝试理清父节点内容。",
  failedConnect: "连接 AI 服务失败。",
  undo: "撤销",
  redo: "重做",
  copyContext: "复制上下文",
  contextCopied: "上下文已复制到剪贴板",
  copyGlobal: "复制全局上下文",
  globalCopied: "全局思维导图已复制",
  pressTab: "按 Tab 切换类型",
  myCanvases: "我的画布",
  newCanvas: "新建画布",
  untitledCanvas: "无标题画布",
  deleteCanvas: "删除",
  renameCanvas: "重命名",
  confirmDelete: "确认删除画布？",
  agentTitle: "思维助理",
  agentWelcome: "我是您的思维助理。输入指令或使用 @ 引用节点。",
  agentPlaceholder: "输入指令 / 使用 @ 引用节点...",
  agentSending: "正在处理...",
};

export const AGENT_ICONS = {
    Paperclip,
    AtSign,
    File,
    GripVertical
};

// --- Model Options ---
export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-5';
