# Bangumi Search 功能代码审查 - Linus Torvalds

代码看完了。整体结构还算清晰，至少没把前后端、业务逻辑和基础架构混成一坨屎。`Command -> Service -> Infra` 的分层思路是对的，这是最基本的常识。

但“能用”和“好”之间，还差了十万八千里。我发现了一些还算“有品味”的设计，但也看到了几个必须马上修改的愚蠢问题。

## 值得表扬的地方 (有品味的设计)

### 1. 清晰的防腐层 (Anti-Corruption Layer)

`models/bangumi.rs` 里的 `deserialize_infobox` 函数是个亮点。

```rust
// src-tauri/src/models/bangumi.rs
fn deserialize_infobox<'de, D>(deserializer: D) -> Result<Vec<InfoBoxItem>, D::Error>
where
    D: Deserializer<'de>,
{
    // ...
}
```

你显然知道外部 API (`Bangumi`) 的数据有多不靠谱。这个自定义的反序列化函数就是一道防线，它把外部恶心的数据结构转换成了内部干净、可控的模式。这很好。**你没有让外部 API 的“屎”污染到你的核心业务逻辑**。这是有经验的程序员才会做的事。

### 2. 实用的缓存策略

`cache.rs` 里用 `SQLite` 做持久化缓存，这个选择很实用。

```rust
// src-tauri/src/cache.rs
pub async fn get_entry<T: DeserializeOwned>(key: &str) -> Option<T> {
    // ...
}
```

这意味着即使用户重启了应用，之前搜索的结果也能立刻加载，而不是每次都去请求那个慢得要死的 API。对于一个桌面应用来说，这是提升用户体验的正确思路。简单、有效、解决了实际问题。

---

## 必须修改的问题 (愚蠢的设计)

现在说说那些让我皱眉头的地方。

### 1. 最大的问题：建立在沙滩上的城堡 (依赖实验性 API)

`public/bangumi_api.yml` 明确写着 `/v0/search/subjects` 这个接口是 `x-experimental: true`。

**这是我眼中最严重的问题，没有之一。**

你的核心功能之一，完全依赖于一个“实验性”的、随时可能变更甚至消失的 API。这意味着 Bangumi 的开发者某天早上喝多了咖啡，大笔一挥改了接口，你的整个搜索功能就直接瘫痪。

这不是代码写得好不好的问题，这是生存问题。你等于把房子的地基建在了流沙上。

**【修改指令】**
你必须立刻制定一个缓解策略。
- **Plan A (首选):** 寻找一个更稳定的替代数据源。Bangumi 是否有其他官方或社区认可的稳定 API？
- **Plan B (备用):** 如果找不到替代方案，你需要在代码层面做好最坏的打算。
    1.  **增加监控和警报**：当 API 返回非预期的格式或错误时，能立刻知晓，而不是等用户来骂你。
    2.  **设计优雅降级 (Graceful Degradation)**：当线上 API 失效时，应用不应该直接崩溃或卡死。至少应该向用户显示一个明确的提示（“搜索服务暂不可用，请稍后再试”），并允许用户继续使用其他不依赖此 API 的功能。
    3.  **强化缓存**：让缓存的过期时间更长，并提供一个“即使 API 失效，也强制使用旧缓存”的选项。

### 2. “好品味”的缺失：冗余的数据结构

在 `src-tauri/src/services/bangumi_service/api.rs` 文件里，`SearchKey` 和 `SearchPayload` 这两个结构体几乎一模一样。

```rust
// for cache key
#[derive(Serialize, Debug, PartialEq, Eq, Hash)]
struct SearchKey<'a> {
    keyword: &'a str,
    filter: SearchFilter,
}

// for api payload
#[derive(Serialize, Debug)]
struct SearchPayload<'a> {
    keyword: &'a str,
    filter: SearchFilter,
}
```

你为了两个几乎完全相同的目的，定义了两个结构体。这简直是复制粘贴编程的典范。代码不应该是这样的，它应该被精炼。这不光是为了少写几行代码，更是为了让意图更清晰，减少未来修改时出错的可能。

**【修改指令】**
修复这个愚蠢的重复。有很多种方法：
- **方案一 (推荐):** 只保留一个 `SearchPayload`，然后给它同时派生 `PartialEq`, `Eq`, `Hash`。`SearchKey` 这个名字本身就是多余的，一个结构体的用途应该由它的上下文决定，而不是名字。
- **方案二:** 如果你坚持要区分，可以使用宏来减少重复代码。但在这里，一个结构体就足够了。

### 3. 效率问题：被浪费的缓存

你的缓存机制只做了一半。你把请求结果存了下来，但下次请求时，你并没有利用 HTTP 的缓存头（如 `ETag`）来检查数据是否真的更新了。

目前的流程是：
1.  检查本地 `SQLite` 缓存。
2.  如果有，直接返回。（OK）
3.  如果没有，**总是**向 Bangumi API 发起一个完整的 `POST` 请求，下载完整的数据。

Bangumi 的 API 响应头里包含了 `ETag`。这意味着你可以这样做：
1.  第一次请求后，把 `ETag` 和数据一起存入缓存。
2.  下一次缓存过期后，在请求头里带上 `If-None-Match: "your-etag-value"`。
3.  如果服务器上的数据没变，它会返回一个 `304 Not Modified` 的空响应，而不是完整的数据。这样你既确认了数据是新鲜的，又节省了带宽和反序列化的开销。

**【修改指令】**
修改 `fetch_api` 或相关的 HTTP 请求逻辑。
1.  在 `http::Client` 发出请求后，从响应头中解析并存储 `ETag` 值。
2.  在下一次发起相同请求时，在请求头中加入 `If-None-Match` 字段。
3.  处理 `304 Not Modified` 响应。如果收到 304，就从你的缓存中提供数据，并更新缓存的“最后检查时间”。

## 结论

你的代码有一些不错的想法，但被一些业余的错误和严重的架构风险拖累了。别满足于“它能跑起来”，一个严肃的程序员应该追求代码的健壮、优雅和高效。

我给你的建议都是具体的、可执行的。现在，停止满足，去把它们改好。