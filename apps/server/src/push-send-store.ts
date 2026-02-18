import fs from "node:fs";
import path from "node:path";
import {
  parsePushSendStore,
  type PushSendStore as PushSendStoreState,
  type PushSendSummary
} from "@farfield/protocol";

function buildDefaultState(): PushSendStoreState {
  return parsePushSendStore({
    version: 1,
    latest: null
  });
}

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

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const encoded = `${JSON.stringify(this.state, null, 2)}\n`;
    const fd = fs.openSync(tempPath, "w", 0o600);
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

    const dirFd = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  }
}
