import { cn } from "cn";
import { Plus } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../../../shared/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { useAfterMenuClose } from "../../../shared/hooks/use-after-menu-close";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { useLayoutObserver } from "../hooks/use-layout-observer";
import {
  alignColumn,
  deleteColumn,
  deleteRow,
  HEADER_ROW,
  insertColumn,
  insertRow,
  setCell,
  type ColumnAlign,
  type MarkdownTable,
} from "../lib/markdown-table";
import {
  caretAtEdge,
  cellSelector,
  focusCell,
  type CaretPlacement,
  type CellAddress,
  type CellFocus,
} from "../lib/table-cells";

export type TableExit = "before" | "after";

export interface TableEditorProps {
  table: MarkdownTable;
  editable: boolean;
  onChange: (table: MarkdownTable, focus?: CellFocus) => void;
  onExit: (side: TableExit) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onLayout: () => void;
  focus: CellFocus | null;
  onFocused: () => void;
}

interface CellProps {
  address: CellAddress;
  text: string;
  align: ColumnAlign;
  editable: boolean;
  onText: (text: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onMenu: () => void;
}

const ALIGNMENTS: { label: string; value: ColumnAlign }[] = [
  { label: "Left", value: null },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

const EDITABLE_FRAME =
  "group/table grid w-fit max-w-full grid-cols-[minmax(0,auto)_1.25rem] grid-rows-[auto_1.25rem] gap-1 py-1";

const ADD_BUTTON =
  "flex items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity group-hover/table:opacity-100 hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100";

interface FocusRequestProps {
  grid: RefObject<HTMLTableElement | null>;
  focus: CellFocus;
  onFocused: () => void;
}

function FocusRequest({ grid, focus, onFocused }: FocusRequestProps) {
  useMountEffect(() => {
    const cell = grid.current?.querySelector<HTMLElement>(cellSelector(focus));
    if (cell) focusCell(cell, focus.placement);
    onFocused();
  });
  return null;
}

function Cell({ address, text, align, editable, onText, onKeyDown, onMenu }: CellProps) {
  const Tag = address.row === HEADER_ROW ? "th" : "td";
  const [initialText] = useState(text);

  return (
    <Tag
      onContextMenu={onMenu}
      className={cn(
        "border border-border px-2 py-1 text-left align-top font-normal has-[:focus]:bg-primary/5 has-[:focus]:outline-2 has-[:focus]:-outline-offset-1 has-[:focus]:outline-ring",
        Tag === "th" && "bg-muted/60 font-semibold",
      )}
      style={{ textAlign: align ?? "left" }}
    >
      <div
        data-row={address.row}
        data-column={address.column}
        role="textbox"
        aria-label={Tag === "th" ? "Header cell" : "Cell"}
        contentEditable={editable ? "plaintext-only" : false}
        suppressContentEditableWarning
        spellCheck={false}
        className="min-h-[1.6em] min-w-24 break-words whitespace-pre-wrap outline-none"
        onInput={(event) => onText(event.currentTarget.textContent ?? "")}
        onKeyDown={onKeyDown}
      >
        {initialText}
      </div>
    </Tag>
  );
}

export function TableEditor({
  table,
  editable,
  onChange,
  onExit,
  onDelete,
  onUndo,
  onRedo,
  onLayout,
  focus,
  onFocused,
}: TableEditorProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const layout = useLayoutObserver(onLayout);
  const [menuCell, setMenuCell] = useState<CellAddress>({ row: HEADER_ROW, column: 0 });
  const { afterClose, onOpenChangeComplete } = useAfterMenuClose();
  const width = table.header.length;
  const lastRow = table.rows.length - 1;

  const moveTo = (address: CellAddress, placement: CaretPlacement) => {
    const cell = gridRef.current?.querySelector<HTMLElement>(cellSelector(address));
    if (cell) focusCell(cell, placement);
  };

  const step = ({ row, column }: CellAddress, direction: 1 | -1, placement: CaretPlacement) => {
    const index = (row + 1) * width + column + direction;
    if (index < 0) return;
    if (index >= (lastRow + 2) * width) {
      onChange(insertRow(table, lastRow + 1), { row: lastRow + 1, column: 0, placement: "start" });
      return;
    }
    moveTo({ row: Math.floor(index / width) - 1, column: index % width }, placement);
  };

  const vertical = ({ row, column }: CellAddress, direction: 1 | -1, addAtEnd: boolean) => {
    const target = row + direction;
    if (target < HEADER_ROW) onExit("before");
    else if (target <= lastRow) moveTo({ row: target, column }, "end");
    else if (addAtEnd) onChange(insertRow(table, target), { row: target, column, placement: "start" });
    else onExit("after");
  };

  const handleKey = (address: CellAddress, event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    const mod = event.metaKey || event.ctrlKey;
    const cell = event.currentTarget;
    const take = (action: () => void) => {
      event.preventDefault();
      action();
    };
    if (mod && key === "z") take(event.shiftKey ? onRedo : onUndo);
    else if (mod && key === "y") take(onRedo);
    else if (key === "tab") take(() => step(address, event.shiftKey ? -1 : 1, "all"));
    else if (key === "enter") take(() => vertical(address, 1, true));
    else if (key === "arrowdown") take(() => vertical(address, 1, false));
    else if (key === "arrowup") take(() => vertical(address, -1, false));
    else if (key === "escape") take(() => onExit("after"));
    else if (key === "arrowleft" && caretAtEdge(cell, "start")) take(() => step(address, -1, "end"));
    else if (key === "arrowright" && caretAtEdge(cell, "end")) take(() => step(address, 1, "start"));
  };

  const cell = (address: CellAddress, text: string) => (
    <Cell
      key={address.column}
      address={address}
      text={text}
      align={table.align[address.column]}
      editable={editable}
      onText={(next) => onChange(setCell(table, address.row, address.column, next))}
      onKeyDown={(event) => handleKey(address, event)}
      onMenu={() => setMenuCell(address)}
    />
  );

  const { row, column } = menuCell;
  const isHeader = row === HEADER_ROW;
  const focusAt = (target: CellAddress): CellFocus => ({ ...target, placement: "start" });
  const grid = (
    <>
      <table ref={gridRef} className="w-max border-collapse">
        <thead>
          <tr>{table.header.map((text, index) => cell({ row: HEADER_ROW, column: index }, text))}</tr>
        </thead>
        <tbody>
          {table.rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>{cells.map((text, index) => cell({ row: rowIndex, column: index }, text))}</tr>
          ))}
        </tbody>
      </table>
      {focus && (
        <FocusRequest
          key={`${focus.row}:${focus.column}:${focus.placement}`}
          grid={gridRef}
          focus={focus}
          onFocused={onFocused}
        />
      )}
    </>
  );

