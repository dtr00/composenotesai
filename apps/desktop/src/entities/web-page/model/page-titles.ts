import { createStore, useSelector } from "../../../shared/lib/store";
import { hostName } from "../../../shared/lib/web-url";

const store = createStore<ReadonlyMap<number, string>>(new Map());

export function setPageTitle(tab: number, title: string) {
  if (store.get().get(tab) !== title) store.set(new Map(store.get()).set(tab, title));
}

export function forgetPageTitle(tab: number) {
  if (!store.get().has(tab)) return;
  const titles = new Map(store.get());
  titles.delete(tab);
  store.set(titles);
}

export const usePageLabel = (tab: number, url: string): string =>
  useSelector(store, (titles) => titles.get(tab) || hostName(url));
