import type { WireMessage, WireToolCall } from "../../../shared/api/ai";
import { jsonArguments } from "./partial-json";
import type {
  AssistantMessage,
  ChatAttachment,
  ConversationMessage,
  ToolImage,
  ToolPart,
  UserMessage,
} from "../model/conversation";

const CANCELLED_RESULT = "The user stopped this before it finished.";
const MAX_ATTACHMENT_CHARS = 20_000;
const MAX_SENT_IMAGES = 4;
const DROPPED_IMAGES = "(Images attached here earlier are left out of this request.)";

export const clipAttachment = (content: string) =>
  content.length > MAX_ATTACHMENT_CHARS
    ? `${content.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[Cut off here. The rest didn't fit.]`
    : content;

function attachmentBlock(attachment: ChatAttachment) {
  const { kind, name, content } = attachment;
  const idAttribute = kind === "file" ? "" : ` id="${attachment.id}"`;
  return `<${kind}${idAttribute} name="${name.replace(/"/g, "'")}">\n${content || "(empty)"}\n</${kind}>`;
}

const userWire = ({ text, attachments }: UserMessage): WireMessage => ({
  role: "user",
  content: [...attachments.map(attachmentBlock), text].join("\n\n"),
});

export function toolImages(parts: ToolPart[]): WireMessage[] {
  const seen = parts.filter((part): part is ToolPart & { image: ToolImage } => part.image !== undefined);
  if (seen.length === 0) return [];
  const calls = seen.map((part) => `${part.name} call ${part.id}`).join(", ");
  return [
    {
      role: "user",
      content: `The app attached the image returned by the ${calls}. This was not typed by the user.`,
      images: seen.map(({ image }) => ({ mimeType: image.mimeType, data: image.data })),
    },
  ];
}

export function withRecentImages(messages: WireMessage[], seesImages: boolean): WireMessage[] {
  const limit = seesImages ? MAX_SENT_IMAGES : 0;
  let kept = 0;
  const newestFirst = [...messages].reverse().map((message): WireMessage => {
    if (message.role !== "user" || !message.images?.length) return message;
    kept += message.images.length;
    return kept <= limit ? message : { role: "user", content: `${message.content}\n\n${DROPPED_IMAGES}` };
  });
  return newestFirst.reverse();
}

function assistantWire(message: AssistantMessage): WireMessage[] {
  const wire: WireMessage[] = [];
  let content = "";
  let calls: WireToolCall[] = [];
  let results: WireMessage[] = [];
  let parts: ToolPart[] = [];
  const flush = () => {
    if (!content && calls.length === 0) return;
    wire.push({ role: "assistant", content, toolCalls: calls }, ...results, ...toolImages(parts));
    content = "";
    calls = [];
    results = [];
    parts = [];
  };
  for (const part of message.parts) {
    if (part.kind === "reasoning") continue;
    if (part.kind === "text") {
      if (calls.length > 0) flush();
      content += part.text;
      continue;
    }
    calls.push({ id: part.id, name: part.name, arguments: jsonArguments(part.arguments) });
    parts.push(part);
    results.push({
      role: "tool",
      toolCallId: part.id,
      toolName: part.name,
      content: part.result ?? CANCELLED_RESULT,
    });
  }
  flush();
  return wire;
}

export function withSavedImages(messages: ConversationMessage[]): ConversationMessage[] {
  let kept = 0;
  const newestFirst = [...messages].reverse().map((message): ConversationMessage => {
    if (message.role === "user") return message;
    const parts = [...message.parts].reverse().map((part) => {
      if (part.kind !== "tool" || !part.image) return part;
      kept += 1;
      return kept <= MAX_SENT_IMAGES ? part : { ...part, image: undefined };
    });
    return { ...message, parts: parts.reverse() };
  });
  return newestFirst.reverse();
}

export const toWire = (messages: ConversationMessage[]): WireMessage[] =>
  messages.flatMap((message) => (message.role === "user" ? [userWire(message)] : assistantWire(message)));
