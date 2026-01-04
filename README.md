<div align="center">

  <img src="src/assets/ikuyo-avatar.png" width="100" alt="AnimeFun">

# AnimeFun

Bangumi 个人收藏管理客户端 · 订阅追踪 · 日历视图 · 元数据整理

[![Build](https://img.shields.io/github/actions/workflow/status/Niloux/animefun/tauri-build.yml?branch=main&style=flat-square)](https://github.com/Niloux/animefun/actions)
[![Release](https://img.shields.io/github/v/release/Niloux/animefun?style=flat-square&color=blue)](https://github.com/Niloux/animefun/releases)
[![Downloads](https://img.shields.io/github/downloads/Niloux/animefun/total?style=flat-square&color=green)](https://github.com/Niloux/animefun/releases)
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
  </tr>
</table>

---

## 功能

- **收藏管理** — 追踪 Bangumi 收藏，后台自动同步更新（10 分钟）
- **番剧日历** — 本周放送时间线
- **高级搜索** — 按类型/评分/年份/标签过滤
- **元数据整理** — 整合 Bangumi 与公开 RSS 信息源
- **外部工具集成** — 支持调用本地 BT 客户端（qBittorrent/Transmission）
- **本地缓存** — 图片与元数据缓存，离线可用
- **跨平台** — macOS / Linux / Windows

---

## 安装

下载 [Releases](https://github.com/Niloux/animefun/releases) 中的安装包：

| 平台    | 文件格式                      |
| ------- | ----------------------------- |
| macOS   | `.dmg` / `.app.tar.gz`        |
| Linux   | `.AppImage` / `.deb` / `.rpm` |
| Windows | `.msi` / `.nsis.exe`          |

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

| 平台    | 目录                                                |
| ------- | --------------------------------------------------- |
| macOS   | `~/Library/Application Support/com.wuyou.animefun/` |
| Linux   | `~/.config/com.wuyou.animefun/`                     |
| Windows | `%APPDATA%\com.wuyou.animefun\`                     |

```
com.wuyou.animefun/
├── data.sqlite      # 收藏、设置
├── cache.sqlite     # API 缓存
└── images/          # 图片缓存
```

所有数据仅存储在本地，网络请求仅限于 Bangumi 公开 API 与公开 RSS 数据源。

---

## 依赖

- [Bangumi API](https://github.com/bangumi/api) — 番剧元数据
- [Tauri](https://tauri.app) — 跨平台桌面应用框架

---

## 免责声明

**本项目 AnimeFun 严格遵守相关法律法规，仅供学习交流与个人研究使用。**

### 声明内容

1. **本项目不提供、不存储、不分发任何受版权保护的内容**（包括但不限于视频、音频、图像等文件）。

2. **本项目不鼓励、不协助任何侵犯版权的行为**。用户使用本软件进行的任何操作，均由用户自行承担相应责任。

3. 本项目显示的所有番剧元数据（封面、简介、评分等）均来源于 [Bangumi API](https://github.com/bangumi/api)，其版权归原权利人所有。

4. 本项目支持调用本地已安装的 BT 客户端（如 qBittorrent、Transmission），但：
   - 本项目不提供任何下载链接或资源地址
   - 用户需自行配置 RSS 数据源
   - 任何下载行为均由用户自行决定并承担责任

5. **本项目禁止用于任何商业用途**。

### 法律合规

- 本项目采用 MIT 开源协议发布
- 如有权利人认为本项目内容侵犯了您的合法权益，请通过 [Issue](https://github.com/Niloux/animefun/issues) 联系，项目维护者将在核实后及时处理

---

**使用本软件即表示您已阅读、理解并同意以上声明。**

---

MIT License
