import { logger } from "../../Shared/Logging/Logger.js";

type CodexAppServerStderrSeverity = "error" | "warn" | "debug";

const ANSI_ESCAPE_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const APP_SERVER_STDERR_ERROR_PATTERN = /\b(error|fatal|panic)\b/i;
const APP_SERVER_STDERR_WARN_PATTERN = /\bwarn(?:ing)?\b/i;

export class CodexAppServerStderrOwner {
  public handleStderrLine(line: string): void {
    const normalizedLine = this.normalizeLine(line);
    if (this.isKnownBenignLine(normalizedLine)) {
      logger.debug({ line: normalizedLine }, "codex-app-server-stderr-ignored");
      return;
    }

    const severity = this.classifySeverity(normalizedLine);
    if (severity === "error") {
      logger.error({ line: normalizedLine }, "codex-app-server-stderr");
      return;
    }

    if (severity === "warn") {
      logger.warn({ line: normalizedLine }, "codex-app-server-stderr");
      return;
    }

    logger.debug({ line: normalizedLine }, "codex-app-server-stderr");
  }

  private normalizeLine(line: string): string {
    return line.replace(ANSI_ESCAPE_REGEX, "").trim();
  }

  private isKnownBenignLine(line: string): boolean {
    return (
      line.includes("codex_core::rollout::list") &&
      line.includes("state db missing rollout path for thread")
    ) || (
      line.includes("codex_core::state_db") &&
      line.includes("state db record_discrepancy: find_thread_path_by_id_str_in_subdir") &&
      line.includes("falling_back")
    );
  }

  private classifySeverity(line: string): CodexAppServerStderrSeverity {
    if (APP_SERVER_STDERR_ERROR_PATTERN.test(line)) {
      return "error";
    }

    if (APP_SERVER_STDERR_WARN_PATTERN.test(line)) {
      return "warn";
    }

    return "debug";
  }
}
