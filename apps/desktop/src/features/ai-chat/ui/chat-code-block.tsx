import { snapWithin } from "../../../shared/lib/pixel-snap";
import { CopyButton } from "./copy-button";

export function ChatCodeBlock({ code }: { code: string }) {
  return (
    <div className="group/code relative" onPointerEnter={(event) => snapWithin(event.currentTarget)}>
      <pre className="overflow-x-auto rounded-md bg-foreground/6 px-3 py-2 font-mono text-[12px] leading-normal select-text">
        <code>{code}</code>
      </pre>
      <CopyButton
        text={code}
        label="Copy code"
        className="absolute top-1 right-1 bg-muted/80 opacity-0 backdrop-blur-sm group-hover/code:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}
