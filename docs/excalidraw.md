# Excalidraw and agent access

Drawing notes use `format: "excalidraw"`. Their bodies are standard Excalidraw version 2 JSON, compressed with zstd in the same `notes.db` as Markdown notes. Embedded images are stored in the scene's `files` map. Titles remain separate. Existing notes default to `format: "markdown"`.

New drawings use `Untitled excalidraw note`, `Untitled excalidraw note 1`, and successive free numbers. The allocator checks all live note titles, ignores case, and reuses gaps. Copies use the existing `copy` and `copy 1` naming convention. Folder moves, copies, trash and restoration preserve the drawing format and scene.

## Built-in editor

Excalidraw comes with the app. Choose **New Excalidraw note** from the sidebar, new tab, or a folder's menu to start drawing immediately. The editor loads when a drawing is opened; its code and fonts are bundled locally, so opening drawings does not require a download or network connection.

Press **Ctrl+Shift+N**, or **Cmd+Shift+N** on macOS, to create a drawing in a new tab. A blank tab is reused. Change the shortcut under **Settings > Keybindings > General**.

The app uses Excalidraw 0.18.1 as a React component. Vite includes the package's font assets in the application build and serves the same files during development. Scene changes use the existing autosave queue. Embedded websites are disabled. The note options menu exports standard `.excalidraw` files.

Drawing controls follow the app's light and dark theme, including surfaces, text, accents, inputs and menus. Use the notes sidebar to manage drawings. The editor's library and help buttons are hidden, and its menu omits Open and Save to.

At startup, the notes store checks the actual schema and adds a missing `format` column with a Markdown default. This also upgrades databases whose migration version is higher from another feature branch, preserving their existing compressed bodies and migration version.

## Built-in AI chat

Open the AI panel and ask about the active drawing, mention it with `@`, or attach it or its folder to a message. `read_note` provides a compact description of visible text, labelled shapes, scene coordinates, groups, frames, colours and connector bindings. Reads include unsaved canvas changes. The same description is used for note and folder attachments. Search matches titles and drawing text, excluding deleted elements, JSON metadata and embedded image data.

### Seeing drawings

Every built-in model has an optional vision download (its matching llama.cpp projector) under Settings > AI > On this device. Once it is added, the model picker labels the model "Sees images", and the AI gets a read-only `view_drawing` tool. The tool renders the latest scene locally with Excalidraw's `exportToBlob`: unsaved edits, embedded pictures and freehand strokes are included, deleted elements and editor controls are not. Fonts load from the app. The tool returns the image together with the structural description.

- Images are PNG, or JPEG when a PNG would be too big. The longest side is at most 1536 px, the image has at most 1.6 megapixels, and it is under 1.5 MB. Small sketches are enlarged up to 2x. Large boards are shrunk, and the tool result says how much, because small details become unreadable.
- Tool results stay text. The image is sent in a separate user message after the tool results, so tool-call ordering stays valid. At most 4 images go into one request, newest first, and older ones are replaced by a note.
- The saved chat keeps the exact images the model saw for its 4 newest drawing views, the same ones that can be sent again. Reopening the chat replays them even after the drawing changes. Older views keep only their text, which keeps chats under the 16 MB save limit. Deleting the chat deletes the images. Note bodies never get derived PNGs.
- Images go only to this device's engine, or to Ollama models that report `vision` and are not Ollama cloud models. OpenAI-compatible servers never receive images. The native side rejects images in any other case, after checking the Ollama model itself. If a chat continues on a model that can't see images, earlier images are left out of the request.
- Without vision, the system prompt tells the model it can only read drawing structure. It should then say that handwriting, sketches and pictures are not visible to it.

Without vision, the model receives drawing structure as text only. The AI can rename drawings, but its Markdown writing, appending and text-replacement tools reject them before previewing or changing their bodies. The headless scene interface below remains available for agents that edit Excalidraw JSON directly.

