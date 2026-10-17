import type { PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { trackEntryDrop } from "../../../shared/lib/entry-drop";
import { trackPointerDrag } from "../../../shared/lib/pointer-drag";
import { dropTabOnItem, moveGroupToSlot, moveTabToSlot, selectTab, tabEntry } from "../model/tabs-store";

const MERGE_EDGE = 0.25;
const LEAVE_BAR_PX = 32;
const DROP_TARGET = "data-drop-target";
const DRAGGING = "data-dragging";
const ITEMS = "[data-tab-id]:not([inert]), [data-group-chip]:not([inert])";

interface Span {
  left: number;
  right: number;
}

const spanOf = (element: HTMLElement): Span => element.getBoundingClientRect();

const middle = ({ left, right }: Span) => (left + right) / 2;

const barElements = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(ITEMS)];

function overMiddle(element: HTMLElement, x: number) {
  const { left, right } = spanOf(element);
  const fraction = (x - left) / (right - left);
  return fraction > MERGE_EDGE && fraction < 1 - MERGE_EDGE;
}

function followPointer(event: ReactPointerEvent<HTMLElement>, list: HTMLElement, moving: () => HTMLElement[]) {
  const grab = event.clientX - moving()[0].getBoundingClientRect().left;
  let shift = 0;
  return (x: number) => {
    const elements = moving();
    const left = elements[0].getBoundingClientRect().left - shift;
    const right = elements[elements.length - 1].getBoundingClientRect().right - shift;
    const bounds = list.getBoundingClientRect();
    const [min, max] = [bounds.left - left, bounds.right - right].sort((a, b) => a - b);
    shift = Math.min(Math.max(x - grab - left, min), max);
    for (const element of elements) element.style.translate = `${shift}px 0`;
    return shift;
  };
}

function lift(elements: HTMLElement[], lifted: boolean) {
  for (const element of elements) {
    element.toggleAttribute(DRAGGING, lifted);
    if (!lifted) element.style.translate = "";
  }
}

export function startTabDrag(event: ReactPointerEvent<HTMLElement>, id: number) {
  const tab = event.currentTarget.closest<HTMLElement>("[data-tab-id]");
  const list = tab?.parentElement;
  if (!list || !tab) return;
  const follow = followPointer(event, list, () => [tab]);
  let target: HTMLElement | undefined;
  let targetIndex = -1;
  const entry = tabEntry(id);
  const elsewhere = trackEntryDrop(entry ? [entry] : []);

  const highlight = (others: HTMLElement[], index: number) => {
    target?.removeAttribute(DROP_TARGET);
    target = others[index];
    target?.setAttribute(DROP_TARGET, "");
    targetIndex = index;
  };

  trackPointerDrag(event, {
    onStart: () => {
      lift([tab], true);
      selectTab(id);
    },
    onMove: ({ clientX, clientY }) => {
      const awayFromBar = clientY > list.getBoundingClientRect().bottom + LEAVE_BAR_PX;
      if (elsewhere.hoverZoneAt(clientX, clientY) || awayFromBar) {
        highlight([], -1);
        return;
      }
      follow(clientX);
      const others = barElements(list).filter((element) => element !== tab);
      highlight(
        others,
        others.findIndex((element) => overMiddle(element, clientX)),
      );
      if (targetIndex >= 0) return;
      const slot = others.filter((element) => middle(spanOf(element)) < clientX).length;
      flushSync(() => moveTabToSlot(id, slot));
      follow(clientX);
    },
    onEnd: (dropped) => {
      lift([tab], false);
      const onto = targetIndex;
      highlight([], -1);
      if (elsewhere.dropIntoZone(dropped)) return;
      if (dropped && onto >= 0) dropTabOnItem(id, onto);
    },
  });
}

function unitSpans(elements: HTMLElement[]): Span[] {
  const spans: Span[] = [];
  let chipGroup: string | undefined;
  for (const element of elements) {
    const span = spanOf(element);
    const last = spans[spans.length - 1];
    if (element.dataset.tabGroup !== undefined && element.dataset.tabGroup === chipGroup) {
      spans[spans.length - 1] = { left: last.left, right: span.right };
    } else {
      chipGroup = element.dataset.groupChip;
      spans.push(span);
    }
  }
  return spans;
}

function isBeforeBlock(unit: Span, block: Span, shift: number) {
  const startsLeftOfBlock = middle(unit) < block.left - shift;
  return middle(unit) < (startsLeftOfBlock ? block.left : block.right);
}

export function startGroupDrag(event: ReactPointerEvent<HTMLElement>, groupId: number) {
  const chip = event.currentTarget.closest<HTMLElement>("[data-group-chip]");
  const list = chip?.parentElement;
  if (!list || !chip) return;
  const isMember = (element: HTMLElement) =>
    element.dataset.groupChip === String(groupId) || element.dataset.tabGroup === String(groupId);
  const members = () => barElements(list).filter(isMember);
  const follow = followPointer(event, list, members);

  trackPointerDrag(event, {
    onStart: () => lift(members(), true),
    onMove: ({ clientX }) => {
      const shift = follow(clientX);
      const moving = members().map(spanOf);
      const block = { left: moving[0].left, right: moving[moving.length - 1].right };
      const units = unitSpans(barElements(list).filter((element) => !isMember(element)));
      const slot = units.filter((unit) => isBeforeBlock(unit, block, shift)).length;
      flushSync(() => moveGroupToSlot(groupId, slot));
      follow(clientX);
    },
    onEnd: () => lift(members(), false),
  });
}
