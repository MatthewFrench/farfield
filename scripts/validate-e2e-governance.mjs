import fs from "node:fs";
import path from "node:path";

const matrixPath = path.join(process.cwd(), "e2e", "real", "coverage-matrix.md");

function fail(message) {
  process.stderr.write(`[e2e-governance] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(matrixPath)) {
  fail(`Missing coverage matrix: ${matrixPath}`);
}

const raw = fs.readFileSync(matrixPath, "utf8");
const lines = raw.split(/\r?\n/);

const start = lines.findIndex((line) => line.trim() === "## Open Gaps");
if (start === -1) {
  fail('Missing "## Open Gaps" section in coverage matrix');
}

const tableRows = [];
for (let index = start + 1; index < lines.length; index += 1) {
  const line = lines[index].trim();
  if (line.startsWith("## ")) {
    break;
  }
  if (!line.startsWith("|")) {
    continue;
  }
  if (line.includes("---")) {
    continue;
  }
  tableRows.push(line);
}

if (tableRows.length <= 1) {
  process.stdout.write("[e2e-governance] Open gaps table has no active entries\n");
  process.exit(0);
}

const header = tableRows[0]
  .split("|")
  .map((cell) => cell.trim())
  .filter((cell) => cell.length > 0);

const expectedHeader = ["Gap", "Impact", "Owner", "Due Date", "Tracking Issue"];
if (header.join("|") !== expectedHeader.join("|")) {
  fail(`Unexpected Open Gaps header. Expected: ${expectedHeader.join(" | ")}`);
}

const nowDate = new Date();
const todayUtcMs = Date.UTC(
  nowDate.getUTCFullYear(),
  nowDate.getUTCMonth(),
  nowDate.getUTCDate()
);
const activeGaps = [];

for (let rowIndex = 1; rowIndex < tableRows.length; rowIndex += 1) {
  const row = tableRows[rowIndex];
  const cells = row
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (cells.length === 0) {
    continue;
  }

  if (cells.length !== expectedHeader.length) {
    fail(`Open gap row ${rowIndex + 1} has ${cells.length} cells; expected ${expectedHeader.length}`);
  }

  const [gap, impact, owner, dueDate, trackingIssue] = cells;

  if (gap.length === 0 || impact.length === 0 || owner.length === 0 || dueDate.length === 0 || trackingIssue.length === 0) {
    fail(`Open gap row ${rowIndex + 1} is missing required values`);
  }

  const due = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(due.getTime())) {
    fail(`Open gap row ${rowIndex + 1} has invalid due date: ${dueDate}`);
  }

  const dueUtcMs = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  if (dueUtcMs < todayUtcMs) {
    fail(`Open gap row ${rowIndex + 1} is past due (${dueDate}): ${gap}`);
  }

  activeGaps.push({ gap, owner, dueDate });
}

process.stdout.write(
  `[e2e-governance] Open gap checks passed (${String(activeGaps.length)} active gap entries)\n`
);
