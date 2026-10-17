# Repository architecture

Compose Notes AI is a monorepo managed by [Bun workspaces](https://bun.sh/docs/install/workspaces). Bun installs every workspace from the root, links local packages to each other, and runs scripts across them. No other build orchestrator is used.

## Layout

```
composenotesai/
├── apps/
│   ├── desktop/            # the Tauri desktop app (@composenotes/desktop)
│   └── web/                # the website, TanStack Start (@composenotes/web)
├── packages/               # shared code used by more than one app (empty for now)
├── branding/               # source artwork: app icon, logo marks, website icons
├── docs/                   # project documentation
├── .github/workflows/      # release.yml: builds and publishes the desktop app
├── .agents/                # agent skills and subagents
├── .claude/ .cursor/       # agent tool folders, linked to .agents/
├── AGENTS.md               # rules for AI agents
├── package.json            # workspace list, root scripts, shared lint and format tools
├── bun.lock                # the only lockfile
├── eslint.config.js        # one ESLint config for the whole repo
└── .prettierrc.json        # one Prettier config for the whole repo
```

| Folder          | Package name            | What it is                                                                |
| --------------- | ----------------------- | ------------------------------------------------------------------------- |
| `apps/desktop/` | `@composenotes/desktop` | The note-taking app: React frontend and Rust backend in Tauri 2.          |
| `apps/web/`     | `@composenotes/web`     | The marketing and download website, built with TanStack Start.            |
| `packages/*`    | `@composenotes/<name>`  | Shared packages. None exist yet; see [Shared packages](#shared-packages). |

`apps/` holds things that are built and shipped on their own. `packages/` holds code that apps import. An app never imports from another app.

## Root commands

Run these from the repository root.

| Command                           | What it does                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bun install`                     | Installs dependencies for every workspace.                                                                       |
| `bun run dev:desktop`             | Starts the desktop app in development (Vite on port 1420 plus Tauri).                                            |
| `bun run dev:desktop --port=1437` | Same, on another port. Extra arguments are passed to `tauri:dev`.                                                |
| `bun run web <script>`            | Runs a script inside `apps/web`, for example `bun run web dev` (dev server on port 3000, or the next free port). |
| `bun run desktop <script>`        | Runs a script inside `apps/desktop`, for example `bun run desktop preview`.                                      |
| `bun run tauri <args>`            | Runs the Tauri CLI inside `apps/desktop`, for example `bun run tauri build`.                                     |
| `bun run build`                   | Builds the frontend of every workspace that has a `build` script.                                                |
| `bun run lint`                    | Runs ESLint over the repository.                                                                                 |
| `bun run format`                  | Formats with Prettier.                                                                                           |
| `bun run format:check`            | Checks formatting without changing files.                                                                        |

The `web`, `desktop`, `dev:desktop` and `tauri` scripts use `bun run --cwd <app>`, so anything you type after them goes to that app and its output is shown as is. `bun run build` uses `bun run --filter '*'`, which runs the script in every workspace and prefixes each line with the package name.

To run a script in one workspace, use either form:

```sh
bun run --cwd apps/desktop preview
bun run --filter @composenotes/web build
```

## Dependencies

- Each workspace declares every package it imports in its own `package.json`. Add a dependency to the workspace that uses it:

  ```sh
  bun add zod --filter @composenotes/web
  bun add -d @types/node --filter @composenotes/desktop
  ```

- The root `package.json` holds only tools that run across the whole repository: ESLint and its plugins, Prettier and TypeScript (needed by `typescript-eslint`). It has no runtime dependencies.
- There is one lockfile, `bun.lock`, at the root. Commit it. Never create a lockfile inside an app.
- Bun uses the isolated install layout for this workspace (`"configVersion": 1` in `bun.lock`). Packages are stored once in `node_modules/.bun/`, and each workspace gets its own `node_modules/` with links to exactly the packages it declares. An import of a package that the workspace does not declare fails, even if another workspace uses it.
- Local packages are referenced with the workspace protocol, for example `"@composenotes/theme": "workspace:*"`.

## Desktop app (`apps/desktop/`)

The Tauri app, moved here unchanged from the repository root. Paths inside it are relative to `apps/desktop/`.

```
apps/desktop/
├── src/                    # React frontend, Feature-Sliced Design
├── src-tauri/              # Rust crate, Tauri config, icons, capabilities
├── scripts/                # dev launcher, Excalidraw font copy, unit and browser tests
├── public/                 # generated at build time (Excalidraw fonts), ignored by Git
├── index.html              # main window entry
├── voice-overlay.html      # voice overlay window entry
├── vite.config.ts
├── tsconfig.json, tsconfig.node.json
├── components.json         # shadcn/ui config
└── package.json
```

- **Frontend.** `src/` follows Feature-Sliced Design with the layers `app`, `pages`, `features`, `entities` and `shared`. The layer rules are described in `AGENTS.md` and enforced by ESLint for files under `apps/*/src/`.
- **Native code.** `src-tauri/` is a single Rust crate with the same layer structure (`app`, `commands`, `features`, `entities`, `shared`). There is no Cargo workspace; run Cargo inside `apps/desktop/src-tauri/`. Build output goes to `apps/desktop/src-tauri/target/`.
- **Tauri config.** `src-tauri/tauri.conf.json` runs `bun run dev` and `bun run build` in `apps/desktop/` and loads the built frontend from `apps/desktop/dist/`.
- **Dev launcher.** `scripts/tauri-dev.ts` starts Tauri with Vite on a chosen port. `bun run dev:desktop` calls it.
- **Tests.** Unit tests live in `scripts/*.test.ts` and run with `bun test` from `apps/desktop/`. Browser checks open `/scripts/browser-check.html?test=<name>` on the running Vite server. Rust tests run with `cargo test` in `src-tauri/`.
- **shadcn/ui.** Run `bunx --bun shadcn@latest add <name>` from `apps/desktop/`. Components go to `src/shared/ui/`, and the theme tokens are in `src/app/styles.css`.

## Website (`apps/web/`)

The marketing and download site, built with [TanStack Start](https://tanstack.com/start) and prerendered to static HTML. It was created with the TanStack CLI (`bunx --bun @tanstack/cli@latest create web --framework React --package-manager bun --no-install --no-git --no-intent -y`) and then rebuilt on the repository's frontend rules.

```
apps/web/
├── public/                 # favicons, web manifest and app icon (copied from branding/website/), screenshots in shots/
├── src/
│   ├── router.tsx          # creates the router (location required by TanStack Start)
│   ├── routeTree.gen.ts    # generated by the router plugin; do not edit
│   ├── routes/             # file routes, part of the app layer: __root.tsx, index.tsx, product.tsx, download.tsx
│   ├── app/                # styles.css (tokens and components), site header, footer and page transition
│   ├── pages/
│   │   ├── home/           # page.tsx, config/shots.ts, lib/shaders.ts (dither visuals), ui/ (one file per section)
│   │   ├── product/        # page.tsx, config/shots.ts, ui/product-section.tsx (notes, drawings, AI chat, dictation, customization)
│   │   └── download/       # page.tsx, config/builds.ts, lib/ + hooks/ (platform detection), ui/
│   └── shared/             # config/ (site facts, Shot type), lib/ (dither, glitch, waveform), ui/ (dither canvas, glitch text, icon list, copy button)
├── vite.config.ts          # Tailwind, TanStack Start with prerendering, React
├── tsconfig.json           # `@/*` points at `src/`
└── package.json
```

- `bun run web dev` serves it on port 3000 (the next free port if taken). `bun run build` type-checks, builds and prerenders every page; the static site is `apps/web/dist/client/` and can be served by any static host.
- Route files stay thin: they declare the route and its head tags and render a page from `src/pages/<name>/page.tsx`. Router file names (`__root.tsx`, `index.tsx`, `$param.tsx`) are allowed exceptions to the kebab-case and no-`index` rules.
- `src/routeTree.gen.ts` is regenerated on every dev and build run and is committed so type checking works before the first run. Prettier and ESLint skip it.
- The site follows the same lint and format rules as the desktop app, including Feature-Sliced Design imports and the `useEffect` ban. Canvas animations attach through ref callbacks that return a cleanup function.
- Site-wide facts (app name, repository and release links) live in `src/shared/config/site.ts`. Download buttons in `src/pages/download/config/builds.ts` link straight to files in the latest GitHub release (`releases/latest/download/<name>`), so the names there must match the ones the release workflow uploads (see [Releases](#releases)).

### Design

The site is dark only and aims for the restraint of a product site like Linear: real screenshots, one accent color, careful type and very little decoration. Its palette lives in `src/app/styles.css` and is separate from the desktop app's theme, though the accent is a lighter shade of the app's own blue.

| Token         | Value     | Use                                            |
| ------------- | --------- | ---------------------------------------------- |
| `canvas`      | `#08090a` | Page background                                |
| `surface`     | `#0e0f11` | Cards and screenshot frames                    |
| `raised`      | `#16171a` | Secondary buttons and icon tiles               |
| `line`        | `#1d1e21` | Card borders, dividers and the backdrop grid   |
| `line-strong` | `#2a2b2f` | Button and frame borders                       |
| `text`        | `#f7f8f8` | Headings and body text, primary button         |
| `muted`       | `#8a8f98` | Secondary text                                 |
| `faint`       | `#62666d` | Tertiary text                                  |
| `accent`      | `#6aa6ff` | The single accent: highlights and dither light |

- **Type:** Inter (variable, with optical sizing) for everything, bundled through Fontsource so the site requests nothing from other servers. Headings use weight 590 and tight tracking (`display-1`, `display-2`), body copy uses `lead` or 15px text in `muted`. Commands use the system monospace.
- **Shape:** buttons 8px, screenshot frames 12px, cards 16px.
- **Components** (`styles.css`): `btn-primary`, `btn-secondary` (optionally `btn-small`), `nav-link`, `text-link`, `frame` (screenshot frame with an inner highlight), `card` (bordered panel with a soft top highlight), `fade-bottom` and `light-mask` (masks), `grid-backdrop` (a faint 64px grid that fades out from the top of the hero, download header and closing section).
- **Motion:** the hero copy rises in with a short blur (`enter`, staggered with `--delay`) and the hero screenshot tilts up into place (`tilt-in`). Page changes dissolve through an 8x8 Bayer pattern in the page color (`PageTransition`). Everything animated stops under `prefers-reduced-motion`.
- **Storage card:** "Small on purpose" compares 21 dithered squares (one per KB of plain text, `storage-dither`) with 3 accent squares (what the app stores), above a crop of the app's own Storage page that shows the same numbers.
- **Dithering:** `DitherCanvas` (`src/shared/ui/dither-canvas.tsx`) draws any shader, `(width, height, seconds) => (x, y) => density`, set up once per frame and sampled per pixel, through an 8x8 Bayer matrix into a small canvas scaled up with `image-rendering: pixelated`. It pauses off screen and draws a single frame under reduced motion. Its color comes from the `--ink` custom property. The shaders are:
  - `heroLight` (`src/pages/home/lib/shaders.ts`): a soft accent-colored light behind the hero screenshot.
  - `voiceWave` (`src/shared/lib/waveform.ts`): the dictation waveform, used on the home and product pages.
  - `noteGraph` (`src/pages/home/lib/shaders.ts`): a slowly rotating 3D cloud of notes in clusters, with links between related notes pulsing, for the privacy section.
  - `footerFade` (`src/app/ui/site-footer.tsx`): a faint accent fade at the bottom of the site footer.

### Screenshots

App screenshots live in `apps/web/public/shots/` as WebP, and their sizes and alt text in each page's `config/shots.ts`. The home and product pages use different demo notes, so no picture appears twice. They are taken from the real app in its dark theme at 1440x900 and a device scale of 2, with demo notes seeded through the app's own commands, and converted with ImageMagick (below). The product page's customization section shows a custom sky blue accent and a Dither background image, next to a crop of the Appearance settings that produce it.

```sh
magick shot.png -resize 2000x -quality 84 apps/web/public/shots/shot.webp
```

## Releases

`.github/workflows/release.yml` publishes the desktop app. It runs on every push to `main` that touches `apps/desktop/`, `bun.lock` or the workflow, and can be started by hand from the Actions tab.

- A release is made only for a new version. The app's version lives only in `apps/desktop/src-tauri/Cargo.toml` (Tauri reads it from there), and the workflow stops if release `v<version>` already exists. To ship, bump that version and merge to `main`.
- It creates a draft release, builds macOS (one universal build for Apple Silicon and Intel), Linux and Windows in parallel, and publishes the release only when every build has uploaded. If a build fails, the draft is replaced on the next run, so the latest release is never missing files.
- Files are uploaded without the version in their names: `compose-notes-ai-macos-universal.dmg`, `compose-notes-ai-windows-x64-setup.exe`, `compose-notes-ai-windows-x64.msi`, `compose-notes-ai-linux-x64.deb` and `compose-notes-ai-linux-x64.AppImage`. The website links to these names, so change both together.
- The macOS app is only ad-hoc signed (`signingIdentity: "-"`) and the Windows installers are unsigned, which is why the download page explains Open Anyway and SmartScreen.
- The release also carries the signed update bundles and `latest.json` that the in-app updater reads. Signing needs the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, matching the `pubkey` in `tauri.conf.json`.
- The workflow only runs in `dtr00/composenotesai`, the public repository that the website and the in-app updater read from, so a copy of the repository never publishes its own releases.

## Shared packages

`packages/` is listed in the workspaces but is empty. Create a package only when two apps need the same code; until then, keep code in the app that uses it. The website has its own palette on purpose, so the two apps do not share theme tokens.

A new package follows this shape:

```
packages/<name>/
├── src/
└── package.json
```

```json
{
  "name": "@composenotes/<name>",
  "private": true,
  "type": "module",
  "exports": {
    "./tokens.css": "./src/tokens.css"
  }
}
```

- Name it `@composenotes/<name>` and keep it private.
- Export source files directly through `exports`; there is no build step for shared packages.
- List each public file in `exports` instead of re-exporting through an `index.ts`.
- Apps depend on it with `"@composenotes/<name>": "workspace:*"`, then run `bun install` at the root.

## Adding an app

1. Create the app in `apps/<name>/`, without its own lockfile or Git repository.
2. Set its `package.json` name to `@composenotes/<name>`.
3. Run `bun install` at the root.
4. Add `dev:<name>` to the root scripts if it has a dev server.
5. Decide whether it follows the shared lint and format rules from the start; if not, ignore it in `eslint.config.js` and leave it out of the `format` scripts.
6. Document it in this file and in `AGENTS.md`.

## Shared files at the root

- `branding/` holds the master artwork. The desktop icons in `apps/desktop/src-tauri/icons/` and the website icons in `branding/website/` are rendered from it. See `branding/README.md`.
- `docs/` holds documentation for the whole project, including this file and the [Excalidraw agent interface](excalidraw.md).
- `.agents/skills/` and `.agents/agents/` hold the agent skills and subagents. `.claude/` and `.cursor/` point to them.
