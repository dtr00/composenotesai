# Branding

Source artwork for the Compose Notes AI icon. The SVGs are the masters; everything else is rendered from them.

| File                    | Use                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `app-icon.svg`          | App icon on the 1024 grid with transparent padding. Source for `apps/desktop/src-tauri/icons/`. |
| `app-icon-1024.png`     | The app icon rendered at 1024 px, for stores and press.                                         |
| `app-icon-full.svg`     | Full-bleed square with no rounding, for platforms that round the corners themselves.            |
| `app-icon-maskable.svg` | Full-bleed with the note inside the maskable safe zone, for Android and PWA.                    |
| `logo-mark.svg`         | The note on its own, transparent, for headers and inline use.                                   |
| `logo-mark-mono.svg`    | One-color note that follows `currentColor`, for light and dark themes.                          |

Regenerate the app icons after changing `app-icon.svg`:

```sh
rsvg-convert -w 1024 branding/app-icon.svg -o branding/app-icon-1024.png
bun run tauri icon ../../branding/app-icon-1024.png
```

The root `tauri` script runs inside `apps/desktop/`, so the image path is relative to that folder. `tauri icon` also writes `android/` and `ios/` folders and a `64x64.png` in `apps/desktop/src-tauri/icons/`; the app does not ship those, so delete them.

## Website

`website/` holds files ready to copy into the site's public root:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#0e0e0e" />
```
