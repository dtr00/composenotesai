import { redo, undo } from "@codemirror/commands";
import { Prec, StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, type DecorationSet } from "@codemirror/view";
import { createElement } from "react";
import { TableEditor, type TableExit } from "../ui/table-editor";
import { nodeAt, outermostNodes } from "./markdown-syntax";
import { HEADER_ROW, parseTable, serializeTable, storedCellText, type MarkdownTable } from "./markdown-table";
import { focusCell, type CaretPlacement, type CellAddress, type CellFocus } from "./table-cells";
import { decorationField, isEditable, ReactWidget } from "./widget-roots";

interface TableRange {
  from: number;
  to: number;
}

type CellPick = (rows: number, columns: number) => CellAddress;

const TABLE_CLASS = "cm-md-table-block";

const tableRange = (state: EditorState, node: { from: number; to: number }): TableRange => ({
  from: state.doc.lineAt(node.from).from,
  to: state.doc.lineAt(node.to).to,
});

const tablesIn = (state: EditorState): TableRange[] =>
  outermostNodes(state, (name) => name === "Table")
    .filter((node) => node.parent?.name === "Document")
    .map((node) => tableRange(state, node));

function tableAt(state: EditorState, pos: number) {
  const node = nodeAt(state, pos, "Table");
  return node?.parent?.name === "Document" ? tableRange(state, node) : null;
}

const tableOf = (view: EditorView, dom: HTMLElement) => tableAt(view.state, view.posAtDOM(dom));

function replaceTable(view: EditorView, dom: HTMLElement, insert: string, focus?: CellFocus) {
  const table = tableOf(view, dom);
  if (!table) return;
  view.dispatch({
    changes: { from: table.from, to: table.to, insert },
    effects: focus ? requestTableFocus.of({ pos: table.from, pick: () => focus, placement: focus.placement }) : [],
    userEvent: "input",
  });
}

function exitTable(view: EditorView, dom: HTMLElement, side: TableExit) {
  const table = tableOf(view, dom);
  if (!table) return;
  const { doc } = view.state;
  if (side === "before") {
    if (table.from === 0) view.dispatch({ changes: { from: 0, insert: "\n" }, selection: { anchor: 0 } });
    else view.dispatch({ selection: { anchor: table.from - 1 } });
  } else if (table.to === doc.length) {
    view.dispatch({ changes: { from: table.to, insert: "\n" }, selection: { anchor: table.to + 1 } });
  } else {
    view.dispatch({ selection: { anchor: table.to + 1 } });
  }
  view.focus();
}

function deleteTable(view: EditorView, dom: HTMLElement) {
  const table = tableOf(view, dom);
  if (!table) return;
  const to = Math.min(view.state.doc.length, table.to + 1);
  view.dispatch({ changes: { from: table.from, to }, selection: { anchor: table.from }, userEvent: "delete" });
  view.focus();
}

interface FocusRequest {
  pos: number;
  pick: CellPick;
  placement: CaretPlacement;
}

const requestTableFocus = StateEffect.define<FocusRequest | null>();

const pendingFocus = StateField.define<FocusRequest | null>({
  create: () => null,
  update(request, tr) {
    for (const effect of tr.effects) if (effect.is(requestTableFocus)) return effect.value;
    return request && tr.docChanged ? { ...request, pos: tr.changes.mapPos(request.pos) } : request;
  },
});

export function focusTable(view: EditorView, pos: number, pick: CellPick, placement: CaretPlacement) {
  view.dispatch({ effects: requestTableFocus.of({ pos, pick, placement }) });
}

export const firstCell: CellPick = () => ({ row: HEADER_ROW, column: 0 });

const lastRowCell: CellPick = (rows, columns) => ({ row: rows - 1, column: columns - 1 });

function syncCellTexts(dom: HTMLElement, { header, rows }: MarkdownTable) {
  for (const cell of dom.querySelectorAll<HTMLElement>("[data-row][data-column]")) {
    const row = Number(cell.dataset.row);
    const text = (row === HEADER_ROW ? header : rows[row])?.[Number(cell.dataset.column)];
    if (text === undefined || storedCellText(cell.textContent ?? "") === text) continue;
    const focused = document.activeElement === cell;
    cell.textContent = text;
    if (focused) focusCell(cell, "end");
  }
}

class TableWidget extends ReactWidget {
  protected readonly tag = "div";
  protected readonly className = TABLE_CLASS;