## JSON interface for AI agents

Run the installed app executable with `--agent --data-dir <app data folder>`. It reads one JSON request from standard input, writes one JSON response to standard output, and exits without opening a window. On Windows the app has no console, so redirect or pipe its output, for example `composenotesai.exe --agent --data-dir <folder> < request.json > response.json`. A successful response is `{"ok":true,"result":...}` with exit code 0; failures use `{"ok":false,"error":"..."}` with exit code 1.

The data directory must be supplied explicitly. Typical installed-app paths are:

- Linux: `$XDG_DATA_HOME/com.composenotes.ai`, or `~/.local/share/com.composenotes.ai`.
- macOS: `~/Library/Application Support/com.composenotes.ai`.
- Windows: `%APPDATA%\com.composenotes.ai`.

Debug builds use the identifier ending in `.dev`. Agent checks should use a separate temporary folder. The selected folder contains `notes.db`; use the same folder when targeting an existing installation.

For example, in a development checkout:

```sh
printf '%s\n' '{"op":"create","format":"excalidraw"}' |
  apps/desktop/src-tauri/target/debug/composenotesai --agent --data-dir /tmp/compose-agent-notes
```

Requests:

```json
{"op":"list"}
{"op":"create","format":"excalidraw","title":"Architecture","parentId":null}
{"op":"load","id":1}
{"op":"save","id":1,"scene":{"type":"excalidraw","version":2,"elements":[{"id":"box","type":"rectangle","x":20,"y":20,"width":200,"height":100}],"appState":{},"files":{}}}
{"op":"duplicate","id":1}
{"op":"rename","id":1,"title":"System diagram"}
```

`create` defaults to Markdown if `format` is omitted. `load` returns the note metadata and body; drawings also include a parsed `scene` object. `list` returns all live entries, including each note's `format` and `parentId`. `save` accepts drawings only. Preserve scene fields and embedded files when editing a loaded scene. IDs must be unique nonempty strings; elements must have a supported type and numeric `x`, `y`, `width`, and `height`. The editor fills in missing styling defaults. Invalid scenes and requests larger than 64 MB are rejected before changing saved data.

Agents can use this interface offline without opening the editor. Save and close the drawing in the UI before editing it through the CLI, then reopen it to load the agent's changes. The CLI uses the database directly and does not send notifications to open windows.

The same operations are available through native IPC: `create_note` (with `format: "excalidraw"`), `list_entries`, `load_note`, `save_note`, `duplicate_entry` and `rename_note`. `save_note` takes the serialized scene in `body` and validates drawing notes before saving.

## Verification

```sh
bun run build
bun run lint
cd apps/desktop
bun test scripts/excalidraw-context.test.ts scripts/ai-chat.test.ts
cd src-tauri
cargo test
```

With the Vite development server running, open `/scripts/browser-check.html?test=excalidraw` to verify the bundled editor, autosave, agent scene restoration and local fonts in a browser.

Open `/scripts/browser-check.html?test=ai-drawing` to check AI reads, attachments, unsaved changes, Markdown edit protection and the local AI harness. The harness check uses a mocked model stream to verify the context passed to the local provider; it does not evaluate a model's reasoning quality.

Open `/scripts/browser-check.html?test=drawing-vision` to check real drawing rendering: shapes, embedded pictures, freehand strokes, deleted elements, unsaved edits, size limits, local fonts, caching, image message order and image history.

To test a real vision model through the Rust engine, write a PNG as base64 to a file and run in `apps/desktop/src-tauri/`:

```sh
CN_LLAMA_SERVER_DIR=<folder with llama-server> CN_LLAMA_MODEL=<model.gguf> CN_LLAMA_MMPROJ=<projector.gguf> \
CN_TEST_IMAGE_BASE64=<image.b64> CN_TEST_IMAGE_WORD=<word in the image> \
cargo test --lib -- --ignored a_real_vision_model
```
