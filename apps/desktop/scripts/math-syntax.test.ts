import assert from "node:assert/strict";
import { test } from "node:test";
import { GFM, parser } from "@lezer/markdown";
import { mathSource, mathSyntax } from "../src/shared/lib/math-syntax";

const markdown = parser.configure([GFM, mathSyntax]);

function math(text: string) {
  const found: string[] = [];
  markdown.parse(text).iterate({
    enter: (node) => {
      if (node.name === "InlineMath" || node.name === "DisplayMath")
        found.push(`${node.name}:${mathSource(text, node.name, node.from, node.to)}`);
    },
  });
  return found;
}

test("inline and display math are found", () => {
  assert.deepEqual(math("If $a = 4$ and $b = 7$, then $a + b = 11$."), [
    "InlineMath:a = 4",
    "InlineMath:b = 7",
    "InlineMath:a + b = 11",
  ]);
  assert.deepEqual(math("$$\\frac{a}{b}$$"), ["DisplayMath:\\frac{a}{b}"]);
  assert.deepEqual(math("$$\nx^2 + y^2\n$$"), ["DisplayMath:x^2 + y^2"]);
  assert.deepEqual(math("$a_1 * b_2 * c$"), ["InlineMath:a_1 * b_2 * c"]);
  assert.deepEqual(math("$\\$5$"), ["InlineMath:\\$5"]);
});

test("prices and escaped dollars stay text", () => {
  assert.deepEqual(math("It costs $5 and $10."), []);
  assert.deepEqual(math("From $5-$10 a day"), []);
  assert.deepEqual(math("Pay $ 5 now$"), []);
  assert.deepEqual(math("\\$x\\$"), []);
  assert.deepEqual(math("`$x$` in code"), []);
});
