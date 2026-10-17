export type ColumnAlign = "left" | "center" | "right" | null;

export interface MarkdownTable {
  header: string[];
  align: ColumnAlign[];
  rows: string[][];
}

export const HEADER_ROW = -1;

const DELIMITER_CELL = /^:?-+:?$/;

function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && text[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (text[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += text[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseAlign(cell: string): ColumnAlign {
  if (!DELIMITER_CELL.test(cell)) return null;
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return left ? "left" : null;
}

const fitRow = (cells: string[], width: number) => Array.from({ length: width }, (_, column) => cells[column] ?? "");

export function parseTable(source: string): MarkdownTable {
  const [headerLine = "", delimiterLine = "", ...rowLines] = source.split("\n");
  const header = splitRow(headerLine);
  const align = fitRow(splitRow(delimiterLine), header.length).map(parseAlign);
  return { header, align, rows: rowLines.map((line) => fitRow(splitRow(line), header.length)) };
}

const DELIMITERS: Record<string, string> = { left: ":---", center: ":---:", right: "---:", none: "---" };

const flattenCell = (text: string) => text.replace(/\s*\n\s*/g, " ");

export const storedCellText = (text: string) => flattenCell(text).trim();

const escapeCell = (text: string) => flattenCell(text).replace(/\|/g, "\\|");

const formatRow = (cells: string[]) => `| ${cells.map(escapeCell).join(" | ")} |`;

export function serializeTable({ header, align, rows }: MarkdownTable): string {
  const delimiter = `| ${align.map((value) => DELIMITERS[value ?? "none"]).join(" | ")} |`;
  return [formatRow(header), delimiter, ...rows.map(formatRow)].join("\n");
}

export function setCell(table: MarkdownTable, row: number, column: number, text: string): MarkdownTable {
  const replace = (cells: string[]) => cells.map((cell, index) => (index === column ? text : cell));
  if (row === HEADER_ROW) return { ...table, header: replace(table.header) };
  return { ...table, rows: table.rows.map((cells, index) => (index === row ? replace(cells) : cells)) };
}

export function insertRow(table: MarkdownTable, at: number): MarkdownTable {
  const rows = [...table.rows];
  rows.splice(
    at,
    0,
    table.header.map(() => ""),
  );
  return { ...table, rows };
}

export const deleteRow = (table: MarkdownTable, row: number): MarkdownTable => ({
  ...table,
  rows: table.rows.filter((_, index) => index !== row),
});

const spliceColumn = <T>(cells: T[], at: number, insert: T[]) => {
  const next = [...cells];
  next.splice(at, insert.length === 0 ? 1 : 0, ...insert);
  return next;
};

export const insertColumn = (table: MarkdownTable, at: number): MarkdownTable => ({
  header: spliceColumn(table.header, at, [""]),
  align: spliceColumn(table.align, at, [null]),
  rows: table.rows.map((cells) => spliceColumn(cells, at, [""])),
});

export const deleteColumn = (table: MarkdownTable, column: number): MarkdownTable => ({
  header: spliceColumn(table.header, column, []),
  align: spliceColumn(table.align, column, []),
  rows: table.rows.map((cells) => spliceColumn(cells, column, [])),
});

export const alignColumn = (table: MarkdownTable, column: number, align: ColumnAlign): MarkdownTable => ({
  ...table,
  align: table.align.map((value, index) => (index === column ? align : value)),
});
