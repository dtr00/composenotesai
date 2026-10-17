import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { UNFOCUSABLE } from "../lib/unfocusable";
import { buttonVariants } from "./button";

type TitleBarButtonProps = ButtonPrimitive.Props & Pick<VariantProps<typeof buttonVariants>, "size">;

export function TitleBarButton({ className, size = "icon", ...props }: TitleBarButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant: "ghost", size }), "text-muted-foreground transition-none", className)}
      {...props}
      {...UNFOCUSABLE}
    />
  );
}
