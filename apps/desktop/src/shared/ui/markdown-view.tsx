import type { SyntaxNode, Tree } from "@lezer/common";
import { cn } from "cn";
import { createElement, Fragment, type ComponentType, type ReactNode } from "react";
import { UNDERLINE_CLOSE, UNDERLINE_OPEN } from "../lib/markdown-extensions";
import { mathSource } from "../lib/math-syntax";
import { MathView } from "./math-view";

const HIDDEN = new Set([
  "HeaderMark",
  "QuoteMark",
  "ListMark",
  "LinkMark",
  "EmphasisMark",
  "CodeMark",
  "CodeInfo",
  "StrikethroughMark",
  "TableDelimiter",
  "TaskMarker",
  "LinkTitle",
  "LinkLabel",
  "LinkReference",
  "Comment",
  "ProcessingInstruction",
  "WikiLinkMark",
]);

const HEADING = /^(?:ATX|Setext)Heading(\d)$/;

type TextSlice = (from: number, to: number) => string;

export interface MarkdownRender {
  text: string;
  slice: TextSlice;
  inline: (node: SyntaxNode, from?: number, to?: number) => ReactNode[];
  blocks: (node: SyntaxNode) => ReactNode[];
}

export type NodeRender = (node: SyntaxNode, markdown: MarkdownRender) => ReactNode;

export interface MarkdownTableStyle {
  wrapper?: string;
  table: string;
  headerRow?: string;
  row?: string;
  headerCell: string;
  cell: string;
  column?: (source: string) => (column: number) => string;
}

export interface MarkdownStyle {
  strong?: string;
  inlineCode: string;
  headingLevelOffset: number;
  headings: string[];
  blockquote: string;
  bulletList: (list: SyntaxNode) => string;
  orderedList: string;
  listItem?: string;
  taskItem: string;
  checkedTask?: string;
  rule: string;
  table: MarkdownTableStyle;
}

export interface MarkdownOverrides {
  link: NodeRender;
  image: NodeRender;
  wikiLink: NodeRender;
  inlineCode?: (code: string) => ReactNode;
  code: NodeRender;
  paragraph: NodeRender;
  taskBox: ComponentType<{ checked: boolean }>;
  asParagraph?: (node: SyntaxNode, slice: TextSlice) => boolean;
}

function children(node: SyntaxNode): SyntaxNode[] {
  const list: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) list.push(child);
  return list;
}

export const keyed = (nodes: ReactNode[]) => nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);

