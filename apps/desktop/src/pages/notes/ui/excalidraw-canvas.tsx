import { Excalidraw, hashElementsVersion, loadFromBlob, MainMenu, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { useRef, useState } from "react";
import { useDarkTheme } from "../../../entities/settings/hooks/use-dark-theme";
import { editNote, latestBody, type OpenNote } from "../model/notes-store";
import "@excalidraw/excalidraw/index.css";
import "./excalidraw-theme.css";

const sceneKey = (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) =>
  [
    hashElementsVersion(elements),
    appState.viewBackgroundColor,
    appState.gridSize,
    appState.gridStep,
    appState.gridModeEnabled,
    Object.keys(files).length,
  ].join("|");

export function ExcalidrawCanvas({ note }: { note: OpenNote }) {
  const [initialData] = useState(() =>
    loadFromBlob(new Blob([latestBody(note.id)]), null, null).then((scene) => ({ ...scene, scrollToContent: true })),
  );
  const lastScene = useRef<string | null>(null);
  const dark = useDarkTheme();

  return (
    <div className="h-full min-h-0 w-full flex-1">
      <Excalidraw
        initialData={initialData}
        theme={dark ? "dark" : "light"}
        langCode="en-US"
        validateEmbeddable={false}
        onChange={(elements, appState, files) => {
          const scene = sceneKey(elements, appState, files);
          const loading = lastScene.current === null;
          if (scene === lastScene.current) return;
          lastScene.current = scene;
          if (!loading) editNote(note.id, serializeAsJSON(elements, appState, files, "local"));
        }}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, export: false } }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
