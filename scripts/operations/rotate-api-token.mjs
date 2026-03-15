import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";

const cwd = process.cwd();
const envLocalPath = path.join(cwd, ".env.local");

if (!fs.existsSync(envLocalPath)) {
  process.stderr.write(`Missing ${envLocalPath}. Run bun run setup:ios-push first.\n`);
  process.exit(1);
}

function maskSecret(value) {
  if (value.length <= 10) {
    return "***";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

const existing = parse(fs.readFileSync(envLocalPath, "utf8"));
const nextToken = randomBytes(32).toString("hex");

existing["API_TOKEN"] = nextToken;
existing["PUSH_DOCTOR_TOKEN"] = nextToken;
delete existing["PUSH_API_TOKEN"];

const entries = Object.entries(existing);
const lines = ["# Updated by: bun run rotate:api-token", ""];
for (const [key, value] of entries) {
  lines.push(`${key}=${value}`);
}

fs.writeFileSync(envLocalPath, `${lines.join("\n")}\n`, "utf8");

process.stdout.write(`Updated ${envLocalPath}\n`);
process.stdout.write(`- API_TOKEN=${maskSecret(nextToken)}\n`);
process.stdout.write(`- PUSH_DOCTOR_TOKEN=${maskSecret(nextToken)}\n`);
process.stdout.write("\nRestart running dev/Caddy processes to apply the rotated token.\n");