  const editing = (
    <>
      <ContextMenu onOpenChangeComplete={onOpenChangeComplete}>
        <ContextMenuTrigger className="overflow-x-auto">{grid}</ContextMenuTrigger>
        <ContextMenuContent finalFocus={false}>
          <ContextMenuItem
            disabled={isHeader}
            onClick={() => afterClose(() => onChange(insertRow(table, row), focusAt({ row, column })))}
          >
            Insert row above
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => afterClose(() => onChange(insertRow(table, row + 1), focusAt({ row: row + 1, column })))}
          >
            Insert row below
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              afterClose(() => onChange(insertColumn(table, column), focusAt({ row: HEADER_ROW, column })))
            }
          >
            Insert column left
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              afterClose(() =>
                onChange(insertColumn(table, column + 1), focusAt({ row: HEADER_ROW, column: column + 1 })),
              )
            }
          >
            Insert column right
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Align column</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup value={table.align[column] ?? "left"}>
                {ALIGNMENTS.map(({ label, value }) => (
                  <ContextMenuRadioItem
                    key={label}
                    value={value ?? "left"}
                    closeOnClick
                    onClick={() => afterClose(() => onChange(alignColumn(table, column, value)))}
                  >
                    {label}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            disabled={isHeader}
            onClick={() => afterClose(() => onChange(deleteRow(table, row)))}
          >
            Delete row
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={width === 1}
            onClick={() => afterClose(() => onChange(deleteColumn(table, column)))}
          >
            Delete column
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => afterClose(onDelete)}>
            Delete table
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Add column"
              className={ADD_BUTTON}
              onClick={() => onChange(insertColumn(table, width), focusAt({ row: HEADER_ROW, column: width }))}
            />
          }
        >
          <Plus className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right">Add column</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Add row"
              className={ADD_BUTTON}
              onClick={() => onChange(insertRow(table, lastRow + 1), focusAt({ row: lastRow + 1, column: 0 }))}
            />
          }
        >
          <Plus className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Add row</TooltipContent>
      </Tooltip>
    </>
  );

  return (
    <div ref={layout} className={editable ? EDITABLE_FRAME : "overflow-x-auto py-1"}>
      {editable ? editing : grid}
    </div>
  );
}
