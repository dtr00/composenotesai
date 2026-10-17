import { DOWNLOAD_URL } from "@/shared/config/site";

export type Platform = "linux" | "windows" | "macos";

export type Build = {
  label: string;
  href: string;
};

const asset = (name: string) => `${DOWNLOAD_URL}/compose-notes-ai-${name}`;

export type PlatformBuilds = {
  platform: Platform;
  name: string;
  summary: string;
  builds: Build[];
};

export const PLATFORMS: PlatformBuilds[] = [
  {
    platform: "macos",
    name: "macOS",
    summary:
      "Drag the app to Applications. The first time you open it, choose Open Anyway in System Settings, Privacy & Security.",
    builds: [{ label: "Disk image (.dmg)", href: asset("macos-universal.dmg") }],
  },
  {
    platform: "windows",
    name: "Windows",
    summary: "For Windows 10 and 11. If SmartScreen stops the installer, choose More info, then Run anyway.",
    builds: [
      { label: "Installer (.exe)", href: asset("windows-x64-setup.exe") },
      { label: "MSI package", href: asset("windows-x64.msi") },
    ],
  },
  {
    platform: "linux",
    name: "Linux",
    summary: "A Debian package for Ubuntu and Debian, or an AppImage for anything else.",
    builds: [
      { label: "Debian (.deb)", href: asset("linux-x64.deb") },
      { label: "AppImage", href: asset("linux-x64.AppImage") },
    ],
  },
];
