# Mikan 资源服务设计方案 v1

## 目标

- 在番剧详情页基于 `bgm subject_id` 稳定、快速获取 Mikan 的剧集资源。
- 避免名称搜索错配，优先通过番组页的显式链接建立 `bgm subject_id ↔ mikan bangumi_id` 映射。

## 范围（本期）

- 只做自动化：命中映射直接拉取资源；未命中执行页面搜索→相关推荐→番组页显式验证→自动落库。
- 未命中后的“用户手动输入 bangumi_id 绑定”不在本期实现，仅作为后续迭代。

## 原则

- 简化：搜索只用 `name_cn`，`name_cn` 为空时才退回 `name`。
- 显式优先：番组页出现 `bgm.tv/subject/{subject_id}` 链接视为金标准命中。
- 不破坏用户空间：自动只在显式命中才落库；未来加入人工锁定后不再自动改写。
- 资源友好：并发限流、失败退避、TTL 缓存，减少对站点的压力。

## 现有代码整合点

- 缓存层：`src-tauri/src/cache.rs:1`
- Bangumi API 与缓存示例：`src-tauri/src/services/bangumi_service/api.rs:116`
- 订阅存储（SQLite 风格参考）：`src-tauri/src/subscriptions/store.rs:1`
- Tauri 命令注册：`src-tauri/src/lib.rs:12`

## 数据模型

### 映射表

```sql
CREATE TABLE IF NOT EXISTS mikan_bangumi_map (
  bgm_subject_id   INTEGER PRIMARY KEY,
  mikan_bangumi_id INTEGER NOT NULL,
  confidence       REAL    NOT NULL,
  source           TEXT    NOT NULL, -- explicit | heuristic | manual
  locked           INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL
);
```

- 本期仅写入 `source=explicit, confidence=1.0, locked=0`。

### 缓存键建议

- `mikan:search:<name_cn>`：搜索页 HTML，TTL 6h。
- `mikan:bangumi:<id>`：番组页 HTML，TTL 24h。
- `mikan:rss:<id>`：番组 RSS JSON，TTL 6–24h。

## 依赖建议

- HTML 解析：`scraper`（CSS 选择器），或回退为简单 `regex`/`substring` 查找 `href`。
- RSS 解析：`rss` 或 `quick-xml`。若不引入库，可先把 RSS 解析为轻量 JSON（仅取 `title/link/enclosure/pubDate`）。

## 流程

### 命中路径

1. 详情页获取 `bgm subject_id`。
2. 查 `mikan_bangumi_map`：若命中 `mikan_bangumi_id`，构造 Mikan bangumi RSS，拉取并缓存资源，返回。

### 未命中路径

1. 搜索页：只用 `name_cn` 构造 URL `https://mikanani.me/Home/Search?searchstr=<name_cn>`，`name_cn` 为空时退回 `name`。
2. 提取相关推荐：在搜索页“相关推荐”区域抓取所有 `a[href^="/Home/Bangumi/"]`，去重得到候选 `bangumi_id` 列表。
3. 显式验证：并发打开每个 `https://mikanani.me/Home/Bangumi/{id}`，查找是否存在 `a[href*="bgm.tv/subject/"]`（兼容 `bangumi.tv/chii.in` 域名别名）。
   - 若存在且 `subject_id` 与当前一致：映射入库 `source=explicit, confidence=1.0, locked=false`。
   - 若均不存在：本期不落库并直接返回“未命中”。未来交互让用户手输 `bangumi_id` 后入库并 `locked=true`。
4. 资源拉取：有了 `mikan_bangumi_id` 后，构造 RSS 链接拉取并缓存，返回给前端。

### 并发与节流

- 搜索页与番组页并发各限制在 3；失败指数退避。
- RSS 拉取复用缓存 TTL 模式；按条目放送状态未来可动态调整 TTL。

## 后端接口

### 新增命令

```text
get_mikan_resources(subject_id: u32) -> MikanResourcesResponse
```

- 请求：`subject_id`（bgm）
- 响应：标准化资源项数组与来源信息。

### 响应数据结构（示意）

```text
MikanResourceItem {
  title: string,
  pageUrl: string,
  torrentUrl?: string,
  magnet?: string,
  pubDate?: string,
  sizeBytes?: number,
  group?: string
}
```

## 代码框架（建议）

```
src-tauri/
  src/
    services/
      mikan_service/
        mod.rs              // 对外入口：ensure_mapping + fetch_resources
        search.rs           // 搜索页抓取与相关推荐提取
        bangumi_page.rs     // 番组页显式验证：解析 bgm 链接
        rss.rs              // bangumi RSS 获取与解析、缓存
        map_store.rs        // SQLite 映射表增删查
    commands/
      mikan.rs              // Tauri 命令：get_mikan_resources
```

### 关键函数（签名建议）

```text
ensure_mapping(subject_id: u32) -> Option<u32>
search_bangumi_candidates_by_name_cn(name_cn: &str) -> Vec<u32>
extract_bangumi_ids_from_search_page(html: &str) -> Vec<u32>
resolve_subject_explicit(bangumi_id: u32) -> Option<u32>
persist_mapping(subject_id: u32, mikan_id: u32, confidence: f32, source: &str, locked: bool)
fetch_bangumi_rss(mikan_id: u32) -> Vec<MikanResourceItem>
get_mikan_resources(subject_id: u32) -> MikanResourcesResponse
```

## 错误处理

- 搜索页/番组页解析失败：返回“未命中”，不落库。
- RSS 拉取失败：返回空资源并记录错误码；不影响映射。
- 网络失败：有限重试，最终回退为“未命中”。

## 安全与合规

- 设置明确 UA 与超时；失败退避，避免高频访问。
- 不存储敏感数据；仅落库 ID 映射与资源元数据。

## 验证计划

- 以热门条目样本验证：能否稳定命中显式链接并拉到资源。
- 对完结条目与剧场版进行抽检，确保搜索→相关推荐→番组页链路可用。

## 未来迭代

- 未命中时允许用户手动输入 `mikan_bangumi_id` 并 `locked=true`。
- 根据放送状态动态调整 RSS TTL；加入后台增量刷新。
