import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const cwd = process.cwd();
const caddyDomainTemplatePath = path.join(cwd, "operations", "caddy", "Caddyfile.domain.template");
const caddyDomainOutputPath = path.join(cwd, "operations", "caddy", "Caddyfile.domain");
const domainPlaceholder = "{{DOMAIN_HOST}}";
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseCaddySiteAddress(configText) {
  const lines = configText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    if (!line.endsWith("{")) {
      continue;
    }
    const address = line.slice(0, -1).trim().split(/\s+/)[0];
    if (!address) {
      continue;
    }
    return address;
  }
  return null;
}

function normalizeDomainHost(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Domain host cannot be empty");
  }

  let host = trimmed;
  if (host.startsWith("https://")) {
    host = host.slice("https://".length);
  } else if (host.startsWith("http://")) {
    host = host.slice("http://".length);
  }

  if (host.includes("/")) {
    throw new Error("Domain host must not include URL paths");
  }

  if (host.includes(" ")) {
    throw new Error("Domain host must not include spaces");
  }

  if (!/^[*A-Za-z0-9.-]+(?::\d+)?$/.test(host)) {
    throw new Error("Domain host contains unsupported characters");
  }

  return host;
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

if (!fs.existsSync(caddyDomainTemplatePath)) {
  throw new Error(`Missing Caddy domain template: ${caddyDomainTemplatePath}`);
}
const caddyDomainTemplate = fs.readFileSync(caddyDomainTemplatePath, "utf8");

let currentDomainHost = null;
if (fs.existsSync(caddyDomainOutputPath)) {
  const existingDomainConfig = fs.readFileSync(caddyDomainOutputPath, "utf8");
  const parsed = parseCaddySiteAddress(existingDomainConfig);
  if (parsed) {
    currentDomainHost = parsed;
  }
}

const defaultDomainHost = currentDomainHost ?? "farfield.example.com";
let selectedDomainHost = defaultDomainHost;

if (interactive) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    process.stdout.write("Farfield domain HTTPS setup\n");
    process.stdout.write("This wizard generates operations/caddy/Caddyfile.domain from template.\n");
    process.stdout.write("- Use your real DNS host, for example farfield.yourdomain.com.\n");
    process.stdout.write("- This host should resolve to the machine running Farfield.\n");
    selectedDomainHost = await askNormalizedWithDefault(
      rl,
      "Enter domain host (no path)",
      defaultDomainHost,
      normalizeDomainHost
    );
  } finally {
    rl.close();
  }
} else {
  process.stdout.write("Farfield domain HTTPS setup (non-interactive mode)\n");
  process.stdout.write("- Using default domain host from existing config or template.\n");
}

const renderedDomainConfig = renderTemplate(
  caddyDomainTemplate,
  domainPlaceholder,
  selectedDomainHost,
  caddyDomainTemplatePath
);
fs.mkdirSync(path.dirname(caddyDomainOutputPath), { recursive: true });
fs.writeFileSync(caddyDomainOutputPath, withTrailingNewline(renderedDomainConfig), "utf8");

process.stdout.write(`Generated ${caddyDomainOutputPath} from ${caddyDomainTemplatePath}\n`);
process.stdout.write(`Domain host: ${selectedDomainHost}\n`);
process.stdout.write(
  'Next step: node scripts/tooling/with-env.mjs "caddy run --config operations/caddy/Caddyfile.domain"\n'
);
