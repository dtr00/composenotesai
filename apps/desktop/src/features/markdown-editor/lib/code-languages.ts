import { LanguageDescription } from "@codemirror/language";
import type { Parser, Tree } from "@lezer/common";
import { languages } from "@codemirror/language-data";

export type PrettierParser = "babel" | "typescript" | "json" | "css" | "scss" | "less" | "html" | "markdown" | "yaml";

export interface CodeLanguage {
  id: string;
  label: string;
  parser?: PrettierParser;
  aliases?: string[];
}

const PLAIN_TEXT: CodeLanguage = { id: "", label: "Plain text" };

export const CODE_LANGUAGES: CodeLanguage[] = [
  PLAIN_TEXT,
  { id: "bash", label: "Bash", aliases: ["sh", "shell", "zsh"] },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "css", label: "CSS", parser: "css" },
  { id: "dart", label: "Dart" },
  { id: "diff", label: "Diff" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "go", label: "Go" },
  { id: "html", label: "HTML", parser: "html" },
  { id: "java", label: "Java" },
  { id: "js", label: "JavaScript", parser: "babel" },
  { id: "json", label: "JSON", parser: "json" },
  { id: "jsx", label: "JSX", parser: "babel" },
  { id: "kotlin", label: "Kotlin" },
  { id: "less", label: "Less", parser: "less" },
  { id: "lua", label: "Lua" },
  { id: "markdown", label: "Markdown", parser: "markdown", aliases: ["md"] },
  { id: "php", label: "PHP" },
  { id: "powershell", label: "PowerShell" },
  { id: "python", label: "Python", aliases: ["py"] },
  { id: "ruby", label: "Ruby" },
  { id: "rust", label: "Rust", aliases: ["rs"] },
  { id: "scss", label: "SCSS", parser: "scss" },
  { id: "sql", label: "SQL" },
  { id: "swift", label: "Swift" },
  { id: "toml", label: "TOML" },
  { id: "ts", label: "TypeScript", parser: "typescript" },
  { id: "tsx", label: "TSX", parser: "typescript" },
  { id: "xml", label: "XML" },
  { id: "yaml", label: "YAML", parser: "yaml", aliases: ["yml"] },
];

const describe = (id: string) => LanguageDescription.matchLanguageName(languages, id, true);

export function codeLanguage(info: string): CodeLanguage {
  const id = info.trim().split(/\s/)[0] ?? "";
  if (id === "") return PLAIN_TEXT;
  const lower = id.toLowerCase();
  const curated = CODE_LANGUAGES.find((language) => language.id === lower || language.aliases?.includes(lower));
  if (curated) return curated;
  const description = describe(id);
  const known = description && CODE_LANGUAGES.find((language) => language.id && describe(language.id) === description);
  return known || { id, label: description?.name ?? id };
}

export const codeParserFor = (info: string) => describe(codeLanguage(info).id) ?? null;

async function loadParser(id: string): Promise<[string, Parser][]> {
  const description = describe(id);
  if (!description) return [];
  const support = description.support ?? (await description.load());
  return [[id, support.language.parser]];
}

export async function loadCodeParsers(tree: Tree, markdown: string): Promise<ReadonlyMap<string, Parser>> {
  const ids = new Set<string>();
  tree.iterate({
    enter: (node) => {
      if (node.name === "CodeInfo") ids.add(codeLanguage(markdown.slice(node.from, node.to)).id);
    },
  });
  ids.delete("");
  return new Map((await Promise.all([...ids].map(loadParser))).flat());
}
