import { m, type Transition } from "motion/react";
import { useReducedTransition } from "../../../shared/hooks/use-reduced-transition";
import { PanelResizeHandle } from "../../../shared/ui/panel-resize-handle";
import { chatWidth, useChatOpen } from "../model/chat-panel";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { ChatThread } from "./chat-thread";

const SLIDE: Transition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

export function ChatPanel() {
  const open = useChatOpen();
  const width = chatWidth.useWidth();
  const resizing = chatWidth.useResizing();
  const transition = useReducedTransition(SLIDE);

  return (
    <m.aside
      aria-label="AI chat"
      className="relative flex shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground sidebar-surface"
      style={{ width }}
      initial={false}
      animate={{ marginRight: open ? 0 : -width }}
      transition={resizing ? { duration: 0 } : transition}
      inert={!open}
    >
      {open && <PanelResizeHandle label="Resize AI chat" edge="left" width={width} control={chatWidth} />}
      <ChatHeader />
      <ChatThread />
      <ChatComposer />
    </m.aside>
  );
}
