import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { refreshAiSettings } from "../model/ai-settings";
import { AiChatSection } from "./ai-chat-section";
import { AiDeviceSection } from "./ai-device-section";
import { AiGenerationSection } from "./ai-generation-section";
import { AiProvidersSection } from "./ai-providers-section";

export function AiSection() {
  useMountEffect(refreshAiSettings);
  return (
    <>
      <AiChatSection />
      <AiDeviceSection />
      <AiGenerationSection />
      <AiProvidersSection />
    </>
  );
}
