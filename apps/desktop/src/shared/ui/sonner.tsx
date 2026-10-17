import { CircleCheckIcon, CircleXIcon, InfoIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const ICONS: ToasterProps["icons"] = {
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <CircleXIcon className="size-4" />,
  loading: <Loader2Icon className="size-4 animate-spin" />,
};

const TOAST_CLASSES: NonNullable<ToasterProps["toastOptions"]>["classNames"] = {
  toast:
    "items-start! has-[[data-button]]:items-center! gap-1.5! p-3! pl-3.5! data-[styled=false]:p-0! font-sans! text-xs/relaxed! [--toast-icon-margin-end:0px] [--toast-icon-margin-start:0px] [--normal-bg:var(--card)] [--normal-border:color-mix(in_oklab,var(--foreground)_10%,transparent)] [--normal-text:var(--card-foreground)]",
  icon: "mt-px",
  description: "text-muted-foreground!",
  error: "[&_[data-icon]]:text-destructive",
  warning: "[&_[data-icon]]:text-warning",
  success: "[&_[data-icon]]:text-primary",
  info: "[&_[data-icon]]:text-muted-foreground",
};

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group [--border-radius:var(--radius-lg)]"
      icons={ICONS}
      toastOptions={{ classNames: TOAST_CLASSES }}
      {...props}
    />
  );
}

export { Toaster };
