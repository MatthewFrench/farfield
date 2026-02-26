import fs from "node:fs";
import path from "node:path";
import {
  parsePushReceiptStore,
  type PushReceipt,
  type PushReceiptStore as PushReceiptStoreState
} from "@farfield/protocol";

const PUSH_RECEIPT_STORE_VERSION = 2;
const JSON_INDENT_SPACES = 2;
const LINE_FEED = "\n";
const TEMP_FILE_EXTENSION = "tmp";
const OWNER_READ_WRITE_PERMISSIONS = 0o600;
const WINDOWS_PLATFORM = "win32";

function buildDefaultState(): PushReceiptStoreState {
  return parsePushReceiptStore({
    version: PUSH_RECEIPT_STORE_VERSION,
    receipts: []
  });
}

/**
 * Owns bounded retention of push delivery receipts for debug surfaces.
 */
export class PushReceiptStore {
  private readonly filePath: string;
  private readonly maxReceipts: number;
  private readonly maxReceiptAgeMs: number;
  private state: PushReceiptStoreState;

  public constructor(filePath: string, maxReceipts: number, maxReceiptAgeMs: number) {
    if (!Number.isInteger(maxReceipts) || maxReceipts <= 0) {
      throw new Error("maxReceipts must be a positive integer");
    }
    if (!Number.isInteger(maxReceiptAgeMs) || maxReceiptAgeMs <= 0) {
      throw new Error("maxReceiptAgeMs must be a positive integer");
    }
    this.filePath = path.resolve(filePath);
    this.maxReceipts = maxReceipts;
    this.maxReceiptAgeMs = maxReceiptAgeMs;
    this.state = buildDefaultState();
  }

  public load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.state = buildDefaultState();
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    if (raw.trim().length === 0) {
      this.state = buildDefaultState();
      return;
    }

    const parsedJson = JSON.parse(raw);
    this.state = parsePushReceiptStore(parsedJson);
    const receiptCountBeforePrune = this.state.receipts.length;
    this.prune(Date.now());
    if (this.state.receipts.length !== receiptCountBeforePrune) {
      this.persist();
    }
  }

  public getCount(): number {
    return this.state.receipts.length;
  }

  public getLatest(): PushReceipt | null {
    if (this.state.receipts.length === 0) {
      return null;
    }
    const latest = this.state.receipts[this.state.receipts.length - 1];
    if (!latest) {
      return null;
    }
    return { ...latest };
  }

  public add(receipt: PushReceipt): void {
    this.state.receipts.push({ ...receipt });
    this.prune(Date.now());
    this.persist();
  }

  private prune(nowMs: number): void {
    const oldestAllowedMs = nowMs - this.maxReceiptAgeMs;
    this.state.receipts = this.state.receipts.filter((receipt) => {
      const createdAtMs = Date.parse(receipt.createdAt);
      if (Number.isNaN(createdAtMs)) {
        return false;
      }
      return createdAtMs >= oldestAllowedMs;
    });

    if (this.state.receipts.length > this.maxReceipts) {
      this.state.receipts.splice(0, this.state.receipts.length - this.maxReceipts);
    }
  }

  private persist(): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${TEMP_FILE_EXTENSION}`;
    const encoded = `${JSON.stringify(this.state, null, JSON_INDENT_SPACES)}${LINE_FEED}`;
    const fd = fs.openSync(tempPath, "w", OWNER_READ_WRITE_PERMISSIONS);
    try {
      fs.writeFileSync(fd, encoded, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    try {
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }

    if (process.platform !== WINDOWS_PLATFORM) {
      const dirFd = fs.openSync(directory, "r");
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }
    }
  }
}
