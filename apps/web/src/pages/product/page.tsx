import { Link } from "@tanstack/react-router";
import {
  Captions,
  Box,
  Eye,
  FolderInput,
  ImageIcon,
  ImagePlus,
  Keyboard,
  Languages,
  Laptop,
  Palette,
  Sparkles,
  SunMoon,
  Table2,
} from "lucide-react";
import { voiceWave } from "@/shared/lib/waveform";
import { DitherCanvas } from "@/shared/ui/dither-canvas";
import type { Shot } from "@/shared/config/shot";
import { SHOTS } from "./config/shots";
import { ProductSection } from "./ui/product-section";

function FullShot({ shot }: { shot: Shot }) {
  return (
    <div className="frame fade-bottom">
      <img {...shot} loading="lazy" />
    </div>
  );
}

function CardShot({ shot }: { shot: Shot }) {
  return (
    <div className="card relative h-[380px] overflow-hidden sm:h-[440px]">
      <div className="grid-backdrop opacity-60" aria-hidden="true" />
      <div className="frame absolute bottom-0 left-8 w-[min(720px,125%)] translate-y-6 rounded-r-none">
        <img {...shot} loading="lazy" />
      </div>
    </div>
  );
}

function VoiceShot({ shot }: { shot: Shot }) {
  return (
    <div className="card relative h-[380px] overflow-hidden sm:h-[440px]">
      <div className="grid-backdrop opacity-60" aria-hidden="true" />
      <DitherCanvas
        shader={voiceWave}
        className="absolute inset-x-8 top-12 h-[150px] w-[calc(100%-64px)] [--ink:var(--color-text)]"
      />
      <div className="frame absolute inset-x-6 bottom-12 mx-auto max-w-[380px]">
        <img {...shot} loading="lazy" />
      </div>
    </div>
  );
}

function CustomShot({ shot, detail }: { shot: Shot; detail: Shot }) {
  return (
    <div className="relative lg:mb-16">
      <div className="frame">
        <img {...shot} loading="lazy" />
      </div>
      <div className="frame absolute right-8 -bottom-16 hidden w-[42%] max-w-[480px] lg:block">
        <img {...detail} loading="lazy" />
      </div>
    </div>
  );
}

export function ProductPage() {
  return (
    <>
      <div className="relative">
        <div className="grid-backdrop" aria-hidden="true" />
        <section aria-labelledby="product-title" className="container-page relative pt-20 sm:pt-28">
          <h1 id="product-title" className="display-1 max-w-[16ch]">
            Everything in one small app
          </h1>
          <p className="lead mt-6 max-w-[46ch]">
            Write in Markdown, sketch with Excalidraw, chat with a local AI and dictate with your voice. All on your own
            computer.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/download" className="btn-primary">
              Download
            </Link>
          </div>
        </section>
      </div>

      <ProductSection
        id="notes"
        layout="stacked"
        title="Markdown notes"
        body="A clean editor for everything from quick thoughts to long documents. Organize notes in folders and link them together."
        points={[
          { icon: Table2, label: "Tables, task lists and code" },
          { icon: ImagePlus, label: "Embed images and web links" },
        ]}
        visual={<FullShot shot={SHOTS.notes} />}
      />

      <ProductSection
        id="drawings"
        layout="split"
        title="Excalidraw drawings"
        body="Sketch diagrams and plans right next to your notes. Drawings live in the same folders."
        points={[{ icon: Eye, label: "The AI can read them" }]}
        visual={<CardShot shot={SHOTS.drawing} />}
      />

      <ProductSection
        id="chat"
        layout="stacked"
        title="Local AI chat"
        body="Ask about your notes, get summaries and drafts, and let the AI make edits you can undo."
        points={[
          { icon: Sparkles, label: "Skills for tasks you repeat" },
          { icon: Box, label: "Pick your model" },
          { icon: Laptop, label: "Runs on your own computer" },
        ]}
        visual={<FullShot shot={SHOTS.chat} />}
      />

      <ProductSection
        id="dictation"
        layout="split-reverse"
        title="Local AI dictation"
        body="Speak from any app and your words become a note."
        points={[
          { icon: Captions, label: "Live transcript" },
          { icon: Languages, label: "Detects your language" },
          { icon: FolderInput, label: "Saves to a folder you pick" },
        ]}
        visual={<VoiceShot shot={SHOTS.voice} />}
      />

      <ProductSection
        id="customize"
        layout="stacked"
        title="Fully customizable"
        body="Make the app look and work the way you like, down to how the AI answers."
        points={[
          { icon: SunMoon, label: "Light and dark themes" },
          { icon: Palette, label: "Accent and panel colors" },
          { icon: ImageIcon, label: "Background images" },
          { icon: Keyboard, label: "Shortcuts you choose" },
        ]}
        visual={<CustomShot shot={SHOTS.custom} detail={SHOTS.appearance} />}
      />

      <div className="h-32 sm:h-44" />
    </>
  );
}
