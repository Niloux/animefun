# Analyze.md

This file provides guidance to any agent when working with code in this repository.

## Development commands

### Prerequisites

- Node.js 20+
- `pnpm`
- Rust toolchain + `cargo`
- Tauri CLI (`@tauri-apps/cli` via devDependencies)
- Xcode Command Line Tools (for macOS builds)

### Install & run

- Install JS dependencies: `pnpm install`
- Run full desktop app (Tauri + React): `pnpm tauri dev`
- Run frontend only in the browser: `pnpm dev`
- Build frontend bundle only: `pnpm build`
- Build desktop app bundles (for release): `pnpm tauri build`

### Linting, formatting, and types

- Lint frontend code: `pnpm lint`
  - Uses `eslint.config.cjs`; `src/components/ui/**` is excluded from linting.
- Format frontend code with Prettier: `pnpm format`
- Regenerate shared TypeScript types from Rust using `ts-rs`:
  - `pnpm types:gen` (runs `cargo test -q --manifest-path src-tauri/Cargo.toml` under the hood and writes to `src/types/gen/`)

### Tests

- Rust backend tests (all):
  - `cargo test --manifest-path src-tauri/Cargo.toml`
- Run a single Rust test (example for Bangumi status tests):
  - `cargo test --manifest-path src-tauri/Cargo.toml test_fetch_subject`
- There is currently no dedicated JS test runner configured in `package.json`.

## Architecture overview

### Big picture

- Desktop app built with **Tauri 2 + Rust** backend and **React 19 + React Router + React Query** frontend.
- External data sources:
  - Bangumi API (anime metadata, calendar, episodes, search).
  - Mikan RSS (downloadable resources mapped to episodes).
- Local data & cache live under `~/.animefun`:
  - `data.sqlite` and `cache.sqlite` (managed by Rust infra layer).
  - `images/` for poster and image cache.
- Type sharing between Rust and TypeScript uses **ts-rs**; generated TS types live in `src/types/gen/` and should not be manually edited.

### Frontend structure (React)

**Entry & routing**

