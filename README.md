<div align="center">

  <img src="src/assets/ikuyo-avatar.png" width="100" alt="AnimeFun">

  # AnimeFun

  本地追番客户端 · 订阅管理 · 日历 · 资源聚合

  [![Build](https://img.shields.io/github/actions/workflow/status/Niloux/animefun/tauri-build.yml?branch=main&style=flat-square)](https://github.com/Niloux/animefun/actions)
  [![Release](https://img.shields.io/github/v/release/Niloux/animefun?style=flat-square&color=blue)](https://github.com/Niloux/animefun/releases)
  [![License](https://img.shields.io/badge/license-MIT-success?style=flat-square)](LICENSE)

</div>

---

## 截图

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/home.png"></td>
    <td width="50%"><img src="docs/screenshots/subscriptions.png"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/detail.png"></td>
    <td width="50%"><img src="docs/screenshots/resources.png"></td>
  </tr>
</table>

---

## 功能

- **订阅管理** — 收藏番剧，后台自动刷新（10 分钟）
- **番剧日历** — 本周更新时间线
- **高级搜索** — 按 类型/评分/年份/标签 过滤
- **资源聚合** — 解析 Mikan RSS，关联剧集，支持添加到 qBittorrent/Transmission
- **本地缓存** — 图片与 RSS 数据缓存，离线可用
- **跨平台** — macOS / Linux / Windows

---

## 安装

下载 [Releases](https://github.com/Niloux/animefun/releases) 中的安装包：

| 平台   | 文件格式                           |
| ------ | ---------------------------------- |
| macOS  | `.dmg` / `.app.tar.gz`             |
| Linux  | `.AppImage` / `.deb` / `.rpm`      |
| Windows | `.msi` / `.nsis.exe`               |

### 从源码构建

```bash
git clone https://github.com/Niloux/animefun.git
cd animefun
pnpm install
pnpm tauri build
```

---

## 开发

```bash
pnpm tauri dev      # 启动开发环境
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm types:gen      # 从 Rust 导出 TypeScript 类型
```

---

## 技术栈

- **前端**: React 19, React Router, TanStack Query, Tailwind v4, Radix UI
- **后端**: Tauri 2, Rust, SQLite
- **类型**: [ts-rs](https://github.com/Aleph-Alpha/ts-rs) 自动同步前后端类型

---

## 数据存储

| 平台   | 目录                                                |
| ------ | --------------------------------------------------- |
| macOS  | `~/Library/Application Support/com.wuyou.animefun/` |
| Linux  | `~/.config/com.wuyou.animefun/`                     |
| Windows | `%APPDATA%\com.wuyou.animefun\`                     |

```
com.wuyou.animefun/
├── data.sqlite      # 订阅、设置
├── cache.sqlite     # RSS、API 缓存
└── images/          # 图片缓存
```

数据仅存储在本地，网络请求仅限于 Bangumi API 和 Mikan RSS。

---

## 依赖

- [Bangumi API](https://github.com/bangumi/api) — 番剧数据
- [Mikan Project](https://mikanani.me) — 番剧资源 RSS
- [Tauri](https://tauri.app) — 跨平台桌面应用框架

---

MIT License
