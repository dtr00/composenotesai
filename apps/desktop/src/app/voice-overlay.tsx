import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startSettings } from "../entities/settings/model/settings-store";
import { startVoiceNote } from "../features/voice-note/model/voice-note";
import { VoiceOverlayPage } from "../pages/voice-overlay/page";
import { loadSettings } from "../shared/api/settings";
import { IconProvider } from "../shared/ui/icon-provider";
import "./styles.css";

async function start() {
  const [settings] = await Promise.all([loadSettings(), startVoiceNote()]);
  startSettings(settings);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <IconProvider>
        <VoiceOverlayPage />
      </IconProvider>
    </StrictMode>,
  );
}

start().catch((error: unknown) => console.error(error));
