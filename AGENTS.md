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
