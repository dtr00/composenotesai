# Tauri and Rust

How to apply FSD to the Rust side of a Tauri app (`src-tauri/src/`). This is
a project addition: official FSD covers frontends only. The same layers,
import rule, and public API rule apply, adapted to Rust modules.

## Two trees, one methodology

A Tauri app has two codebases that talk over IPC. Both follow FSD
independently; neither imports the other.

```text
src/                     ← frontend (React), standard FSD
  app/
  pages/
  features/
  entities/
  shared/
    api/                 ← typed wrappers around Tauri commands
src-tauri/src/           ← native (Rust), FSD adapted below
  main.rs                ← binary entry, calls lib::run()
  lib.rs                 ← declares layer modules, re-exports app::run
  app/
  commands/
  features/
  entities/
  shared/
```

`main.rs` and `lib.rs` stay at the crate root because Cargo requires them.
Keep both thin: `lib.rs` only declares the layer modules and re-exports
`app::run`.

## Layer mapping

| Frontend layer | Rust layer   | Rust purpose |
|----------------|--------------|--------------|
| `app/`         | `app/`       | Tauri builder: plugins, managed state, setup hooks, command registration, platform fixes |
| `pages/`       | `commands/`  | Tauri commands the frontend invokes. The entry surface, like pages are for users |
| `features/`    | `features/`  | Native capabilities: vault file operations, audio recording, local model management |
| `entities/`    | `entities/`  | Domain types shared by several features, such as a note or vault config |
| `shared/`      | `shared/`    | Domain-free infrastructure: error type, path safety, atomic writes, config paths |

`widgets/` and `processes/` have no Rust equivalent. Do not create them.

Import order is the same as the frontend:
`app` > `commands` > `features` > `entities` > `shared`.

## Segments

Rust slices use segments too, renamed where the frontend names do not fit:

- **`model`**: domain types, state, business logic, validation.
- **`io`**: side effects: file system, processes, devices, network. The
  Rust counterpart of `api/`.
- **`config`**: constants and settings for the slice.
- **`util`**: internal helpers. The counterpart of `lib/`, renamed so it is
  not confused with the crate's `lib.rs`.

There is no `ui` segment on the Rust side. A small slice may be a single
file (`features/vault.rs`) until it needs segments.

## Public API: `mod.rs`

Each slice exposes its public API from `mod.rs` with `pub use`. Segments
stay private, so the compiler enforces the public API rule: code outside
the slice cannot reach into `model` or `io`.

```rust
// features/vault/mod.rs
mod io;
mod model;

pub use model::{Entry, Vault};
pub use io::{read_note, write_note};
```

```rust
// commands/notes.rs
use crate::features::vault::{read_note, Vault};          // ✓ public API
use crate::features::vault::io::scan_dir;                // ✗ does not compile: io is private
```

Use `pub(crate)` or narrower for items that do not need to leave the
slice. Nothing in a Tauri app needs to be visible outside the crate except
`run`.

## Commands layer

Commands are thin adapters between IPC and features:

1. Take arguments and managed state.
2. Call one or more features.
3. Map results and errors into serializable return types.

No business logic lives in a command. If two commands repeat the same
logic, extract it to `features/`.

Group commands into slices by the frontend area they serve
(`commands/notes.rs`, `commands/models.rs`). Register every command in
`app/`, which is the only place that knows the full command list.

## App layer

`app/` owns everything that runs once at startup:

- `tauri::Builder` configuration and plugin registration.
- Managed state (`.manage(...)`) and `setup` hooks.
- The `invoke_handler` with all commands.
- Platform fixes such as environment variables set before the webview
  starts (the call lives in `main.rs` if it must run before anything else).

Like the frontend `app/`, it has no slices, only segments or files.

## Cross-slice dependencies

Features must not import each other. When two features need to work
together, compose them from a higher layer (Strategy C):

```rust
// commands/voice.rs: the command connects two features
let audio = features::audio::stop_recording(&state.recorder)?;
let text = features::transcription::transcribe(&audio)?;
features::vault::append_to_note(&state.vault, &note, &text)?;
```

If two features keep sharing the same types, move those types to
`entities/` (Strategy B). The `@x` notation is not used in Rust.

## The IPC boundary

The frontend and Rust share no code, so keep their contract in two
mirrored places:

- Rust: argument and return types are `serde` structs owned by the
  command slice, or by an entity when several commands share them.
- Frontend: `src/shared/api/` holds one typed wrapper per command and the
  matching TypeScript types. Pages and features call these wrappers, never
  `invoke` directly.

When a command changes, update both sides in the same change.

## Starting minimal

Start with `app/`, `commands/`, and `shared/`. Add `features/` when a
command's logic grows large or a second command needs it. Add `entities/`
only when two features share domain types. Do not create empty layer
folders in advance.

## Tests

Unit tests live next to the code in `#[cfg(test)] mod tests` inside the
segment file. Test features through their public API; commands stay thin
enough that they rarely need their own tests.
