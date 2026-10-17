import { AiSection } from "./ui/ai-section";
import { ClosingSection } from "./ui/closing-section";
import { FeatureGrid } from "./ui/feature-grid";
import { Hero } from "./ui/hero";
import { PrivacySection } from "./ui/privacy-section";

export function HomePage() {
  return (
    <>
      <Hero />
      <AiSection />
      <FeatureGrid />
      <PrivacySection />
      <ClosingSection />
    </>
  );
}
