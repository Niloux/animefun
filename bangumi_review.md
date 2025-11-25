# Bangumi 服务代码审查报告

**审查员**: Linus Torvalds
**日期**: 2025-11-25

## 【品味评分】 🟡 凑合

## 【核心判断】
代码的骨架是有的，比如 `services` 和 `commands` 的分离，以及用 `ts-rs` 生成类型定义，这些都还行。但魔鬼在细节里，而你的细节里到处都是魔鬼。有些关键部分的设计暴露了经验不足，充满了“坏味道”，如果不现在修正，将来会让维护者（可能就是你自己）痛不欲生。

## 【致命问题】
你的代码最大的问题在于**数据处理**。你没有真正理解“让数据结构驱动代码”，而是在用代码去“迁就”丑陋的数据。

### 1. `models/bangumi.rs` 里的 `deserialize_infobox` 就是一坨屎。

- **问题**: 你写了一个复杂的、递归的、包含特殊情况处理的函数 `collect_strings_from_value` 来手动解析 `serde_json::Value`。这是最糟糕的“代码味道”之一：你在和你的工具（`serde`）对着干。`serde` 的设计目的就是为了让你*避免*写这种代码。你这段手动解析的代码，脆弱、低效，而且极难维护。Bangumi API 的 `infobox` 字段格式稍微一变，你这里就得崩溃。
- **为什么这是垃圾**: 你把结构化的数据（键值对，里面可能还是列表或对象）强行拍平，用“、”连接成一个毫无信息的字符串。这是在**销毁信息**，而不是在处理信息。前端如果想对“原作”和“导演”做不同的展示呢？你已经把可能性毁灭在后端了。
- **正确做法**: "好程序员关心数据结构"。你应该定义一个能匹配 API 返回格式的 `enum`，让 `serde` 通过 `#[serde(untagged)]` 等属性来自动处理不一致的格式。让 `serde` 去干解析的脏活，而不是你自己写一堆 `if let` 链。

  **示例 (概念代码):**
  ```rust
  // 概念性的，需要根据API实际返回情况调整
  #[derive(Deserialize)]
  #[serde(untagged)]
  enum InfoValue {
      Simple(String),
      Nested { v: String },
      List(Vec<InfoValue>),
  }

  #[derive(Deserialize)]
  struct InfoItemRaw {
      key: String,
      value: InfoValue,
  }
  // 然后再处理 InfoValue，而不是一开始就把它拍平成 String
  ```

### 2. `services/bangumi_service/api.rs` 里的 `search_subject` 简直是灾难。

- **问题**: 你手动拼接字符串来创建缓存键（`key_parts.join("&")`）。这是一个极其愚蠢且脆弱的设计。如果将来新增一个参数，你忘了加到 `key_parts` 里，缓存就出错了。如果参数顺序变了，缓存键也变了，明明是同一个请求，却无法命中缓存。
- **为什么这是垃圾**: 因为它依赖于你的手和眼，而不是编译器和逻辑。人是会犯错的，尤其是面对这么一长串 `if let Some` 的时候。
- **正确做法**: 创建一个代表所有搜索参数的 `struct`。为了保证键的稳定性，对该结构体排序（比如字段按字母序），然后用 `serde_json::to_string` 序列化它来生成一个稳定、唯一的缓存键。这样无论参数顺序如何，结果都一样。而且新增参数时，你只需要在 `struct` 里加一个字段，缓存键的生成逻辑完全不需要动。

  **示例 (概念代码):**
  ```rust
  #[derive(Serialize, Default, Ord, PartialOrd, Eq, PartialEq)]
  struct SearchParams {
      keywords: String,
      subject_type: Option<Vec<u8>>,
      sort: Option<String>,
      // ... all other params
  }

  // 在函数中
  let params = SearchParams { keywords: keywords.to_string(), ... };
  // 确保你的序列化结果是稳定的（比如字段排序）
  let key = format!("search:{}", serde_json::to_string(&params).unwrap()); 
  ```

## 【其他重要问题】

### 1. 不要在业务代码里用 `.unwrap()`
我在 `fetch_api` 函数里看到了 `cache_duration_secs.try_into().unwrap()`。`unwrap` 的意思是“如果出错了，就让整个程序崩溃”。在生产代码里，这绝对、永远、是不可接受的。你这是在写一个随时会爆炸的定时炸弹。使用 `match` 或者 `map_err` 来优雅地处理 `Result`，把它转换成你的 `AppError`。

### 2. 清理你的魔法数字
`6 * 3600`, `24 * 3600`... 这些是“魔法数字”。你应该把它们定义成有意义的常量，比如 `const CACHE_TTL_HOUR: u64 = 3600;`。这不仅是为了可读性，更是为了清晰地表达你的意图。

## 【总结】
总的来说，这个项目的架子还行，但血肉里充满了坏习惯。你现在必须把上面提到的“致命问题”改掉，尤其是 `deserialize_infobox` 和 `search_subject` 的缓存键生成。

写代码不是让它“能跑就行”，而是要让它在未来几年里依然清晰、健壮、易于维护。
