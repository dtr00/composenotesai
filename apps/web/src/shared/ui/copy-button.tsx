import { Check, Copy } from "lucide-react";
import { useState } from "react";

const RESET_MS = 1600;

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), RESET_MS);
      },
      () => setCopied(false),
    );

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-text"
    >
      {copied ? (
        <Check className="size-[15px]" aria-hidden="true" />
      ) : (
        <Copy className="size-[15px]" aria-hidden="true" />
      )}
    </button>
  );
}
