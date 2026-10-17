import { cp, rm } from "node:fs/promises";

const fonts = new URL("../node_modules/@excalidraw/excalidraw/dist/prod/fonts/", import.meta.url);
const destination = new URL("../public/excalidraw/fonts/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await cp(fonts, destination, { recursive: true });
