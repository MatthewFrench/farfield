import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

const cwd = process.cwd();
const envPaths = [path.join(cwd, ".env"), path.join(cwd, ".env.local")];
const loadedEnv = {};

for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) {
    continue;
  }
  const parsed = parse(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    loadedEnv[key] = value;
  }
}

const commandText = process.argv.slice(2).join(" ").trim();
if (commandText.length === 0) {
  process.stderr.write("[with-env] missing command\n");
  process.exit(1);
}

const child = spawn(commandText, {
  cwd,
  env: {
    ...loadedEnv,
    ...process.env
  },
  shell: true,
  stdio: "inherit"
});

child.on("error", (error) => {
  process.stderr.write(`[with-env] failed to start command: ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
