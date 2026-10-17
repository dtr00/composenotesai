# Compose Notes AI

Lightweight, local-first AI note-taking app. Notes are stored in one compressed SQLite database on your machine; AI runs on a locally hosted model.

Built with Tauri 2, Vite, React and TypeScript. The repository is a Bun workspaces monorepo holding the desktop app (`apps/desktop/`) and the website (`apps/web/`); see [Repository architecture](docs/architecture.md).

## Development

Requires [Bun](https://bun.sh) and [Rust](https://rustup.rs), plus the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```sh
bun install
bun run dev:desktop
```

To run the dev server on another port (the default is 1420), for example next to an instance that is already running:

```sh
bun run dev:desktop --port=3000
```

## Website

The website is a TanStack Start app in `apps/web/`:

```sh
bun run web dev
```

## Excalidraw

Choose **New Excalidraw note** from the sidebar, new tab, or a folder's menu. Drawings start as `Untitled excalidraw note`, then `Untitled excalidraw note 1`, and so on.

Excalidraw comes with the app. Its editor and fonts work offline immediately, and drawings stay in the notes database.

AI agents can create, read, edit and duplicate drawings through the app's JSON command-line interface. See [Excalidraw and agent access](docs/excalidraw.md).

## Building

```sh
bun run tauri build
```

Linux produces `.deb` and AppImage packages; Windows and macOS use their default installers.

To publish a release, bump the app version and merge to `main`. See [Releases](docs/architecture.md#releases).
