# Agent Guidelines

## Commands

### Frontend (React/TypeScript)

```bash
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # ESLint 9
pnpm format           # Prettier formatting
```

### Backend (Rust/Tauri)

```bash
pnpm tauri dev        # Full Tauri dev app
pnpm tauri build      # Production bundle

cargo check                   # Compile check
cargo test -p animefun_lib              # All tests
cargo test -p animefun_lib tests::test_name  # Single test
```

### Type Generation

```bash
pnpm types:gen          # Regenerate TypeScript types from Rust models
```

---

## Style & Conventions

### Imports

- Use `@/*` path aliases for internal imports
- Group: external libs first, then internal
- Example:

```typescript
import { useState } from "react";
import { queryClient } from "@/lib/query";
import { api } from "@/lib/api";
```

### React Components

- PascalCase file names and component names
- Named exports only
- Add `displayName` for `React.memo` components
- Props interface suffix: `Props` (e.g., `ButtonProps`)

### Hooks

- Prefix: `use*` (camelCase)
- Export single function, not objects
- Location: `src/hooks/`

### TypeScript

- Centralize types in `src/types/`
- Use auto-generated types from `src/types/gen/` (Rust source)
- Avoid `any`, use `unknown` + type narrowing

### Rust

- Functions: `snake_case`
- Types/Enums: `CamelCase`
- Modules: `snake_case`
- Error handling: `thiserror` derive
- Async: `tokio` runtime, `async`/`await`

### Error Handling

- Rust: Return `AppError` via `CommandResult<T>`
- Frontend: `use-toast-on-error` hook for mutations
- Wrap pages in `ErrorBoundary` component

### Formatting & Linting

- Run `pnpm format` before commits
- Use Prettier default config (2 spaces, semi, quotes)
- Fix all `pnpm lint` errors
- Prefix unused parameters with `_` (e.g., `_event: MouseEvent`)

---

## Architecture Patterns

### Data Fetching

- `@tanstack/react-query` via `use-simple-query` hook
- Custom hooks encapsulate Tauri invokes

### UI Components

- Radix UI primitives in `src/components/ui/`
- Tailwind CSS v4 styling
- Use `cn()` utility (`clsx` + `tailwind-merge`)

### State Management

- Local: `useState`, `useReducer`
- Server: React Query
- URL: `react-router-dom`

### Image Caching

- Use `use-cached-image` hook
- Images stored in `~/.animefun/images/`

### Page Loading

- Lazy load routes in `src/lib/lazy-pages.ts`

---

## Key Files

- `src/lib/api.ts` - Tauri invoke wrappers
- `src/main.tsx` - App entry, query provider setup
- `src-tauri/src/commands/` - Rust IPC handlers
- `src-tauri/src/services/` - Business logic
- `src-tauri/src/models/` - Data models with `#[ts_rs]`

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "How does X reach/become Y? / trace the flow from X to Y" | `codegraph_trace` (one call = the whole path, incl. callback/React/JSX dynamic hops) |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. For a specific **flow** ("how does X reach Y") start with `codegraph_trace` from→to — one call returns the whole path with dynamic hops bridged — then ONE `codegraph_explore` for the bodies; don't rebuild the path with `codegraph_search` + `codegraph_callers`. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag — check the staleness banner, don't guess a wait.** When a codegraph response starts with "⚠️ Some files referenced below were edited since the last index sync…", the listed files are pending re-index — Read those specific files for accurate content. Files NOT in that banner are fresh and codegraph is authoritative for them. `codegraph_status` also lists pending files under "Pending sync".

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
