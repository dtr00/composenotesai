# Code Development for AI Agents

Guide for AI agents working on **Compose Notes AI**, a lightweight, local-first AI note-taking app. Notes are stored locally in one compressed SQLite database, and AI runs on a locally hosted model.

## Principles

- **Everything is local.** No cloud dependency by default; cloud AI providers are opt-in add-ons.
- **Keep it light.** Stored notes should be as small as possible. Prefer small dependencies and native platform features. Only the local model should be heavy.
- **Ship to all three platforms.** Linux (`.deb` + AppImage), Windows and macOS.

## Stack

- Bun workspaces (monorepo)
- Tauri 2
- Rust
- React
- TypeScript
- Vite
- Tailwind CSS v4
- TanStack Start (website)

## Skills

Repository skills live under `.agents/skills/` and are grouped by namespace. Use the narrowest matching skill for the task, and read its `SKILL.md` before applying specialized guidance.

- `architecture-*`: module and interface design, where boundaries go, finding refactors that deepen modules, and Feature-Sliced Design for frontend structure.
- `backend-*`: Rust idioms, error handling, performance, and testing in `apps/desktop/src-tauri/`.
- `frontend-*`: React, Vite, TanStack Start, Tailwind CSS and design tokens, shadcn, animation, visual design, UI polish, and frontend performance.
- `pstack-*`: from Cursor's [pstack](https://github.com/cursor/plugins/tree/main/pstack) plugin by Lauren Tan (MIT), installed as dependencies of `quality-no-comments`: code walkthroughs, design rationale, design sketches, parallel candidates, adversarial review, and debugging principles.
- `quality-*`: clean code principles, strict code quality reviews, AI slop cleanup, and comment cleanup.
- `workflow-*`: minimal solutions, test-driven development, and conventional commits.

Subagents live under `.agents/agents/` and are symlinked into `.claude/agents/` and `.cursor/agents/`. `pstack-comment-sicko` is used by `quality-no-comments`.

## Project rules

- Bun environment: use `bun`/`bunx`, never npm, npx, yarn or pnpm.
- The repo is a Bun workspaces monorepo: apps in `apps/`, shared packages in `packages/`. Run `bun install` and the root scripts from the repository root. Add each dependency to the workspace that imports it (`bun add <pkg> --filter @composenotes/<app>`), never to the root, which only holds repo-wide tools. Do not add a build orchestrator or a second lockfile. See `docs/architecture.md`.
- An app never imports from another app. Code needed by two apps moves to a package in `packages/`.
- Desktop UI in `apps/desktop/src/`; native work (files, processes, audio, local model) in `apps/desktop/src-tauri/` as Tauri commands.
- Notes live in one SQLite database (`notes.db` in the app data folder). Bodies are zstd-compressed with a trained dictionary, and each row records its `dict_id` so dictionaries can change without breaking older notes.
- Markdown note bodies use CommonMark plus GitHub tables and task lists. Excalidraw note bodies use version 2 scene JSON; the `format` column distinguishes them. Both use the existing zstd compression. Titles are stored separately, not as a heading in the body. Plain text is valid Markdown, so older note bodies need no migration.
- Code must work on Linux, Windows and macOS.
- Keep the `WEBKIT_DISABLE_DMABUF_RENDERER` fix in `apps/desktop/src-tauri/src/main.rs`.
- Debug builds append `.dev` to the app identifier, so dev runs keep their own data folder and never touch the installed app's notes or caches.
- Prefer stdlib and native features over new dependencies.
- Install skills to `.agents/skills/` as `<group>-<name>`.
- Add desktop UI components with `bunx --bun shadcn@latest add <name>` run from `apps/desktop/`; `components.json` sends them to `src/shared/ui/` and imports `cn` from the `cn` package. Style with the theme tokens in `apps/desktop/src/app/styles.css` (preset `b5KHubfD0`), not raw colors. Use `lucide-react` for all icons.
- Do not use the HTML `title` attribute for hover hints. Use the `Tooltip` component from `apps/desktop/src/shared/ui/tooltip.tsx` instead.
- Context menu and dropdown menu items are text only. Do not add icons to them.
- Do not use em dashes in code, comments, documentation, or user-facing frontend text.
- Do not use `any` in TypeScript, explicit or implicit. Use precise types, or `unknown` and narrow it.
- Name files and folders in kebab-case (`note-editor.tsx`, `notes-store.ts`). Exceptions: Rust files use snake_case (module names cannot contain hyphens), conventional files keep their names (`README.md`, `AGENTS.md`, `SKILL.md`, `Cargo.toml`), and TanStack Router route files use the names the router requires (`__root.tsx`, `index.tsx`, `$param.tsx`).
- No barrel exports: no `index.ts` files that re-export other modules. Import from the file that defines the export.

