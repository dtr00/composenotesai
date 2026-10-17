import type { ReactNode } from "react";
import type { SystemUsage } from "../../../shared/api/system";
import { formatBytes } from "../../../shared/lib/format-bytes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import { SETTING_IDS } from "../model/settings-search";
import { HISTORY_LENGTH, monitorSystem, useSystemMonitor } from "../model/system-monitor";
import { SettingsGroup } from "./settings-group";
import { UsageMeter } from "./usage-meter";

const wholePercent = (value: number) => `${Math.round(value)}%`;

function Sparkline({ values, max, label }: { values: number[]; max: number; label: string }) {
  const offset = HISTORY_LENGTH - values.length;
  const points = values.map((value, i) => `${offset + i},${100 - (Math.min(value, max) / max) * 100}`);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${HISTORY_LENGTH - 1} 100`}
      preserveAspectRatio="none"
      className="h-10 w-full overflow-visible"
    >
      {points.length > 1 && (
        <>
          <polygon points={`${offset},100 ${points.join(" ")} ${HISTORY_LENGTH - 1},100`} className="fill-primary/10" />
          <polyline
            points={points.join(" ")}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeLinejoin="round"
            className="stroke-primary"
          />
        </>
      )}
    </svg>
  );
}

function UsageRow({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span>{label}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">{text}</span>
      </div>
      <UsageMeter label={label} value={value} max={max} valueText={text} fill="bg-primary" track="bg-primary/20" />
    </li>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span>{label}</span>
      <span className="ml-auto text-muted-foreground tabular-nums">{children}</span>
    </li>
  );
}

function MonitorSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <SettingsGroup name={id} title={title} headerRow>
      <Card id={id} size="sm">
        {children}
      </Card>
    </SettingsGroup>
  );
}

const ofTotal = (used: number, total: number) => `${formatBytes(used)} of ${formatBytes(total)}`;

export function SystemSection() {
  const { info, history } = useSystemMonitor();
  const now: SystemUsage | undefined = history[history.length - 1];

  return (
    <div ref={monitorSystem} className="flex flex-col gap-6">
      {info && now && (
        <>
          <MonitorSection id={SETTING_IDS.processor} title="Processor">
            <CardHeader>
              <CardTitle>{info.cpuName || "Unknown processor"}</CardTitle>
              <CardDescription>
                {info.cores ? `${info.cores} cores, ` : ""}
                {info.threads} threads
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Sparkline
                values={history.map((sample) => sample.cpuPercent)}
                max={100}
                label="Processor use by all apps over the last minute"
              />
              <ul className="flex flex-col gap-3">
                <UsageRow label="All apps" value={now.cpuPercent} max={100} text={wholePercent(now.cpuPercent)} />
                <UsageRow label="This app" value={now.appCpuPercent} max={100} text={wholePercent(now.appCpuPercent)} />
                <DetailRow label="Instruction sets">
                  {info.instructionSets.length > 0 ? info.instructionSets.join(", ") : "None detected"}
                </DetailRow>
              </ul>
            </CardContent>
          </MonitorSection>
          <MonitorSection id={SETTING_IDS.memory} title="Memory">
            <CardContent className="flex flex-col gap-3">
              <Sparkline
                values={history.map((sample) => sample.memoryUsed)}
                max={now.memoryTotal}
                label="Memory used by all apps over the last minute"
              />
              <ul className="flex flex-col gap-3">
                <UsageRow
                  label="All apps"
                  value={now.memoryUsed}
                  max={now.memoryTotal}
                  text={ofTotal(now.memoryUsed, now.memoryTotal)}
                />
                <UsageRow
                  label="This app"
                  value={now.appMemory}
                  max={now.memoryTotal}
                  text={formatBytes(now.appMemory)}
                />
                {now.swapTotal > 0 && (
                  <UsageRow
                    label="Swap"
                    value={now.swapUsed}
                    max={now.swapTotal}
                    text={ofTotal(now.swapUsed, now.swapTotal)}
                  />
                )}
                <DetailRow label="Free">{formatBytes(now.memoryAvailable)}</DetailRow>
              </ul>
            </CardContent>
          </MonitorSection>
          <MonitorSection id={SETTING_IDS.disk} title="Disk">
            <CardContent>
              <ul className="flex flex-col gap-3">
                <UsageRow
                  label="Drive with app data"
                  value={now.diskTotal - now.diskAvailable}
                  max={now.diskTotal}
                  text={ofTotal(now.diskTotal - now.diskAvailable, now.diskTotal)}
                />
                <DetailRow label="Free">{formatBytes(now.diskAvailable)}</DetailRow>
              </ul>
            </CardContent>
          </MonitorSection>
          <MonitorSection id={SETTING_IDS.operatingSystem} title="Operating system">
            <CardHeader>
              <CardTitle>{info.os ?? "Unknown"}</CardTitle>
              <CardDescription>{info.arch}</CardDescription>
            </CardHeader>
          </MonitorSection>
        </>
      )}
    </div>
  );
}
