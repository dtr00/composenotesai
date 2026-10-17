import type { ComponentProps, MouseEvent } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { navigate } from "../lib/hash-router";
import { buttonVariants } from "./button";

type LinkProps = ComponentProps<"a"> & VariantProps<typeof buttonVariants>;

function followHashLink(event: MouseEvent<HTMLAnchorElement>) {
  const href = event.currentTarget.getAttribute("href");
  if (!href?.startsWith("#")) return;
  event.preventDefault();
  navigate(href.slice(1));
}

export function Link({ className, variant = "link", size, onClick, ...props }: LinkProps) {
  return (
    <a
      className={cn(buttonVariants({ variant, size }), "transition-none", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) followHashLink(event);
      }}
      {...props}
    />
  );
}
