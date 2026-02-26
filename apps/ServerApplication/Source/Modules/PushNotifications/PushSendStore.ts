import fs from "node:fs";
import path from "node:path";
import {
  parsePushSendStore,
  type PushSendStore as PushSendStoreState,
  type PushSendSummary
} from "@farfield/protocol";

const PUSH_SEND_STORE_VERSION = 1;
const JSON_INDENT_SPACES = 2;
const LINE_FEED = "\n";
const TEMP_FILE_EXTENSION = "tmp";
const OWNER_READ_WRITE_PERMISSIONS = 0o600;
const WINDOWS_PLATFORM = "win32";

function buildDefaultState(): PushSendStoreState {
  return parsePushSendStore({
    version: PUSH_SEND_STORE_VERSION,
    latest: null
  });
}

/**
 * Owns persistence for the latest push send summary shown in debug and status surfaces.
 */
export class PushSendStore {
  private readonly filePath: string;
  private state: PushSendStoreState;

  public constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
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
    this.state = parsePushSendStore(parsedJson);
  }

  public getLatest(): PushSendSummary | null {
    if (!this.state.latest) {
      return null;
    }
    return { ...this.state.latest };
  }

  public setLatest(summary: PushSendSummary): void {
    this.state.latest = { ...summary };
    this.persist();
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
