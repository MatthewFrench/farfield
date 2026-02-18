import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { parse } from "dotenv";
import webPush from "web-push";

const cwd = process.cwd();
const envLocalPath = path.join(cwd, ".env.local");
const caddyLocalPath = path.join(cwd, "ops", "caddy", "Caddyfile.local");
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const managedKeys = new Set([
  "PUSH_ENABLED",
  "PUSH_VAPID_PUBLIC_KEY",
  "PUSH_VAPID_PRIVATE_KEY",
  "PUSH_VAPID_SUBJECT",
  "API_TOKEN",
  "PUSH_DOCTOR_TOKEN"
]);

function maskSecret(value) {
  if (value.length <= 10) {
    return "***";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeHttpsAddress(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("HTTPS host cannot be empty");
  }
  if (trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  return `https://${trimmed}`;
}

function parseCaddySiteLine(configText) {
  const lines = configText.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(\s*)([^#\s].*?)\s*\{\s*$/);
    if (!match) {
      continue;
    }
    const address = match[2]?.trim();
    if (!address) {
      continue;
    }
    return {
      lineIndex: index,
      indent: match[1] ?? "",
      address
    };
  }
  return null;
}

function detectLocalIpv4Address() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) {
      continue;
    }
    for (const entry of entries) {
      if (entry.internal) {
        continue;
      }
      if (entry.family !== "IPv4") {
        continue;
      }
      candidates.push({
        name,
        address: entry.address
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftScore = left.name.startsWith("en") ? 0 : 1;
    const rightScore = right.name.startsWith("en") ? 0 : 1;
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return left.name.localeCompare(right.name);
  });
  return candidates[0]?.address ?? null;
}

async function askWithDefault(rl, prompt, defaultValue) {
  const raw = await rl.question(`${prompt} [${defaultValue}]: `);
  const value = raw.trim();
  return value.length > 0 ? value : defaultValue;
}

async function askYesNo(rl, prompt, defaultValue) {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const raw = await rl.question(`${prompt} (${suffix}): `);
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0) {
    return defaultValue;
  }
  if (normalized === "y" || normalized === "yes") {
    return true;
  }
  if (normalized === "n" || normalized === "no") {
    return false;
  }
  return defaultValue;
}

function renderDefaultCaddyLocalConfig(siteAddress) {
  return `${siteAddress} {
  tls internal

  @api path /api/*
  reverse_proxy @api 127.0.0.1:4311 {
    header_up X-Farfield-Token {env.API_TOKEN}
  }

  @events path /events
  reverse_proxy @events 127.0.0.1:4311 {
    flush_interval -1
  }

  reverse_proxy 127.0.0.1:4312
}
`;
}

const existingEnv = fs.existsSync(envLocalPath) ? parse(fs.readFileSync(envLocalPath, "utf8")) : {};
const existingPublic = (existingEnv["PUSH_VAPID_PUBLIC_KEY"] ?? "").trim();
const existingPrivate = (existingEnv["PUSH_VAPID_PRIVATE_KEY"] ?? "").trim();
const hasExistingVapid = existingPublic.length > 0 && existingPrivate.length > 0;

let existingCaddyConfig = "";
let caddySite = null;
if (fs.existsSync(caddyLocalPath)) {
  existingCaddyConfig = fs.readFileSync(caddyLocalPath, "utf8");
  caddySite = parseCaddySiteLine(existingCaddyConfig);
}

const detectedIp = detectLocalIpv4Address();
const detectedAddress = detectedIp ? `https://${detectedIp}` : null;
const defaultSubject = (existingEnv["PUSH_VAPID_SUBJECT"] ?? "mailto:you@example.com").trim() || "mailto:you@example.com";
const currentAddress = caddySite?.address ? normalizeHttpsAddress(caddySite.address) : null;
const sampleAddress = "https://192.168.1.50";
const defaultAddress =
  currentAddress === null
    ? interactive
      ? detectedAddress ?? sampleAddress
      : sampleAddress
    : interactive && currentAddress === sampleAddress && detectedAddress
    ? detectedAddress
    : currentAddress;

let selectedAddress = defaultAddress;
let selectedSubject = defaultSubject;
let regenerateVapid = !hasExistingVapid;
let regenerateApiToken = (existingEnv["API_TOKEN"] ?? "").trim().length === 0;

if (interactive) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    process.stdout.write("Farfield iOS push setup\n");
    process.stdout.write(`- Suggested HTTPS host: ${defaultAddress}\n`);
    if (detectedIp) {
      process.stdout.write(`- Detected LAN IP: ${detectedIp}\n`);
    }
    selectedAddress = normalizeHttpsAddress(
      await askWithDefault(rl, "Local HTTPS host for iPhone (IP or hostname)", defaultAddress)
    );
    selectedSubject = await askWithDefault(rl, "Push contact subject (mailto:...)", defaultSubject);
    if (hasExistingVapid) {
      regenerateVapid = await askYesNo(rl, "Regenerate VAPID key pair", false);
    }
    regenerateApiToken = await askYesNo(rl, "Regenerate API token", regenerateApiToken);
  } finally {
    rl.close();
  }
}

