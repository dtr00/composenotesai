import { getName, getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

export interface SystemInfo {
  cpuName: string;
  cores: number | null;
  threads: number;
  arch: string;
  os: string | null;
  instructionSets: string[];
}

export interface SystemUsage {
  cpuPercent: number;
  appCpuPercent: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryAvailable: number;
  appMemory: number;
  swapTotal: number;
  swapUsed: number;
  diskTotal: number;
  diskAvailable: number;
}

export const loadSystemInfo = () => invoke<SystemInfo>("system_info");
export const loadSystemUsage = () => invoke<SystemUsage>("system_usage");

export const loadAppInfo = () => Promise.all([getName(), getVersion()]).then(([name, version]) => ({ name, version }));
