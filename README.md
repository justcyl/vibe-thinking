# Vibe-Thinking

一个可视化思维导图白板，支持多画布管理与 AI 头脑风暴生成。

## 快速开始

1. 配置环境变量（`.env`）

```bash
ANTHROPIC_AUTH_TOKEN=sk-ant-api03-your-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
PORT=3001
VITE_API_BASE_URL=http://localhost:3001
```

2. 安装依赖并启动

```bash
npm install
npm run dev:full
```

3. 访问应用

浏览器打开 http://localhost:5173

## 主要命令

```bash
npm run dev       # 仅前端
npm run server    # 仅后端
npm run dev:full  # 同时启动前后端
```

## 主要 API

- `GET /health`：服务健康检查
- `GET /api/storage/canvases`：读取画布
- `PUT /api/storage/canvases`：保存画布
- `POST /api/brainstorm`：AI 头脑风暴生成节点

## 项目结构

```
index.tsx          # 入口
App.tsx            # 应用装载
components/        # 复用组件
views/             # 页面视图
viewmodels/        # 视图模型
services/          # API 请求封装
server/            # 后端服务
utils/             # 布局与工具
```
