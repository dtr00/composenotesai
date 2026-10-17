type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const LITERALS: Record<string, Json> = { true: true, false: false, null: null };
const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
const NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/;
const UNICODE_ESCAPE_LENGTH = 4;

class Reader {
  at = 0;

  constructor(private readonly text: string) {}

  get done() {
    return this.at >= this.text.length;
  }

  skipSpace() {
    while (!this.done && /\s/.test(this.text[this.at])) this.at++;
  }

  peek() {
    return this.text[this.at];
  }

  string(): string {
    this.at++;
    let value = "";
    while (!this.done) {
      const char = this.text[this.at++];
      if (char === '"') return value;
      if (char !== "\\") {
        value += char;
        continue;
      }
      if (this.done) break;
      const code = this.text[this.at++];
      if (code === "u") {
        const hex = this.text.slice(this.at, this.at + UNICODE_ESCAPE_LENGTH);
        if (hex.length < UNICODE_ESCAPE_LENGTH) break;
        value += String.fromCharCode(Number.parseInt(hex, 16));
        this.at += UNICODE_ESCAPE_LENGTH;
      } else {
        value += ESCAPES[code] ?? code;
      }
    }
    return value;
  }

  value(): Json | undefined {
    this.skipSpace();
    if (this.done) return undefined;
    const char = this.peek();
    if (char === "{") return this.object();
    if (char === "[") return this.array();
    if (char === '"') return this.string();
    const number = NUMBER.exec(this.text.slice(this.at));
    if (number) {
      this.at += number[0].length;
      return Number(number[0]);
    }
    const literal = Object.keys(LITERALS).find((word) => this.text.startsWith(word, this.at));
    if (literal === undefined) return undefined;
    this.at += literal.length;
    return LITERALS[literal];
  }

  object(): { [key: string]: Json } {
    this.at++;
    const object: { [key: string]: Json } = {};
    for (;;) {
      this.skipSpace();
      if (this.done || this.peek() === "}") {
        this.at++;
        return object;
      }
      if (this.peek() === ",") {
        this.at++;
        continue;
      }
      if (this.peek() !== '"') return object;
      const key = this.string();
      this.skipSpace();
      if (this.done || this.peek() !== ":") return object;
      this.at++;
      const value = this.value();
      if (value === undefined) return object;
      object[key] = value;
    }
  }

  array(): Json[] {
    this.at++;
    const array: Json[] = [];
    for (;;) {
      this.skipSpace();
      if (this.done || this.peek() === "]") {
        this.at++;
        return array;
      }
      if (this.peek() === ",") {
        this.at++;
        continue;
      }
      const value = this.value();
      if (value === undefined) return array;
      array.push(value);
    }
  }
}

export function parsePartialObject(text: string): Record<string, unknown> {
  const value = new Reader(text).value();
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const isObject = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value);

export function isCompleteObject(text: string): boolean {
  if (!text.trim()) return true;
  try {
    return isObject(JSON.parse(text));
  } catch {
    return false;
  }
}

/**
 * Tool call arguments as valid JSON, closing any that were cut off. Servers such as llama.cpp
 * refuse a whole conversation when one earlier call holds broken JSON.
 */
export const jsonArguments = (text: string) =>
  isCompleteObject(text) && text.trim() ? text : JSON.stringify(parsePartialObject(text));