## Running the app as an agent

The user keeps their own `bun run tauri dev` running on port 1420. Agents have hung the session several times by waiting on the app with a loop that never ends. Follow these rules exactly:

- Use another port and a separate identifier so you never touch the user's server or `notes.db`.
- Start it from the repository root with `bun run dev:desktop`.
- Run the app in the background with its output in a log file. Never run `tauri dev` in the foreground.
- Every wait must have a hard limit (`timeout 120 ...`). It must also stop when the process dies.
- Match a plain substring that has no colour codes in it, such as `target/debug/composenotesai`. Cargo colours its output even with `NO_COLOR` set, so a pattern like `Running target` never matches.
- Also match failures (`error`, `panicked`) so a crash ends the wait too.
- `cargo` may be missing from the agent shell's `PATH`. Prepend `$HOME/.cargo/bin`.
- Stop only what you started, by process group. Never `pkill -f vite` or `pkill -f tauri`.

```sh
LOG=/tmp/cn-agent-dev.log PIDFILE=/tmp/cn-agent-dev.pid
PATH="$HOME/.cargo/bin:$PATH" setsid bun run dev:desktop --port=1437 --config '{"identifier":"com.composenotes.ai.agent"}' > $LOG 2>&1 &
echo $! > $PIDFILE
timeout 120 sh -c 'until grep -qE "target/debug/composenotesai|[Ee]rror|panicked" "$1"; do kill -0 "$(cat "$2")" 2>/dev/null || exit 1; sleep 1; done' _ $LOG $PIDFILE
tail -5 $LOG

# When done:
kill -- -$(cat $PIDFILE)
```

AI agents can access drawings headlessly through `--agent --data-dir <folder>` and JSON on stdin. Use a temporary data folder for checks. See `docs/excalidraw.md` for the request contract.

## Pre-commit workflow

Before committing:

1. `bun run build` and `cargo test` (in `apps/desktop/src-tauri/`) pass.
2. The commit message follows Conventional Commits (`workflow-conventional-commit`).

Before pushing (steps 1 to 3 run on the changes being pushed, i.e. the diff against `origin/main`):

1. Run `quality-deslop`.
2. Run `quality-no-comments`.
3. Run `quality-thermo-nuclear-code-quality-review` and fix its findings. Repeat until it reports clean.
4. Run `bun run format` (Prettier) and `bun run lint` (ESLint). Fix every lint error.
5. Commit the fixes following the steps above, then push.

## Code architecture

The full layout, commands and conventions are in `docs/architecture.md`. In short:

- `apps/desktop/`: the Tauri desktop app (`@composenotes/desktop`).
- `apps/web/`: the website, a TanStack Start app (`@composenotes/web`).
- `packages/`: shared packages (`@composenotes/<name>`), empty for now.
- Root: `package.json` (workspaces, root scripts, repo-wide lint and format tools), `bun.lock`, `eslint.config.js`, `.prettierrc.json`, `branding/`, `docs/`, and agent tooling.

### Desktop app

Paths in this section are relative to `apps/desktop/`. Frontend code lives in `src/` and native code in `src-tauri/`.

