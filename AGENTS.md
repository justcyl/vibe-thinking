# Repository Guidelines

## 项目结构与模块组织 Project Structure
主入口 `index.tsx` -> `App.tsx` 装载思维白板与 Agent 侧栏。复用组件位于 `components/`（`Whiteboard.tsx`, `NodeItem.tsx`, `AgentPanel.tsx`），配合 `types.ts` 中的 `MindMapProject`、`NodeType` 模型和 `constants.ts` 的标签/提示。布局与历史栈操作集中在 `utils/layout.ts`，所有 Gemini 交互实现在 `services/geminiService.ts` 并读取 `process.env.API_KEY`。`vite.config.ts` 定义构建入口，`index.html` 提供静态骨架，AI Studio 关联信息位于 `metadata.json`。

## 构建、测试与开发命令 Build & Dev Commands
使用 Node 18+。建议以仓库名+分支命名 tmux 会话：`SESSION=vibe-thinking-$(git rev-parse --abbrev-ref HEAD | tr '/' '-') && tmux new -As \"$SESSION\" 'npm run dev'`，不同仓库/分支会落在不同会话；重新附加执行 `tmux attach -t \"$SESSION\"`。`npm run build` 产出 `dist/`，`npm run preview` 用打包产物验证部署镜像。提交或发布前至少执行一次 build 以捕捉类型与打包错误。

## 代码风格与命名 Coding Style
采用 TypeScript + React 19 函数组件，缩进 2 空格，`const` + hooks 顺序保持“状态 -> 回调 -> 渲染”。组件、类型命名使用 PascalCase（如 `AgentPanel`, `MindMapNode`），变量与函数保持 camelCase，常量/枚举用 UPPER_SNAKE_CASE（`LABELS`, `NodeType`）。引入路径优先使用 `@/` 别名（参见 `tsconfig.json`），prop 顺序遵循“数据 → 回调 → 样式”。仅在复杂逻辑处添加简洁中文注释以维持可读性。

## 测试与验证 Testing Guidelines
目前没有自动化测试；每项改动需在 PR 中附上手动验证步骤：运行 `npm run dev`，检查节点增删、撤销/重做、Agent 回复与导出 PNG 是否正常。若引入 Vitest/Testing Library，请在被测模块旁创建 `ComponentName.test.tsx` 或 `utils/__tests__/layout.test.ts`，覆盖空树、无效 ID、API 失败等边界。确保 `services/geminiService.ts` 在缺失密钥时返回可读错误，以便前端优雅降级。

## 提交与 PR 准则 Commit & PR Guidelines
Git 历史接近 Conventional Commits（示例：`feat: Initialize IdeaFlow project structure`），请沿用 `type: short-summary` 并在正文补充动机、风险与回退计划。PR 描述需包含：需求或 Issue 链接、变更摘要、截图/GIF（所有 UI 变更必填）、执行命令及结果、相关配置步骤（例如如何设置 `API_KEY`）。保持 PR 聚焦单一主题，并说明如何在 AI Studio 中复现和验证。