- `src/main.tsx` mounts the React app.
- `src/App.tsx` wires up:
  - `QueryClientProvider` using `src/lib/query.ts` (central React Query configuration: stale times, GC times, retry, and refetch behavior).
  - `BrowserRouter` and `Routes` based on a central route map from `src/constants/routes.ts`.
  - `Layout` (`src/components/Layout.tsx`) as the top-level shell that hosts the sidebar/navigation and an `<Outlet>` for pages, and receives a `preloadMap` for route-based preloading.
  - Global `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) wrapping routing.

**Route and page composition**

- Route paths are defined in `src/constants/routes.ts` and consumed throughout the app instead of hard-coded strings.
- All page components are lazy-loaded through `src/lib/lazy-pages.ts`:
  - Uses `lazyWithPreload` from `src/hooks/use-lazy-preload.ts` to create components like `HomePage`, `SearchPage`, `SubscribePage`, `Resources*Page`, `SettingsPage`, `AnimeDetailPage`.
  - Exposes `preloadMap`, a mapping from route constants to preload functions, which `Layout` can use to eagerly preload next pages based on navigation hints (e.g., sidebar hover).
- Concrete pages live under `src/pages/**` and compose domain hooks, API-backed data, and UI components:
  - `Home/` uses `useCalendar` + `WeekDayNav` + `AnimeGrid` to present the Bangumi weekly calendar.
  - `Search/` uses `useSearch` + `FiltersPanel` + `AutoComplete` + pagination utilities.
  - `AnimeDetail/` uses `useAnimeDetail`, `useSubjectStatus`, `useMikanResources`, `useEpisodeResources`, `EpisodesList`, and `AnimeInfoBox` to show a detailed view, status, and resource mapping for a single show.
  - `Subscribe/`, `Resources/*`, `Settings/` follow the same pattern: page = hooks + domain components.

**Data fetching and state management**

- All frontend data fetching goes through **Tauri commands** via `src/lib/api.ts`:
  - Wrapper functions like `getCalendar`, `getAnimeDetail`, `getEpisodes`, `getSubjectStatus`, `searchSubject`, `searchSubjectQ`, `getMikanResources`, and the various subscription-related calls (`getSubscriptions`, `toggleSubscription`, `sub_query`, etc.) call `invoke` with strongly-typed payloads.
  - Error handling is centralized at the wrapper level and in hooks; UI surfaces human-readable messages, while the wrappers log detailed errors.
- Domain-specific hooks encapsulate React Query usage and error UI integration:
  - `use-calendar.ts`, `use-anime-detail.ts`, `use-mikan-resources.ts` wrap `lib/api.ts` and standardize query keys, stale times, and retry behavior.
  - `use-search.ts` builds on `use-search-core.ts` to manage Bangumi search filters, pagination, and debounced queries, delegating the actual fetch to `searchSubjectQ` from `lib/api.ts`.
  - `use-subscriptions.ts` maintains an in-memory `Set` of subscribed IDs plus full subscription items, synchronizing with backend subscription commands.
  - `use-episode-resources.ts` maps Mikan resources to specific episodes, including range parsing and grouping by subtitle group for UI presentation.
  - `use-toast-on-error.ts` centralizes error-to-toast wiring, and is called from many hooks to ensure a consistent UX for failures.
- React Query configuration (`src/lib/query.ts`) sets sensible defaults (staleTime, gcTime, retries, and refetch-on-focus behavior) so individual hooks only override when necessary.

**UI layer**

- `src/components/ui/**` contains low-level UI primitives (button, card, dialog, sheets, sidebar, pagination, etc.), broadly following **shadcn-ui/Radix** patterns.
  - These UI primitives are intentionally ignored by ESLint (see `eslint.config.cjs`), so behavior-level logic is expected to live with domain components and hooks instead.
- `src/components/**` hosts higher-level, domain-aware components built from the primitives:
  - `AnimeCard`, `AnimeGrid`, `AnimeInfoBox`, `EpisodesList`, `SubscribeButton`, `WeekDayNav`, `FiltersPanel`, `AutoComplete`, `Layout`, `Sidebar`, `ResourceDialog`, etc.
- Styling is handled via Tailwind v4 (configured in `vite.config.ts` with `@tailwindcss/vite`), standard utility classes, and some custom CSS in `src/App.css`.

**Type system and shared contracts**

- `src/types/bangumi.ts` holds hand-written frontend models for Bangumi domain concepts (e.g., `Anime`, `CalendarDay`, `Episode`, `SubjectStatus`).
- `src/types/gen/**` is generated from Rust types via **ts-rs**; these mirror backend models for Bangumi, Mikan, downloader config, etc.
  - Always regenerate using `pnpm types:gen` when Rust-side models change.
  - Do not manually edit files under `src/types/gen/**`.
- `docs/bangumi_api.yml` provides the Bangumi OpenAPI spec used to inform model shapes and request/response patterns.

**Build and tooling**

- Vite configuration in `vite.config.ts`:
  - Uses `@vitejs/plugin-react` and Tailwind.
  - Defines `@` as an alias for `./src` (reflected in `tsconfig.json` via `paths`), which should be used in new imports instead of long relative paths.
  - Adjusts dev server host/ports for Tauri (`1420` for Vite, `1421` for HMR), and excludes `src-tauri/**` from file watching.
- TypeScript configuration in `tsconfig.json`:
  - Uses strict compiler options (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).
  - Includes only `src/**` for the frontend build and references `tsconfig.node.json` for Node-side tooling.

### Backend structure (Rust + Tauri)

**Entry and Tauri setup**

- `src-tauri/src/main.rs` is the binary entrypoint and simply calls `animefun_lib::run()`.
- `src-tauri/src/lib.rs` is the core library entrypoint:
  - Initializes logging (`infra::log::init`).
  - Computes the app base directory (`infra::path::app_base_dir`) and initializes:
    - Cache DB and cache subsystem via `infra::cache::init` (backed by `cache.sqlite`).
    - Subscription service state and storage via `services::subscriptions::init`.
    - Mikan integration via `services::mikan::init`.
  - Spawns background tasks:
    - `commands::cache::cleanup_images` to clean up image cache on disk.
    - `services::subscriptions::spawn_refresh_worker` to periodically refresh subscription indices and Bangumi data.
    - `services::mikan::spawn_preheat_worker` to warm Mikan-derived resource mappings.
  - Registers Tauri plugins (e.g., `tauri-plugin-opener` for opening external links).
  - Exposes a comprehensive set of Tauri commands using `tauri::generate_handler!`, which are consumed from the frontend via `invoke` wrappers in `src/lib/api.ts`.

**Infra layer (`src-tauri/src/infra`)**

- `db.rs`:
  - Manages two `deadpool_sqlite` connection pools, one for cache (`cache.sqlite`) and one for main data (`data.sqlite`).
  - Ensures the base directory exists and exposes `cache_pool()` and `data_pool()` for other modules.
- `cache.rs`:
  - Implements a generic key-value cache table in `cache.sqlite` with TTL semantics (`expires_at` column) and optional HTTP metadata (`etag`, `last_modified`).
  - Provides async `get_entry` and `set_entry` helpers used by services to wrap external HTTP responses.
- `http.rs` (not fully detailed here):
  - Hosts a global HTTP client (`CLIENT`) and rate-limiting / backoff primitives (`wait_api_limit`) for external API calls.
- `log.rs`, `time.rs`, `tasks.rs`, `media_cache.rs`, and `path.rs`:
  - Logging, time helpers, background task abstractions, file-based media cache, and base-directory helpers that other modules rely on.

**Service layer (`src-tauri/src/services`)**

- `bangumi/`:
  - `api.rs` encapsulates all Bangumi HTTP calls:
    - `fetch_calendar`, `fetch_subject`, `search_subject`, `fetch_episodes` build requests against `BGM_API_HOST`, use the shared HTTP client, and cache responses via `infra::cache` with well-defined TTLs per data type.
    - Complex search parameters are normalized (sorting filters, canonical key generation) to maximize cache hits.
  - `status.rs` computes a derived `SubjectStatus` for a given show ID:
    - Combines calendar info, subject metadata, and episode lists (including fetching boundary pages) to determine whether a show is **PreAir**, **Airing**, **Finished**, **OnHiatus**, or **Unknown**, with a human-readable `reason`.
    - Uses a moving time window to infer hiatus vs. ongoing when calendar data is insufficient.
    - Contains async tests that rely on real Bangumi API access and a temporary cache directory; they can be run via `cargo test --manifest-path src-tauri/Cargo.toml`.
- `subscriptions/`:
  - Manages the subscription index and its persistence in `data.sqlite`.
  - Handles querying, toggling, clearing, and periodically refreshing subscriptions from Bangumi.
  - Exposes worker entrypoints (`worker.rs`) used by `run()` to spawn background refresh tasks.
- `mikan/`:
  - Parses Mikan RSS and related HTML, maps torrent resources to Bangumi episodes, and maintains a store of resources and groupings.
  - Provides functions used by the `get_mikan_resources` command to supply `MikanResourcesResponse` back to the frontend.
- `downloader/`:
  - Wraps downloader configuration and state, likely around a torrent client.
  - Exposes functions for getting/setting downloader config, adding torrents, querying tracked downloads, and controlling download lifecycle (pause, resume, delete).

**Command layer (`src-tauri/src/commands`)**

- `bangumi.rs`:
  - Thin Tauri command wrappers around the Bangumi service functions, returning `CommandResult<...>` and mapping 1:1 onto frontend invokes like `get_calendar` and `search_subjectQ`.
- `subscriptions.rs`, `mikan.rs`, `downloader.rs`, `cache.rs`:
  - Follow the same pattern: minimal glue that takes simple parameters, delegates to the appropriate service module, and returns structured models that are mirrored in TypeScript via ts-rs.
- `mod.rs` simply re-exports the command modules so `lib.rs` can register them in a single place.

**Model layer (`src-tauri/src/models`)**

- `bangumi.rs` and `mikan.rs` define the core data models for responses from Bangumi and Mikan.
- Types are annotated for `serde` and `ts-rs` so that the same structs can be serialized over Tauri IPC and emitted as TypeScript definitions under `src/types/gen/**`.

## Working across frontend and backend

When adding or changing features, follow this typical flow:

1. **Start in Rust**:
   - Add or adjust models in `src-tauri/src/models/**`.
   - Implement or extend service functions (e.g., in `services/bangumi`, `services/mikan`, `services/subscriptions`, or `services/downloader`).
   - Expose new functionality via a Tauri command (`src-tauri/src/commands/*.rs`), and register it in `src-tauri/src/lib.rs`.
2. **Regenerate TS types**:
   - Run `pnpm types:gen` to sync TypeScript definitions in `src/types/gen/**` with the Rust models.
3. **Wire up the frontend**:
   - Add a new wrapper in `src/lib/api.ts` that calls the Tauri command via `invoke`, using the generated TS types.
   - Create or update domain hooks under `src/hooks/**` to encapsulate React Query usage and UI-level error handling.
   - Consume the hooks from page components under `src/pages/**` and compose with existing higher-level components in `src/components/**`.

This structure keeps business logic, external I/O, and storage in Rust, while the React frontend focuses on presentation, navigation, and user interaction over a typed command boundary.
