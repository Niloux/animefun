# 下载管理功能实现方案

## 1. 核心理念与架构

### 1.1. 核心理念
本项目**不会**内置一个完整的 BitTorrent 客户端。这样做会引入不必要的复杂性、安全风险和维护地狱，且用户体验永远无法超越专业的下载软件。

我们的核心理念是**“远程控制”**：本应用将作为一个轻量级的、图形化的**远程控制器**，通过 API 与用户自己安装、配置的专业 BT 客户端（如 qBittorrent）进行交互。

### 1.2. 架构设计
- **后端 (Rust / Tauri)**: 负责所有核心业务逻辑，包括：
    1.  与 BT 客户端的 API 通信。
    2.  管理和持久化下载任务与动画元数据的绑定关系（使用 SQLite）。
    3.  管理用户 BT 客户端的配置信息。
    4.  向前端暴露清晰、安全的 Tauri 命令。

- **前端 (React / TypeScript)**: 负责所有 UI/UX，作为一个“无状态”的展示层。
    1.  调用后端暴露的 Tauri 命令来发送指令和请求数据。
    2.  将从后端获取的数据渲染成用户界面（如配置表单、下载列表、进度条）。
    3.  **前端不应包含任何与 API 通信、文件系统或数据库相关的逻辑。**

---

## 2. 后端实现 (`src-tauri`)

### 2.1. 数据库 (`data.sqlite`)
我们将遵循项目现有的“仓库模式”，为“下载”功能创建一个独立的仓库模块。

- **模块路径**: `src-tauri/src/services/downloads/repo.rs`
- **数据表名**: `tracked_downloads`
- **表结构 (SQL)**:
  ```sql
  CREATE TABLE IF NOT EXISTS tracked_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,       -- 种子 Info Hash，核心标识符
      subject_id INTEGER NOT NULL,     -- 关联的 Bangumi Subject ID
      episode INTEGER NOT NULL,        -- 番剧集数
      status TEXT NOT NULL,            -- 下载状态 (e.g., "downloading", "paused")
      file_path TEXT,                  -- 文件保存路径 (从 API 获取)
      created_at INTEGER NOT NULL,     -- 添加时间 (Unix Timestamp)
      updated_at INTEGER NOT NULL      -- 更新时间 (Unix Timestamp)
  );
  ```
- **实现方式**: 在 `repo.rs` 中创建一个私有的 `ensure_table` 函数，并在每一个数据库操作函数中首先调用它，以确保表的存在。所有数据库操作都将通过 `deadpool-sqlite` 的 `interact` 方法在异步环境中执行。

### 2.2. 配置管理
- **配置文件**: 在应用的数据目录下创建一个 `downloader.json` 文件来持久化存储用户的 BT 客户端 API 设置。
- **Tauri 命令**:
    - `set_downloader_config(config: DownloaderConfig)`: 接收前端传来的配置并保存到 `downloader.json`。
    - `get_downloader_config()`: 读取并返回当前的配置。

### 2.3. API 客户端
- **初始目标**: qBittorrent (因其广泛使用和强大的 Web API)。
- **模块路径**: `src-tauri/src/services/downloader_api.rs` (或类似名称)
- **核心功能**:
    - `login(config)`: 使用用户配置登录，获取并缓存 session cookie。
    - `add_torrent(torrent_content: Vec<u8>)`: 添加新种子，返回其 info hash。
    - `get_torrents_info(hashes: Vec<String>)`: 批量获取种子的状态、进度、速度等信息。
    - `pause_torrent(hash)`, `resume_torrent(hash)`: 控制任务状态。

### 2.4. 暴露给前端的 Tauri 命令
- `add_torrent_and_track(url: String, metadata: AnimeInfo)`: 整合核心流程，供前端一键调用。
- `get_tracked_downloads()`: 从本地数据库获取所有被追踪的下载任务及其元数据。
- `get_live_download_info()`: 从 BT 客户端 API 获取所有被追踪任务的实时进度。
- `pause_download(hash: String)`, `resume_download(hash: String)`: 控制下载任务。
- `set_downloader_config`, `get_downloader_config` (如上所述)。

---

## 3. 前端实现 (`src`)

### 3.1. 设置页面 (`/settings`)
- 创建一个新组件，包含用于输入 qBittorrent API 地址、用户名和密码的表单。
- 表单提交时，调用 `invoke('set_downloader_config', ...)`。
- 页面加载时，调用 `invoke('get_downloader_config')` 来填充表单现有值。

### 3.2. 下载按钮 (位于资源弹窗或剧集列表)
- 修改现有下载按钮的 `onClick` 事件处理器。
- 调用 `invoke('add_torrent_and_track', { url: '...', metadata: {...} })`。
- 根据 `invoke` 的返回结果，使用 `toast` 组件向用户显示“添加成功”或“添加失败”的提示。

### 3.3. 下载管理页面 (`/downloads`)
- 创建一个新的路由和页面组件。
- **页面加载**: 调用 `invoke('get_tracked_downloads')` 获取数据库中记录的任务列表。
- **数据刷新**:
    - 使用 `useInterval` hook，每隔 N 秒调用一次 `invoke('get_live_download_info')`。
    - 将获取到的实时进度与任务列表进行合并，更新 UI。
- **UI 展示**:
    - 以列表或卡片形式展示每一个下载任务。
    - 每个任务都应包含：动画封面/标题、集数、下载进度条、速度、状态等。
    - 提供“暂停”、“恢复”、“删除”（仅从本应用追踪列表删除）等操作按钮。

---

## 4. 完整工作流程总结

1.  **首次设置**: 用户进入“设置”页面，填写其 qBittorrent 的 API 信息并保存。
2.  **添加下载**: 用户在应用中找到某部番剧的某一集，点击“下载”按钮。
3.  **后端处理**:
    a. Tauri 后端接收到 `add_torrent_and_track` 命令。
    b. 后端使用 `reqwest` 从资源 URL 下载 `.torrent` 文件内容。
    c. 后端使用 `downloader_api` 模块，登录 qBittorrent 并将种子内容推送过去。
    d. qBittorrent API 返回新任务的 `hash`。
    e. 后端将这个 `hash` 和动画元信息一起存入 `tracked_downloads` 表。
4.  **用户查看**:
    a. 用户导航到 `/downloads` 页面。
    b. 前端从本地数据库加载被追踪的任务列表。
    c. 前端启动定时器，不断从 qBittorrent API 获取这些任务的实时进度，并刷新页面。
5.  **用户管理**: 用户在页面上点击“暂停”，前端调用 `pause_download` 命令，后端再通过 API 指示 qBittorrent 暂停该任务。
