# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AnimeFun is a cross-platform desktop anime subscription client built with **Tauri 2**. It aggregates anime data from Bangumi API and torrent resources from Mikan Project, providing subscription management, calendar views, and local caching.

## Tech Stack

- **Frontend**: React 19, TypeScript, React Router 7, TanStack Query, Tailwind CSS v4, Radix UI
- **Backend**: Tauri 2, Rust, SQLite (deadpool), reqwest, tokio
- **Type Sharing**: ts-rs generates TypeScript types from Rust models

## Development Commands

```bash
# Full stack development (Tauri app)
pnpm tauri dev

# Frontend only (web preview)
pnpm dev

# Production build
pnpm build          # Frontend only
pnpm tauri build    # Full desktop app

# Code quality
pnpm lint           # ESLint 9
pnpm format         # Prettier

# Type generation (run after Rust model changes)
pnpm types:gen      # Runs `cargo test` to generate src/types/gen/ from Rust via ts-rs
```

## Architecture

### Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│  Pages → Components → Hooks → API Layer                     │
└─────────────────────────────────────────────────────────────┘
                            │ Tauri IPC
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend                              │
│  Commands → Services → Infrastructure                       │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Structure

- `src/pages/` - Lazy-loaded route components (Home, Search, Subscribe, Resources, AnimeDetail, Settings)
- `src/components/ui/` - shadcn/Radix primitives with Tailwind styling
- `src/lib/` - API wrappers, query client setup, utilities
- `src/types/gen/` - **DO NOT EDIT** - Auto-generated from Rust models via ts-rs

### Backend Structure

- `src-tauri/src/commands/` - Tauri command handlers (IPC layer)
  - `bangumi.rs` - Anime data, episodes, search
  - `subscriptions.rs` - Subscription CRUD, background refresh
  - `mikan.rs` - Torrent resource aggregation
  - `downloader.rs` - Torrent client integration
  - `cache.rs` - Image cache management

- `src-tauri/src/services/` - Business logic layer
  - `bangumi/` - Bangumi API integration
  - `subscriptions/` - Background worker (10-min refresh), repository
  - `mikan/` - RSS parsing, preheating, episode mapping
  - `downloader/` - Client abstraction (qBittorrent/transmission), status monitoring

- `src-tauri/src/infra/` - Infrastructure
  - `db.rs` - SQLite connection pools (main + cache)
  - `http.rs` - Shared reqwest client with rate limiting (governor)
  - `media_cache.rs` - Image caching with automatic cleanup
  - `path.rs` - Centralized paths in `~/.animefun`
  - `tasks.rs` - Background task spawning

- `src-tauri/src/models/` - Data models with `#[ts_rs]` macro for TypeScript export

### Key Patterns

1. **Type Safety**: All Rust models are exported to TypeScript via ts-rs. When modifying Rust models, run `pnpm types:gen` to regenerate types.

2. **Data Flow**: React components → custom hooks → Tauri invoke → Rust commands → services → infrastructure

3. **Background Workers**: Services run as async tasks via `tauri::async_runtime::spawn`:
   - `subscriptions::worker` - Polls subscription updates (10-min interval, 4 concurrent)
   - `mikan::preheat` - Preheats RSS cache (15-min interval, 4 concurrent)
   - `downloader::monitor` - Tracks download status continuously

4. **Caching Strategy**: Two-layer caching
   - SQLite `cache.sqlite` for RSS/API data
   - `~/.animefun/images/` for media files

## Data Storage

All user data in `~/.animefun/`:
- `data.sqlite` - Subscriptions, user preferences
- `cache.sqlite` - Temporary cached data
- `images/` - Downloaded cover art

## External Dependencies

- **Bangumi API** - Anime metadata, episodes, search (OpenAPI spec in `docs/bangumi_api.yml`)
- **Mikan Project** - Torrent RSS feeds
- **Torrent Clients** - qBittorrent or Transmission (configurable in settings)

## Adding New Features

1. **Rust-first**: Define models in `src-tauri/src/models/` with `#[ts_rs]` macro
2. **Generate types**: Run `pnpm types:gen` (executes `cargo test` which exports TS types)
3. **Implement command**: Add handler in `src-tauri/src/commands/`
4. **Register command**: Add to `src-tauri/src/lib.rs` `invoke_handler![]` macro
5. **Frontend integration**: Add wrapper to `src/lib/api.ts`, consume in hooks/components

## Releasing

To release a new version (e.g., v0.2.1 → v0.2.2):

1. Update version in `src-tauri/tauri.conf.json`
2. Update version in `src-tauri/Cargo.toml`
3. Commit the changes
4. Create and push git tag:

```bash
git tag -a v0.2.2 -m "Release v0.2.2"
git push origin v0.2.2
```
