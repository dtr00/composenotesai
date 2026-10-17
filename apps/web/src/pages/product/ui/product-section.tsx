import type { ReactNode } from "react";
import { IconList, type IconItem } from "@/shared/ui/icon-list";

type ProductSectionProps = {
  id: string;
  title: string;
  body: string;
  points: IconItem[];
  visual: ReactNode;
  layout: "stacked" | "split" | "split-reverse";
};

function Copy({ id, title, body, points }: Omit<ProductSectionProps, "visual" | "layout">) {
  return (
    <div>
      <h2 id={`${id}-title`} className="display-2 max-w-[16ch]">
        {title}
      </h2>
      <p className="lead mt-5 max-w-[46ch]">{body}</p>
      <IconList items={points} className="mt-8 gap-y-3" />
    </div>
  );
}

export function ProductSection({ layout, visual, ...copy }: ProductSectionProps) {
  if (layout === "stacked") {
    return (
      <section id={copy.id} aria-labelledby={`${copy.id}-title`} className="container-page mt-32 sm:mt-44">
        <Copy {...copy} />
        <div className="mt-12 sm:mt-16">{visual}</div>
      </section>
    );
  }
  return (
    <section
      id={copy.id}
      aria-labelledby={`${copy.id}-title`}
      className="container-page mt-32 grid items-center gap-12 sm:mt-44 lg:grid-cols-2 lg:gap-16"
    >
      <div className={layout === "split-reverse" ? "lg:order-2" : undefined}>
        <Copy {...copy} />
      </div>
      {visual}
    </section>
  );
}
