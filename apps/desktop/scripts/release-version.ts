import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export type Bump = "major" | "minor" | "patch";

const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };
const HEADER = /^(\w+)(?:\([^)]*\))?(!)?: /;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const PACKAGE_VERSION = /^version = "(.+)"$/m;
const LOCKED_VERSION = /(\[\[package\]\]\nname = "composenotesai"\nversion = )"[^"]+"/;

export function commitBump(message: string): Bump | null {
  const header = HEADER.exec(message);
  if (!header) return null;
  if (header[2] || BREAKING_FOOTER.test(message)) return "major";
  if (header[1] === "feat") return "minor";
  if (header[1] === "fix" || header[1] === "perf") return "patch";
  return null;
}

export function releaseBump(messages: string[]): Bump | null {
  let bump: Bump | null = null;
  for (const next of messages.map(commitBump)) {
    if (next && (!bump || RANK[next] > RANK[bump])) bump = next;
  }
  return bump;
}

export function bumpVersion(version: string, bump: Bump): string {
  const match = VERSION.exec(version);
  if (!match) throw new Error(`"${version}" is not a major.minor.patch version.`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const git = (...args: string[]) => execFileSync("git", args, { cwd: appDir, encoding: "utf8" });

function replaceIn(path: string, pattern: RegExp, replacement: string) {
  const text = readFileSync(path, "utf8");
  if (!pattern.test(text)) throw new Error(`No version found in ${path}.`);
  writeFileSync(path, text.replace(pattern, replacement));
}

const appDir = join(import.meta.dirname, "..");

function main() {
  const cargoToml = join(appDir, "src-tauri/Cargo.toml");
  const current = PACKAGE_VERSION.exec(readFileSync(cargoToml, "utf8"))?.[1];
  if (!current) throw new Error(`No version found in ${cargoToml}.`);
  if (git("tag", "--list", `v${current}`).trim() === "") return;
  const messages = git("log", "--format=%B%x00", `v${current}..HEAD`, "--", ".").split("\0");
  const bump = releaseBump(messages.map((message) => message.trim()));
  if (!bump) return;
  const next = bumpVersion(current, bump);
  replaceIn(cargoToml, PACKAGE_VERSION, `version = "${next}"`);
  replaceIn(join(appDir, "src-tauri/Cargo.lock"), LOCKED_VERSION, `$1"${next}"`);
  console.log(next);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
