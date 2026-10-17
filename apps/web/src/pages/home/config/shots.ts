import type { Shot } from "@/shared/config/shot";

export const SHOTS = {
  hero: {
    src: "/shots/hero.webp",
    width: 2000,
    height: 1250,
    alt: "Compose Notes AI with a Kyoto trip note open and the AI chat making a packing list from it.",
  },
  chat: {
    src: "/shots/chat.webp",
    width: 798,
    height: 1728,
    alt: "The AI chat panel. It read the Kyoto note, created a packing list note and summarized the highlights.",
  },
  editor: {
    src: "/shots/editor.webp",
    width: 1600,
    height: 1078,
    alt: "A Kyoto trip note with headings, a task list and a table, next to folders of notes in the sidebar.",
  },
  drawing: {
    src: "/shots/drawing.webp",
    width: 1400,
    height: 1008,
    alt: "An Excalidraw day plan for Kyoto: colored boxes for each stop joined by arrows with travel times.",
  },
  storage: {
    src: "/shots/storage.webp",
    width: 1200,
    height: 493,
    alt: "The app's storage page: ten notes, 20.8 KB uncompressed, stored in 3 KB.",
  },
} satisfies Record<string, Shot>;