const vapid = hasExistingVapid && !regenerateVapid
  ? {
      publicKey: existingPublic,
      privateKey: existingPrivate
    }
  : webPush.generateVAPIDKeys();

const currentApiToken = (existingEnv["API_TOKEN"] ?? existingEnv["PUSH_API_TOKEN"] ?? "").trim();
const apiToken = !regenerateApiToken && currentApiToken.length > 0
  ? currentApiToken
  : randomBytes(32).toString("hex");
const doctorToken = apiToken;

const nextManagedEntries = [
  ["PUSH_ENABLED", "true"],
  ["PUSH_VAPID_PUBLIC_KEY", vapid.publicKey],
  ["PUSH_VAPID_PRIVATE_KEY", vapid.privateKey],
  ["PUSH_VAPID_SUBJECT", selectedSubject],
  ["API_TOKEN", apiToken],
  ["PUSH_DOCTOR_TOKEN", doctorToken]
];

const preservedEntries = Object.entries(existingEnv).filter(([key]) => !managedKeys.has(key));

const envLines = [
  "# Generated by: pnpm setup:ios-push",
  "# Local environment for Farfield iOS push setup.",
  ""
];
for (const [key, value] of nextManagedEntries) {
  envLines.push(`${key}=${value}`);
}
if (preservedEntries.length > 0) {
  envLines.push("", "# Preserved entries");
  for (const [key, value] of preservedEntries) {
    envLines.push(`${key}=${value}`);
  }
}
fs.writeFileSync(envLocalPath, `${envLines.join("\n")}\n`, "utf8");

if (existingCaddyConfig.length === 0) {
  fs.mkdirSync(path.dirname(caddyLocalPath), { recursive: true });
  fs.writeFileSync(caddyLocalPath, renderDefaultCaddyLocalConfig(selectedAddress), "utf8");
} else if (caddySite) {
  const caddyLines = existingCaddyConfig.split(/\r?\n/);
  const siteLine = `${caddySite.indent}${selectedAddress} {`;
  caddyLines[caddySite.lineIndex] = siteLine;
  fs.writeFileSync(caddyLocalPath, `${caddyLines.join("\n")}\n`, "utf8");
} else {
  throw new Error(`Could not update site address in ${caddyLocalPath}`);
}

process.stdout.write(`Wrote ${envLocalPath}\n`);
process.stdout.write(`Updated ${caddyLocalPath}\n`);
process.stdout.write("Managed values:\n");
process.stdout.write("- PUSH_ENABLED=true\n");
process.stdout.write(`- PUSH_VAPID_PUBLIC_KEY=${vapid.publicKey}\n`);
process.stdout.write(`- PUSH_VAPID_PRIVATE_KEY=${maskSecret(vapid.privateKey)}\n`);
process.stdout.write(`- PUSH_VAPID_SUBJECT=${selectedSubject}\n`);
process.stdout.write(`- API_TOKEN=${maskSecret(apiToken)}\n`);
process.stdout.write(`- PUSH_DOCTOR_TOKEN=${maskSecret(doctorToken)}\n`);
process.stdout.write(`- Local HTTPS origin=${selectedAddress}\n`);
process.stdout.write("\nNext step: pnpm ios:local\n");
