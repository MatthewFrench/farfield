import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { parse } from "dotenv";
import webPush from "web-push";

const cwd = process.cwd();
const envLocalPath = path.join(cwd, ".env.local");
const caddyLocalTemplatePath = path.join(cwd, "ops", "caddy", "Caddyfile.local.template");
const caddyLocalOutputPath = path.join(cwd, "ops", "caddy", "Caddyfile.local");
const localSitePlaceholder = "{{SITE_ADDRESS}}";
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const managedKeys = new Set([
  "PUSH_ENABLED",
  "PUSH_VAPID_PUBLIC_KEY",
  "PUSH_VAPID_PRIVATE_KEY",
  "PUSH_VAPID_SUBJECT",
  "API_TOKEN",
  "PUSH_DOCTOR_TOKEN"
]);

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

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

function normalizePushContactSubject(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Push contact subject cannot be empty");
  }
  if (trimmed.startsWith("mailto:")) {
    const email = trimmed.slice("mailto:".length).trim();
    if (email.length === 0 || !email.includes("@")) {
      throw new Error(
        "Push contact subject must be a valid mailto address, for example mailto:you@yourdomain.com"
      );
    }
    return `mailto:${email}`;
  }
  if (trimmed.startsWith("https://")) {
    return trimmed;
  }
  throw new Error(
    "Push contact subject must start with mailto: or https://, for example mailto:you@yourdomain.com"
  );
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderTemplate(templateText, placeholder, replacement, templatePath) {
  const pattern = new RegExp(escapeRegExp(placeholder), "g");
  const matches = templateText.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `Template ${templatePath} must contain placeholder ${placeholder} exactly once (found ${String(matches.length)})`
    );
  }
  return templateText.replace(placeholder, replacement);
}

function withTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

async function askWithDefault(rl, prompt, defaultValue) {
  const raw = await rl.question(`${prompt} [${defaultValue}]: `);
  const value = raw.trim();
  return value.length > 0 ? value : defaultValue;
}

