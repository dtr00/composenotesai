import type { Shot } from "@/shared/config/shot";

export const SHOTS = {
  notes: {
    src: "/shots/product-notes.webp",
    width: 2000,
    height: 1250,
    alt: "An offline sync design note with a quote, a formula, a TypeScript code block and links to other notes.",
  },
  drawing: {
    src: "/shots/product-drawing.webp",
    width: 1400,
    height: 744,
    alt: "An Excalidraw diagram of a laptop and a phone syncing notes through an encrypted relay.",
  },
  chat: {
    src: "/shots/product-chat.webp",
    width: 2000,
    height: 1250,
    alt: "The AI chat beside a research note, summarizing three notes into takeaways and adding them to a design doc.",
  },
  voice: {
    src: "/shots/product-voice.webp",
    width: 760,
    height: 256,
    alt: "The recording card with a timer, a level meter and the live transcript.",
  },
  custom: {
    src: "/shots/product-custom.webp",
    width: 2000,
    height: 1250,
    alt: "The app with a sky blue accent and a dithered picture of birds behind the note.",
  },
  appearance: {
    src: "/shots/product-appearance.webp",
    width: 1000,
    height: 652,
    alt: "Appearance settings: a background image in the Dither style with blur and opacity, and accent, sidebar and panel colors.",
  },
} satisfies Record<string, Shot>;
