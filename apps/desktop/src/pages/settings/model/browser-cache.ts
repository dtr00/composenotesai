import { toast } from "sonner";
import { clearBrowserCache } from "../../../shared/api/browser";
import { reportSucceeded } from "../../../shared/lib/error-toast";

export const CACHE_CLEAR_CHOICES = [
  { value: 0, label: "At startup" },
  { value: 1, label: "Every hour" },
  { value: 6, label: "Every 6 hours" },
  { value: 24, label: "Every day" },
];

export async function clearBrowserCacheNow() {
  if (await reportSucceeded(clearBrowserCache())) toast.success("Browser cache cleared");
}