- `src/`: React frontend, organized with Feature-Sliced Design (below).
- `src-tauri/`: Tauri app: Rust crate, app config, and bundle settings.
- `src-tauri/src/`: Rust source, organized with Feature-Sliced Design (below).
- `src-tauri/capabilities/`: permissions granted to the frontend.
- `src-tauri/icons/`: app icons for every platform.
- `src-tauri/gen/`, `src-tauri/target/`: generated output; do not edit.
- `scripts/`: dev launcher, Excalidraw font copy, unit tests (`bun test`) and browser checks.

### Feature-Sliced Design

In the desktop app, both `src/` and `src-tauri/src/` follow Feature-Sliced Design v2.1 (see `architecture-feature-sliced-design`). Start with the minimum layers; add others only when needed.

Frontend (`src/`), starting with `app/`, `pages/` and `shared/`:

- `src/app/`: app setup: entry point, providers, routing, and global styles.
- `src/pages/`: full screens such as notes and settings. Each page's entry is `src/pages/<name>/page.tsx`, with `ui/`, `model/`, and `api/` beside it as needed. New code starts here.
- `src/features/`: reusable user actions such as recording a voice note or `/ask`.
- `src/entities/`: domain models shared across pages, such as a note or vault. Use sparingly.
- `src/shared/`: domain-free code: Tauri command wrappers (`api/`), route paths (`config/`), small libraries such as the hash router (`lib/`), shared React hooks (`hooks/`), and shadcn/ui components (`ui/`).

Native (`src-tauri/src/`), starting with `app/`, `commands/` and `shared/`. `main.rs` and `lib.rs` stay at the root as crate entry points.

- `src-tauri/src/app/`: Tauri builder setup: plugins, managed state, and command registration.
- `src-tauri/src/commands/`: Tauri commands exposed to the frontend; replaces `pages/`. New code starts here.
- `src-tauri/src/features/`: native capabilities such as note storage and compression, audio recording, and local model management.
- `src-tauri/src/entities/`: domain types shared across features, such as a note or vault config. Use sparingly.
- `src-tauri/src/shared/`: domain-free code such as the error type.

Rules (both sides):

- Import only from lower layers: `app` > `pages`/`commands` > `features` > `entities` > `shared`.
- No imports between slices on the same layer.
- Frontend slices have no `index.ts`; import from the file that defines the export (this overrides the skill's `index.ts` rule). Rust slices declare their modules in `mod.rs` and keep internals private.
- Frontend React hooks (`use-*.ts`) live in a `hooks/` segment: `<slice>/hooks/` inside a slice, `src/shared/hooks/` in shared. Plain helpers that are not hooks stay in `lib/`. This overrides the skill's advice against a `hooks/` segment.
- No business logic in `shared/`.
- Do not use `widgets/` (discouraged) or `processes/` (deprecated).

### Website

`apps/web/` is the marketing and download site, a TanStack Start app prerendered to static HTML. Its design system (tokens, components, motion and dither shaders) is described in `docs/architecture.md`.

- Use the `frontend-tanstack-start` and `frontend-tanstack-start-best-practices` skills for framework questions. Where they conflict with this file, this file wins.
- Follow Feature-Sliced Design like the desktop app. Route files in `src/routes/` are part of the `app` layer and stay thin: they declare the route and render a screen from `src/pages/<name>/page.tsx`.
- Do not edit the generated `src/routeTree.gen.ts`.
- The site is dark only. Style with the tokens and component classes in `apps/web/src/app/styles.css`, not the desktop app's tokens or raw colors, and use dark-theme app screenshots. One accent color, used sparingly.
- Show the real app in screenshots instead of building fake UI. Use dithering only through `DitherCanvas` shaders, as quiet supporting visuals.
- Animations must respect `prefers-reduced-motion` and stop while off screen.
- Keep every claim on the site true to the app. Check the code before describing a feature.
