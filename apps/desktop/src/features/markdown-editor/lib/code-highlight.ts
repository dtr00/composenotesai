import { syntaxHighlighting } from "@codemirror/language";
import { tagHighlighter, tags } from "@lezer/highlight";

export const codeTokens = tagHighlighter([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.modifier, tags.self],
    class: "cm-syntax-keyword",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character, tags.inserted],
    class: "cm-syntax-string",
  },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.constant(tags.variableName)], class: "cm-syntax-number" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], class: "cm-syntax-comment" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName],
    class: "cm-syntax-function",
  },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], class: "cm-syntax-type" },
  { tag: [tags.propertyName, tags.attributeName, tags.labelName], class: "cm-syntax-property" },
  { tag: [tags.deleted], class: "cm-syntax-keyword" },
]);

export const codeHighlight = syntaxHighlighting(codeTokens);