async function askNormalizedWithDefault(rl, prompt, defaultValue, normalize) {
  while (true) {
    const rawValue = await askWithDefault(rl, prompt, defaultValue);
    try {
      return normalize(rawValue);
    } catch (error) {
      process.stdout.write(`Invalid value: ${toErrorMessage(error)}\n`);
    }
  }
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

if (!fs.existsSync(caddyLocalTemplatePath)) {
  throw new Error(`Missing Caddy local template: ${caddyLocalTemplatePath}`);
}
const caddyLocalTemplate = fs.readFileSync(caddyLocalTemplatePath, "utf8");

const existingEnv = fs.existsSync(envLocalPath) ? parse(fs.readFileSync(envLocalPath, "utf8")) : {};
const existingPublic = (existingEnv["PUSH_VAPID_PUBLIC_KEY"] ?? "").trim();
const existingPrivate = (existingEnv["PUSH_VAPID_PRIVATE_KEY"] ?? "").trim();
const hasExistingVapid = existingPublic.length > 0 && existingPrivate.length > 0;

let caddySite = null;
if (fs.existsSync(caddyLocalOutputPath)) {
  const existingCaddyConfig = fs.readFileSync(caddyLocalOutputPath, "utf8");
  caddySite = parseCaddySiteLine(existingCaddyConfig);
}

const detectedIp = detectLocalIpv4Address();
const detectedAddress = detectedIp ? `https://${detectedIp}` : null;
const defaultSubjectRaw = (existingEnv["PUSH_VAPID_SUBJECT"] ?? "mailto:you@example.com").trim() || "mailto:you@example.com";
const defaultSubject = normalizePushContactSubject(defaultSubjectRaw);
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
    process.stdout.write("This wizard configures local HTTPS and Web Push for iPhone Home Screen use.\n");
    process.stdout.write("It writes .env.local and generates ops/caddy/Caddyfile.local from template.\n");
    process.stdout.write("\n1) HTTPS host for iPhone\n");
    process.stdout.write("- What it is: the exact HTTPS origin your iPhone will open.\n");
    process.stdout.write("- Why needed: service workers and push only work on secure HTTPS origins.\n");
    process.stdout.write(`- Suggested value: ${defaultAddress}\n`);
    if (detectedIp) {
      process.stdout.write(`- Detected LAN IP on this Mac: ${detectedIp}\n`);
    }
    selectedAddress = await askNormalizedWithDefault(
      rl,
      "Enter local HTTPS host (IP or hostname)",
      defaultAddress,
      normalizeHttpsAddress
    );
    process.stdout.write(`- Selected HTTPS origin: ${selectedAddress}\n`);

    process.stdout.write("\n2) Push contact subject (VAPID subject)\n");
    process.stdout.write("- What it is: operator contact identity included in Web Push auth.\n");
    process.stdout.write("- Why needed: push providers require a contact for security/abuse operations.\n");
    process.stdout.write("- User visibility: not shown in your app UI.\n");
    process.stdout.write("- For localhost/LAN testing: use your real email.\n");
    selectedSubject = await askNormalizedWithDefault(
      rl,
      "Enter push contact subject (mailto:... or https://...)",
      defaultSubject,
      normalizePushContactSubject
    );

    process.stdout.write("\n3) VAPID key pair\n");
    process.stdout.write("- What it is: public/private keys used to sign Web Push requests.\n");
    process.stdout.write("- Why needed: browser push services reject unsigned requests.\n");
    process.stdout.write("- Impact of rotation: old push subscriptions stop working until users re-enable notifications.\n");
    if (hasExistingVapid) {
      regenerateVapid = await askYesNo(rl, "Generate a new VAPID key pair now", false);
    } else {
      process.stdout.write("- No existing key pair found, so a new one will be generated.\n");
    }

    process.stdout.write("\n4) API token for /api requests\n");
    process.stdout.write("- What it is: shared secret used to protect Farfield HTTP API.\n");
    process.stdout.write("- Why needed: prevents random devices on LAN/domain from calling your API.\n");
    process.stdout.write("- Caddy forwards this token upstream automatically.\n");
    process.stdout.write("- Impact of rotation: restart running services and any external checks using old token.\n");
    regenerateApiToken = await askYesNo(rl, "Generate a new API token now", regenerateApiToken);
  } finally {
    rl.close();
  }
} else {
  process.stdout.write("Farfield iOS push setup (non-interactive mode)\n");
  process.stdout.write("- Using defaults from current config and environment values.\n");
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
  "# Generated by: bun run setup:ios-push",
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

const renderedCaddyLocal = renderTemplate(
  caddyLocalTemplate,
  localSitePlaceholder,
  selectedAddress,
  caddyLocalTemplatePath
);
fs.mkdirSync(path.dirname(caddyLocalOutputPath), { recursive: true });
fs.writeFileSync(caddyLocalOutputPath, withTrailingNewline(renderedCaddyLocal), "utf8");

process.stdout.write(`Wrote ${envLocalPath}\n`);
process.stdout.write(`Generated ${caddyLocalOutputPath} from ${caddyLocalTemplatePath}\n`);
process.stdout.write("Managed values:\n");
process.stdout.write("- PUSH_ENABLED=true (enables push endpoints)\n");
process.stdout.write(`- PUSH_VAPID_PUBLIC_KEY=${vapid.publicKey} (sent to browser during subscribe)\n`);
process.stdout.write(`- PUSH_VAPID_PRIVATE_KEY=${maskSecret(vapid.privateKey)} (server-only signing key)\n`);
process.stdout.write(`- PUSH_VAPID_SUBJECT=${selectedSubject} (operator contact for push providers)\n`);
process.stdout.write(`- API_TOKEN=${maskSecret(apiToken)} (protects API access)\n`);
process.stdout.write(`- PUSH_DOCTOR_TOKEN=${maskSecret(doctorToken)} (auth token used by push doctor checks)\n`);
process.stdout.write(`- Local HTTPS origin=${selectedAddress} (use this on iPhone Safari)\n`);
process.stdout.write("\nNext steps:\n");
process.stdout.write("- bun run ios:trust-local-ca\n");
process.stdout.write("- bun run ios:local\n");
