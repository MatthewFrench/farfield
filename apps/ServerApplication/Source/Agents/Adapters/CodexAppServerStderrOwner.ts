import { logger } from "../../Shared/Logging/Logger.js";

type CodexAppServerStderrSeverity = "error" | "warn" | "debug";

const ANSI_ESCAPE_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const APP_SERVER_STDERR_ERROR_PATTERN = /\b(error|fatal|panic)\b/i;
const APP_SERVER_STDERR_WARN_PATTERN = /\bwarn(?:ing)?\b/i;
const APP_SERVER_STDERR_LOG_EVENT = "codex-app-server-stderr";
const APP_SERVER_STDERR_IGNORED_LOG_EVENT = "codex-app-server-stderr-ignored";

const ROLLOUT_LIST_SCOPE_FRAGMENT = "codex_core::rollout::list";
const ROLLOUT_PATH_MISSING_FRAGMENT = "state db missing rollout path for thread";
const STATE_DATABASE_SCOPE_FRAGMENT = "codex_core::state_db";
const STATE_DATABASE_DISCREPANCY_FRAGMENT = (
  "state db record_discrepancy: find_thread_path_by_id_str_in_subdir"
);
const STATE_DATABASE_RETRY_FRAGMENT = "falling_back";

export class CodexAppServerStderrOwner {
  public handleStderrLine(line: string): void {
    const normalizedLine = this.normalizeLine(line);
    if (this.isKnownBenignLine(normalizedLine)) {
      logger.debug({ line: normalizedLine }, APP_SERVER_STDERR_IGNORED_LOG_EVENT);
      return;
    }

    const severity = this.classifySeverity(normalizedLine);
    if (severity === "error") {
      logger.error({ line: normalizedLine }, APP_SERVER_STDERR_LOG_EVENT);
      return;
    }

    if (severity === "warn") {
      logger.warn({ line: normalizedLine }, APP_SERVER_STDERR_LOG_EVENT);
      return;
    }

    logger.debug({ line: normalizedLine }, APP_SERVER_STDERR_LOG_EVENT);
  }

  private normalizeLine(line: string): string {
    return line.replace(ANSI_ESCAPE_REGEX, "").trim();
  }

  private isKnownBenignLine(line: string): boolean {
    const isRolloutPathNotice = (
      line.includes(ROLLOUT_LIST_SCOPE_FRAGMENT)
      && line.includes(ROLLOUT_PATH_MISSING_FRAGMENT)
    );
    const isStateDatabasePathRetryNotice = (
      line.includes(STATE_DATABASE_SCOPE_FRAGMENT)
      && line.includes(STATE_DATABASE_DISCREPANCY_FRAGMENT)
      && line.includes(STATE_DATABASE_RETRY_FRAGMENT)
    );

    return isRolloutPathNotice || isStateDatabasePathRetryNotice;
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
