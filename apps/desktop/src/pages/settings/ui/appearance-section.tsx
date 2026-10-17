import { ColorsSection } from "./colors-section";
import { BackgroundSection } from "./background-section";
import { ThemeSection } from "./theme-section";

export function AppearanceSection() {
  return (
    <>
      <ThemeSection />
      <BackgroundSection />
      <ColorsSection />
    </>
  );
}
