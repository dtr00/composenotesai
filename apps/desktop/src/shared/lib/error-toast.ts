import { toast } from "sonner";

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function showError(error: unknown, id?: string) {
  toast.error(errorMessage(error), id === undefined ? undefined : { id });
}

export const showLastingWarning = (message: string, id: string) => toast.warning(message, { id, duration: Infinity });

export const dismissToast = (id: string) => toast.dismiss(id);

export async function reportAction<T>(work: Promise<T>, revert?: () => void): Promise<T | undefined> {
  try {
    return await work;
  } catch (e) {
    revert?.();
    showError(e);
    return undefined;
  }
}

export const reportSucceeded = async (work: Promise<unknown>): Promise<boolean> =>
  (await reportAction(work.then(() => true))) ?? false;
