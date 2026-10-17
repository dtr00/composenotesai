import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { reportSucceeded } from "../../../shared/lib/error-toast";
import { PixelSnappedActionButton } from "./pixel-snapped-action-button";

const COPIED_MS = 1500;

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  const copy = async () => {
    if (!(await reportSucceeded(navigator.clipboard.writeText(text)))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <PixelSnappedActionButton
      icon={copied ? Check : Copy}
      label={copied ? "Copied" : label}
      hint={copied ? "Copied" : label}
      className={className}
      onClick={() => void copy()}
    />
  );
}
