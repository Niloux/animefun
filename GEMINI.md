# Gemini 项目背景：animefun

## 项目概述

本项目 "animefun" 是一个使用 Tauri、React 和 TypeScript 构建的桌面应用程序。它似乎是一个用于浏览、搜索和管理动漫信息与资源的应用程序。

- **前端：** 前端使用 React 和 TypeScript 构建，并使用 Vite 进行开发和打包。它利用了 Radix UI 的多种 UI 组件，并使用 Tailwind CSS 设计样式。路由由 `react-router-dom` 处理。状态管理可能由 `@tanstack/react-query` 负责。
- **后端：** 后端使用 Rust 编写，并通过 Tauri 与前端集成。它向前端暴露了多个命令，用于获取动漫日历、剧集、搜索条目、管理订阅和缓存图片等功能。
- **架构：** 该应用程序遵循现代 Web 开发架构，拥有独立的前端和后端，它们通过 Tauri API 进行通信。前端是一个单页应用（SPA），具有多个用于不同视图的路由。后端处理原生功能，如文件系统访问（用于缓存）和进行外部 API 调用。

## 构建与运行

### 开发

要以开发模式运行应用程序：

```bash
pnpm dev
```

这将启动用于前端的 Vite 开发服务器和 Tauri 开发环境。

### 生产构建

要为生产环境构建应用程序：

```bash
pnpm build
```

这将创建前端的生产就绪版本，然后使用 Tauri 将其打包成本地桌面应用程序。

### 代码检查与格式化

要检查代码：

```bash
pnpm lint
```

要格式化代码：

```bash
pnpm format
```

### 类型生成

要从后端生成类型：

```bash
pnpm types:gen
```

## 开发约定

- **语言：** 前端使用 TypeScript，后端使用 Rust。
- **样式：** 使用 Tailwind CSS 进行样式设计。
- **UI 组件：** 项目使用了自定义组件和位于 `src/components/ui` 的 Radix UI 组件的组合。
- **状态管理：** 使用 `@tanstack/react-query` 管理服务器状态。
- **API：** 前端通过 `@tauri-apps/api` 的 `invoke` 函数与 Rust 后端通信。可用的后端命令在 `src-tauri/src/lib.rs` 中定义。
- **路由：** 使用 `react-router-dom` 进行客户端路由。路由在 `src/App.tsx` 中定义。
- **懒加载：** 为了更好的性能，页面采用懒加载方式，如 `src/lib/lazy-pages.ts` 所示。