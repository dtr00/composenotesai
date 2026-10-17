import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/pages/product/page";
import { APP_NAME } from "@/shared/config/site";

export const Route = createFileRoute("/product")({
  head: () => ({ meta: [{ title: `Product - ${APP_NAME}` }] }),
  component: ProductPage,
});