  constructor(
    readonly source: string,
    readonly editable: boolean,
    readonly focus: CellFocus | null,
  ) {
    super();
  }

  eq(other: TableWidget) {
    return (
      other.source === this.source &&
      other.editable === this.editable &&
      other.focus?.row === this.focus?.row &&
      other.focus?.column === this.focus?.column &&
      other.focus?.placement === this.focus?.placement
    );
  }

  ignoreEvent() {
    return true;
  }

  updateDOM(dom: HTMLElement, view: EditorView) {
    if (!super.updateDOM(dom, view)) return false;
    syncCellTexts(dom, parseTable(this.source));
    return true;
  }

  protected element(view: EditorView, dom: HTMLElement) {
    return createElement(TableEditor, {
      table: parseTable(this.source),
      editable: this.editable,
      onChange: (table, focus) => replaceTable(view, dom, serializeTable(table), focus),
      onExit: (side) => exitTable(view, dom, side),
      onDelete: () => deleteTable(view, dom),
      onUndo: () => undo(view),
      onRedo: () => redo(view),
      onLayout: () => view.requestMeasure(),
      focus: this.focus,
      onFocused: () => view.dispatch({ effects: requestTableFocus.of(null) }),
    });
  }
}

function focusFor(request: FocusRequest | null, { from, to }: TableRange, source: string): CellFocus | null {
  if (!request || request.pos < from || request.pos > to) return null;
  const { header, rows } = parseTable(source);
  return { ...request.pick(rows.length, header.length), placement: request.placement };
}

function tableWidgets(state: EditorState): DecorationSet {
  const editable = isEditable(state);
  const request = state.field(pendingFocus);
  const decorations: Range<Decoration>[] = tablesIn(state).map((table) => {
    const source = state.sliceDoc(table.from, table.to);
    const widget = new TableWidget(source, editable, focusFor(request, table, source));
    return Decoration.replace({ widget, block: true }).range(table.from, table.to);
  });
  return Decoration.set(decorations);
}

const tableField = decorationField(tableWidgets, {
  rebuildWhen: (tr) => tr.startState.field(pendingFocus) !== tr.state.field(pendingFocus),
});

function enterVertically(view: EditorView, forward: boolean) {
  const range = view.state.selection.main;
  if (!range.empty) return false;
  const line = view.state.doc.lineAt(range.head);
  if (view.state.doc.lineAt(view.moveVertically(range, forward).head).number === line.number) return false;
  const neighbor = forward ? line.to + 1 : line.from - 1;
  if (neighbor < 0 || neighbor > view.state.doc.length) return false;
  const table = tableAt(view.state, neighbor);
  if (!table) return false;
  focusTable(view, neighbor, forward ? firstCell : lastRowCell, "end");
  return true;
}

function enterFromBelow(view: EditorView) {
  const range = view.state.selection.main;
  const line = view.state.doc.lineAt(range.head);
  if (!range.empty || range.head !== line.from || line.from === 0) return false;
  const table = tableAt(view.state, line.from - 1);
  if (!table) return false;
  if (line.text === "") view.dispatch({ changes: { from: line.from - 1, to: line.to }, userEvent: "delete" });
  focusTable(view, table.from, lastRowCell, "end");
  return true;
}

function separateFromTable(view: EditorView, from: number, to: number, text: string) {
  const line = view.state.doc.lineAt(from);
  if (line.text.trim() !== "" || from !== to) return false;
  const above = line.from > 0 && tableAt(view.state, line.from - 1)?.to === line.from - 1;
  const below = line.to < view.state.doc.length && tableAt(view.state, line.to + 1)?.from === line.to + 1;
  if (!above && !below) return false;
  const insert = `${above ? "\n" : ""}${text}${below ? "\n" : ""}`;
  view.dispatch({
    changes: { from, insert },
    selection: { anchor: from + (above ? 1 : 0) + text.length },
    userEvent: "input.type",
  });
  return true;
}

const tableKeymap = Prec.high(
  keymap.of([
    { key: "ArrowDown", run: (view) => enterVertically(view, true) },
    { key: "ArrowUp", run: (view) => enterVertically(view, false) },
    { key: "Backspace", run: enterFromBelow },
  ]),
);

const tableTheme = EditorView.theme({
  [`.${TABLE_CLASS}`]: { fontSize: "0.9375em", lineHeight: "1.5" },
});

export const tableEditing = [
  pendingFocus,
  tableField,
  tableKeymap,
  EditorView.inputHandler.of(separateFromTable),
  tableTheme,
];
