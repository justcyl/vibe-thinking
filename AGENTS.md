# Repository Guidelines

## 项目结构与模块组织 Project Structure
主入口 `index.tsx` -> `App.tsx` 装载思维白板与 Agent 侧栏。复用组件位于 `components/`（`Whiteboard.tsx`, `NodeItem.tsx`, `AgentPanel.tsx`），配合 `types.ts` 中的 `MindMapProject`、`NodeType` 模型和 `constants.ts` 的标签/提示。布局与历史栈操作集中在 `utils/layout.ts`，所有 Gemini 交互实现在 `services/geminiService.ts` 并读取 `process.env.API_KEY`。`vite.config.ts` 定义构建入口，`index.html` 提供静态骨架，AI Studio 关联信息位于 `metadata.json`。

## 构建、测试与开发命令 Build & Dev Commands
使用 Node 18+。在 Codex CLI 中运行项目时，请一律通过名称固定为 `vibe-thinking` 的 tmux session 启动并用非交互方式查看日志：
1. `tmux has-session -t vibe-thinking || tmux new-session -d -s vibe-thinking 'npm run dev'`（避免重复创建出错）。
2. 通过 `tmux capture-pane -t vibe-thinking -p` 查看输出。
3. 结束服务用 `tmux kill-session -t vibe-thinking`。


## 代码风格与命名 Coding Style
采用 TypeScript + React 19 函数组件，缩进 2 空格，`const` + hooks 顺序保持“状态 -> 回调 -> 渲染”。组件、类型命名使用 PascalCase（如 `AgentPanel`, `MindMapNode`），变量与函数保持 camelCase，常量/枚举用 UPPER_SNAKE_CASE（`LABELS`, `NodeType`）。引入路径优先使用 `@/` 别名（参见 `tsconfig.json`），prop 顺序遵循“数据 → 回调 → 样式”。仅在复杂逻辑处添加简洁中文注释以维持可读性。

## 测试与验证 Testing Guidelines
Vitest 负责基础回归（目前聚焦 `utils/layout.ts`），运行 `npm run test` 保持通过；新增模块时请在同级目录补充 `*.test.ts(x)`。若需 UI 行为校验，可使用 Testing Library（`@testing-library/react` + `@testing-library/user-event`）。除自动化外，仍需在 PR 描述中记录 `npm run dev` 下的手动验证结果（节点增删、撤销/重做、Agent 反馈、PNG 导出与交互性能）。确保 `services/geminiService.ts` 在缺失密钥时返回可读错误，以便前端优雅降级。

## 提交与 PR 准则 Commit & PR Guidelines
Git 历史接近 Conventional Commits（示例：`feat: Initialize Vibe-thinking project structure`），请沿用 `type: short-summary` 并在正文补充动机、风险与回退计划。PR 描述需包含：需求或 Issue 链接、变更摘要、截图/GIF（所有 UI 变更必填）、执行命令及结果、相关配置步骤（例如如何设置 `API_KEY`）。保持 PR 聚焦单一主题，并说明如何在 AI Studio 中复现和验证。
