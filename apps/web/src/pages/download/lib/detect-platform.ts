import type { Platform } from "../config/builds";

type NavigatorWithHints = Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };

export function detectPlatform(navigator: NavigatorWithHints): Platform | null {
  if (navigator.userAgentData?.mobile || /Android|iPhone|iPad/i.test(navigator.userAgent)) return null;
  const hint = `${navigator.userAgentData?.platform ?? ""} ${navigator.userAgent}`;
  if (/Win/i.test(hint)) return "windows";
  if (/Mac/i.test(hint)) return navigator.maxTouchPoints > 1 ? null : "macos";
  if (/Linux|X11|CrOS/i.test(hint)) return "linux";
  return null;
}
