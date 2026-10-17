import { spawn } from "node:child_process";
import process from "node:process";

const DEFAULT_PORT = 1420;
const PORT_FLAG = /^--port(?:=(.*))?$/;

function parseArgs(args: string[]) {
  let port = DEFAULT_PORT;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const match = PORT_FLAG.exec(args[i]);
    if (!match) {
      rest.push(args[i]);
      continue;
    }
    const value = match[1] ?? args[++i];
    port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`--port must be a number from 1 to 65535, got "${value ?? ""}".`);
    }
  }
  return { port, rest };
}

try {
  const { port, rest } = parseArgs(process.argv.slice(2));
  const config = {
    build: { devUrl: `http://localhost:${port}`, beforeDevCommand: `bun run dev --port ${port}` },
  };
  const tauri = spawn("bun", ["run", "tauri", "dev", "--config", JSON.stringify(config), ...rest], {
    stdio: "inherit",
  });
  tauri.on("exit", (code) => process.exit(code ?? 1));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
