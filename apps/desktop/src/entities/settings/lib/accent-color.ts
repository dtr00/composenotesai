import { formatOklch, hexToRgb, rgbToOklch } from "../../../shared/lib/color";
import { withoutTransitions } from "../../../shared/lib/without-transitions";

const CHART_LIGHTNESS = [0.828, 0.685, 0.588, 0.5, 0.443];
const CHART_CHROMA_SCALE = [0.83, 1.26, 1.18, 1, 0.82];
const CHART_TOKENS = CHART_LIGHTNESS.map((_, i) => `--chart-${i + 1}`);
const PRIMARY_TOKENS = ["--primary", "--sidebar-primary"];
const FOREGROUND_TOKENS = ["--primary-foreground", "--sidebar-primary-foreground"];
const LIGHT_TEXT = "oklch(0.985 0 0)";
const DARK_TEXT = "oklch(0.205 0 0)";
const DARK_TEXT_FROM_LIGHTNESS = 0.68;

export function applyAccentColor(hex: string | null) {
  const style = document.documentElement.style;
  withoutTransitions(() => {
    if (hex === null) {
      for (const token of [...PRIMARY_TOKENS, ...FOREGROUND_TOKENS, ...CHART_TOKENS]) style.removeProperty(token);
      return;
    }
    const accent = rgbToOklch(hexToRgb(hex));
    const foreground = accent.l > DARK_TEXT_FROM_LIGHTNESS ? DARK_TEXT : LIGHT_TEXT;
    for (const token of PRIMARY_TOKENS) style.setProperty(token, formatOklch(accent));
    for (const token of FOREGROUND_TOKENS) style.setProperty(token, foreground);
    CHART_TOKENS.forEach((token, i) =>
      style.setProperty(
        token,
        formatOklch({ l: CHART_LIGHTNESS[i], c: accent.c * CHART_CHROMA_SCALE[i], h: accent.h }),
      ),
    );
  });
}
