import { createPortal } from "react-dom";
import { useSettings } from "../../entities/settings/model/settings-store";
import { Toaster } from "../../shared/ui/sonner";

export function AppToaster() {
  return createPortal(<Toaster theme={useSettings().theme} />, document.body);
}
