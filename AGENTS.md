# Agent Guidelines

## Commands

- **Frontend**: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm format`
- **Rust**: `cargo test -p animefun_lib` (all), `cargo test -p animefun_lib tests::test_name` (single)
- **Type Generation**: `pnpm types:gen` (Rust -> TypeScript types)

## Style & Conventions

- **Imports**: Use `@/*` path aliases, group external libs first, then internal
- **Components**: PascalCase, export named, add `displayName` for `React.memo`
- **Hooks**: camelCase prefix `use-*`, export single function
- **Types**: Centralize in `src/types/`, use generated types from Rust (`src/types/gen/`)
- **Rust**: snake_case for functions, CamelCase for types, error handling with `thiserror`
- **Formatting**: Run `pnpm format` before commits, use Prettier default config
- **Linting**: Fix all `npm run lint` errors, unused params prefix with `_`

## Patterns

- Data fetching with `@tanstack/react-query` via custom `use-simple-query` hook
- Error boundary wraps app, toast for UI errors via `sonner`
- UI components from `src/components/ui/` (Radix primitives with Tailwind)
- Cache images via `use-cached-image` hook
- Lazy load pages in `src/lib/lazy-pages.ts`
