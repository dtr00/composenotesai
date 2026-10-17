import { cn } from "cn";
import { Fragment } from "react";
import { HistoryButtons } from "../../../features/tabs/ui/history-buttons";
import { navigate } from "../../../shared/lib/hash-router";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "../../../shared/ui/breadcrumb";
import type { SettingsPageInfo } from "../model/settings-sections";

const CRUMB = "flex h-[25px] items-center rounded-md px-1.5 text-xs text-muted-foreground";

export function SettingsToolbar({ trail }: { trail: SettingsPageInfo[] }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 px-2 py-1.5 select-none">
      <HistoryButtons />
      <Breadcrumb className="ml-1 min-w-0">
        <BreadcrumbList className="flex-nowrap gap-0.5">
          {trail.map((crumb, i) => (
            <Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator className="text-muted-foreground/60">/</BreadcrumbSeparator>}
              {i === trail.length - 1 ? (
                <BreadcrumbItem aria-current="page">
                  <span className={CRUMB}>{crumb.label}</span>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem>
                  <button
                    type="button"
                    className={cn(CRUMB, "hover:bg-foreground/10 hover:text-foreground")}
                    onClick={() => navigate(crumb.path)}
                  >
                    {crumb.label}
                  </button>
                </BreadcrumbItem>
              )}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