function markdownRender(text: string, style: MarkdownStyle, overrides: MarkdownOverrides): MarkdownRender {
  const slice: TextSlice = (from, to) => text.slice(from, to);

  function inlineNode(node: SyntaxNode): ReactNode {
    switch (node.name) {
      case "Emphasis":
        return <em>{inline(node)}</em>;
      case "StrongEmphasis":
        return <strong className={style.strong}>{inline(node)}</strong>;
      case "Strikethrough":
        return <del>{inline(node)}</del>;
      case "InlineCode": {
        const [open, close] = node.getChildren("CodeMark");
        const code = slice(open?.to ?? node.from, close?.from ?? node.to);
        return overrides.inlineCode?.(code) ?? <code className={style.inlineCode}>{code}</code>;
      }
      case "HardBreak":
        return <br />;
      case "Escape":
        return slice(node.from + 1, node.to);
      case "InlineMath":
      case "DisplayMath":
        return <MathView tex={mathSource(text, node.name, node.from, node.to)} display={node.name === "DisplayMath"} />;
      case "Link":
      case "URL":
      case "Autolink":
        return overrides.link(node, render);
      case "Image":
        return overrides.image(node, render);
      case "WikiLink":
        return overrides.wikiLink(node, render);
      default:
        return HIDDEN.has(node.name) ? null : inline(node);
    }
  }

  function inline(node: SyntaxNode, from = node.from, to = node.to): ReactNode[] {
    const stack: ReactNode[][] = [[]];
    const push = (item: ReactNode) => stack[stack.length - 1].push(item);
    const closeUnderline = () => {
      const underlined = stack.pop() ?? [];
      push(<u>{keyed(underlined)}</u>);
    };
    let at = from;
    for (const child of children(node)) {
      if (child.to <= from || child.from >= to) continue;
      if (child.from > at) push(slice(at, child.from));
      at = child.to;
      const tag = child.name === "HTMLTag" ? slice(child.from, child.to).toLowerCase() : null;
      if (tag === UNDERLINE_OPEN) stack.push([]);
      else if (tag === UNDERLINE_CLOSE) {
        if (stack.length > 1) closeUnderline();
      } else push(inlineNode(child));
    }
    if (at < to) push(slice(at, to));
    while (stack.length > 1) closeUnderline();
    return keyed(stack[0]);
  }

  function listItem(node: SyntaxNode): ReactNode {
    const task = node.getChild("Task");
    if (!task) return <li className={style.listItem}>{blocks(node)}</li>;
    const marker = task.getChild("TaskMarker");
    const checked = marker !== null && /x/i.test(slice(marker.from, marker.to));
    const TaskBox = overrides.taskBox;
    return (
      <li className={style.taskItem}>
        <TaskBox checked={checked} />
        <span className={checked ? style.checkedTask : undefined}>
          {inline(task, marker?.to ?? task.from)}
          {blocks(node)}
        </span>
      </li>
    );
  }

  function table(node: SyntaxNode): ReactNode {
    const { wrapper, table, headerRow, row, headerCell, cell, column } = style.table;
    const columnClass = column?.(slice(node.from, node.to));
    const rows = children(node).filter((child) => child.name === "TableHeader" || child.name === "TableRow");
    const element = (
      <table className={table}>
        <tbody>
          {rows.map((tableRow, rowIndex) => {
            const header = tableRow.name === "TableHeader";
            return (
              <tr key={rowIndex} className={header ? headerRow : row}>
                {tableRow
                  .getChildren("TableCell")
                  .map((tableCell, columnIndex) =>
                    createElement(
                      header ? "th" : "td",
                      { key: columnIndex, className: cn(header ? headerCell : cell, columnClass?.(columnIndex)) },
                      inline(tableCell),
                    ),
                  )}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
    return wrapper ? <div className={wrapper}>{element}</div> : element;
  }

  function block(node: SyntaxNode): ReactNode {
    if (overrides.asParagraph?.(node, slice)) return overrides.paragraph(node, render);
    const heading = HEADING.exec(node.name);
    if (heading) {
      const level = Number(heading[1]);
      return createElement(
        `h${Math.min(level + style.headingLevelOffset, 6)}`,
        { className: style.headings[Math.min(level, style.headings.length) - 1] },
        inline(node),
      );
    }
    switch (node.name) {
      case "Paragraph":
        return overrides.paragraph(node, render);
      case "Blockquote":
        return <blockquote className={style.blockquote}>{blocks(node)}</blockquote>;
      case "BulletList":
        return <ul className={style.bulletList(node)}>{blocks(node)}</ul>;
      case "OrderedList": {
        const start = Number.parseInt(slice(node.from, node.to), 10);
        return (
          <ol className={style.orderedList} start={Number.isNaN(start) ? undefined : start}>
            {blocks(node)}
          </ol>
        );
      }
      case "ListItem":
        return listItem(node);
      case "FencedCode":
      case "CodeBlock":
        return overrides.code(node, render);
      case "HorizontalRule":
        return <hr className={style.rule} />;
      case "Table":
        return table(node);
      default:
        return null;
    }
  }

  function blocks(node: SyntaxNode): ReactNode[] {
    return keyed(
      children(node)
        .filter((child) => child.name !== "Task")
        .map(block),
    );
  }

  const render: MarkdownRender = { text, slice, inline, blocks };
  return render;
}

interface MarkdownViewProps {
  text: string;
  tree: Tree;
  style: MarkdownStyle;
  overrides: MarkdownOverrides;
}

export function MarkdownView({ text, tree, style, overrides }: MarkdownViewProps) {
  return markdownRender(text, style, overrides).blocks(tree.topNode);
}
