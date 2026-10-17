import { createFileRoute } from "@tanstack/react-router";
import { DownloadPage } from "@/pages/download/page";
import { APP_NAME } from "@/shared/config/site";

export const Route = createFileRoute("/download")({
  head: () => ({ meta: [{ title: `Download ${APP_NAME}` }] }),
  component: DownloadPage,
});
