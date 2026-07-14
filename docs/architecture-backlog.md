# Architecture backlog

Deferred after the 2026-07 backend cleanup. Revisit in this order.

## 1. Consume Profile query errors in the frontend

- Files: `src/hooks/use-profile.ts`, `src/components/ProfileEditDialog.tsx`
- Backend Profile commands now return structured errors. The sidebar has display fallbacks, but the edit dialog should show a load error or disable mutation instead of initializing an empty form after a failed query.

## 2. Revisit application state only when globals block tests or lifecycle work

- Files: `src-tauri/src/infra/db.rs`, `src-tauri/src/infra/http.rs`, `src-tauri/src/services/downloader/client.rs`, `src-tauri/src/infra/notification.rs`
- Keep concrete global state for now. Move values into Tauri-managed application state only when test isolation, shutdown, or replacement of a real adapter requires it; do not add traits preemptively.
