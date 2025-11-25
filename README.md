<div align="center">
  <img src="src/assets/ikuyo-avatar.png" width="150" alt="Ikuyo Logo">
  <h1>AnimeFun</h1>
  <p>一站式本地追番客户端：订阅、日历、剧集与资源聚合，专注快速、稳定、可离线。</p>
  <p>专为希望自动化追番流程、聚合资源并在一个地方完成所有操作的动漫爱好者打造。</p>
</div>

<p align="center">
  <a href="https://github.com/Niloux/ikuyo-tauri/actions/workflows/tauri-build.yml"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/Niloux/ikuyo-tauri/tauri-build.yml?branch=main&style=for-the-badge"></a>
  <a href="https://github.com/Niloux/ikuyo-tauri/releases/latest"><img alt="Latest Release" src="https://img.shields.io/github/v/release/Niloux/ikuyo-tauri?style=for-the-badge&color=blue"></a>
  <a href="https://github.com/Niloux/ikuyo-tauri/releases"><img alt="Total Downloads" src="https://img.shields.io/github/downloads/Niloux/ikuyo-tauri/total?style=for-the-badge&color=green"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge"></a>
</p>

## 应用截图

- 首页（日历与更新）：

  ![Home](docs/screenshots/home.png)

- 订阅列表（过滤与搜索）：

  ![Subscriptions](docs/screenshots/subscriptions.png)

- 番剧详情（信息与标签）：

  ![Detail](docs/screenshots/detail.png)

- 资源聚合（Mikan RSS）：

  ![Resources](docs/screenshots/resources.png)

## 特性

- 订阅管理：一键收藏/取消、批量清理、后台周期性刷新索引（10 分钟轮询）
- 高级搜索：对接 Bangumi 搜索，支持类型、评分、标签、排序等过滤
- 番剧日历：本周更新一目了然，点击直达详情与剧集
- 资源聚合：解析并聚合 Mikan RSS 资源，关联剧集快速定位
- 本地缓存：图片与 RSS 智能缓存，过期自动清理，离线可用
- 现代 UI：基于 shadcn-ui/Radix + Tailwind v4，响应式布局与骨架屏
- 稳定架构：前端 React 19 + React Query；后端 Tauri 2 + Rust

## 快速开始（macOS）

- 前置依赖：`pnpm`、Node 20+、Rust toolchain、Xcode Command Line Tools
- 安装依赖：`pnpm install`
- 开发（桌面应用）：`pnpm tauri dev`
- 仅前端预览：`pnpm dev`
- 构建发行包：`pnpm tauri build`

## 常用脚本

- `pnpm lint` 代码检查（ESLint 9）
- `pnpm types:gen` 从 Rust 通过测试导出 TS 类型（ts-rs）
- `pnpm build` 生产构建（`tsc && vite build`）

## 目录结构

- `src/` 前端 UI、路由与业务逻辑（搜索、订阅、资源、详情等）
- `src/components/ui/` 基础 UI 组件（shadcn 风格封装）
- `src/pages/` 页面模块（`Home`、`Search`、`Subscribe`、`Resources`、`AnimeDetail`、`Settings`）
- `src/lib/` 前端工具层（API 调用、分页、懒加载、查询客户端）
- `src/types/gen/` Rust 自动导出到 TS 的类型定义
- `src-tauri/` Rust 后端（命令、服务、订阅并发刷新、缓存、DB 等）
- `docs/bangumi_api.yml` Bangumi OpenAPI 规范

## 数据与隐私

- 存储位置：`~/.animefun`（SQLite `data.sqlite`/`cache.sqlite` 与 `images/` 缓存）
- 网络来源：Bangumi API、Mikan RSS；仅本地缓存，不上传个人数据

## 技术栈

- 前端：React 19、React Router、React Query、Tailwind v4、shadcn-ui
- 后端：Tauri 2、Rust、SQLite（deadpool_sqlite）、reqwest、tracing
- 类型：ts-rs 自动生成前后端共享类型

## 致谢

- Bangumi 社区与开放 API
- Mikan Project与 RSS 服务
- shadcn-ui/Radix 团队
- tauri 团队与贡献者
