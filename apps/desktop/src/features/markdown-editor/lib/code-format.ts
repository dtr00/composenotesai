import type { Plugin } from "prettier";
import { errorMessage } from "../../../shared/lib/error-toast";
import type { PrettierParser } from "./code-languages";

const estree = () => import("prettier/plugins/estree");
const postcss = () => import("prettier/plugins/postcss");

const PLUGINS: Record<PrettierParser, () => Promise<Plugin>[]> = {
  babel: () => [import("prettier/plugins/babel"), estree()],
  json: () => [import("prettier/plugins/babel"), estree()],
  typescript: () => [import("prettier/plugins/typescript"), estree()],
  css: () => [postcss()],
  scss: () => [postcss()],
  less: () => [postcss()],
  html: () => [import("prettier/plugins/html"), postcss(), import("prettier/plugins/babel"), estree()],
  markdown: () => [import("prettier/plugins/markdown")],
  yaml: () => [import("prettier/plugins/yaml")],
};

export async function formatCode(code: string, parser: PrettierParser) {
  const [{ format }, ...plugins] = await Promise.all([import("prettier/standalone"), ...PLUGINS[parser]()]);
  const formatted = await format(code, { parser, plugins });
  return formatted.replace(/\n$/, "");
}

export const formatError = (error: unknown) => `Couldn't prettify this code: ${errorMessage(error).split("\n")[0]}`;
