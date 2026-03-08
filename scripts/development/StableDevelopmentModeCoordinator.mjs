import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { StableDevelopmentApiServerOwner } from "./StableDevelopmentApiServerOwner.mjs";
import { StableDevelopmentStatusArtifactOwner } from "./StableDevelopmentStatusArtifactOwner.mjs";

const bunBinary = process.platform === "win32" ? "bun.exe" : "bun";
const BuildRetentionCount = 2;
const IgnoredDirectoryNames = new Set([
  ".git",
  ".runtime",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "traces",
]);
const InheritedEnvironmentExactKeys = new Set([
  "ALL_PROXY",
  "APPDATA",
  "CI",
  "CODEX_HOME",
  "COLORTERM",
  "ComSpec",
  "EDITOR",
  "FORCE_COLOR",
  "HOME",
  "HOST",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "LOG_LEVEL",
  "NO_COLOR",
  "NO_PROXY",
  "PATH",
  "PORT",
  "PWD",
  "SHELL",
  "SHLVL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SystemRoot",
  "TERM",
  "TERM_PROGRAM",
  "TMP",
  "TMPDIR",
  "TEMP",
  "TZ",
  "USER",
  "USERNAME",
  "USERPROFILE",
  "VISUAL",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
]);
const InheritedEnvironmentPrefixes = [
  "API_",
  "APP_SMOKE_",
  "BUN_",
  "CADDY_",
  "CODEX_",
  "DEBUG_",
  "E2E_REAL_",
  "FARFIELD_",
  "GITHUB_",
  "IOS_",
  "NODE_",
  "NTFY_",
  "NPM_",
  "PLAYWRIGHT_",
  "PUSH_",
  "STREAM_BURST_",
  "THREAD_",
  "VITE_",
  "WEB_",
  "npm_",
];

function shouldIncludeInheritedEnvironmentKey(environmentKey) {
  if (InheritedEnvironmentExactKeys.has(environmentKey)) {
    return true;
  }

  return InheritedEnvironmentPrefixes.some((prefix) => environmentKey.startsWith(prefix));
}

function buildChildEnvironment(sourceEnvironment, overrides) {
  const childEnvironment = {};
  for (const [environmentKey, environmentValue] of Object.entries(sourceEnvironment)) {
    if (!shouldIncludeInheritedEnvironmentKey(environmentKey)) {
      continue;
    }
    if (typeof environmentValue !== "string") {
      continue;
    }
    childEnvironment[environmentKey] = environmentValue;
  }

  for (const [environmentKey, environmentValue] of Object.entries(overrides)) {
    if (environmentValue === undefined) {
      delete childEnvironment[environmentKey];
      continue;
    }
    childEnvironment[environmentKey] = environmentValue;
  }

  return childEnvironment;
}

function createBuildVersion() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function readDirectoryFileSnapshot(rootDirectoryPath, snapshotMap) {
  if (!fs.existsSync(rootDirectoryPath)) {
    return;
  }

  const stack = [rootDirectoryPath];
  while (stack.length > 0) {
    const currentDirectoryPath = stack.pop();
    if (currentDirectoryPath === undefined) {
      continue;
    }

    const directoryEntries = fs.readdirSync(currentDirectoryPath, { withFileTypes: true });
    for (const directoryEntry of directoryEntries) {
      const nextPath = path.join(currentDirectoryPath, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        if (IgnoredDirectoryNames.has(directoryEntry.name)) {
          continue;
        }
        stack.push(nextPath);
        continue;
      }

      if (!directoryEntry.isFile()) {
        continue;
      }

      const fileStat = fs.statSync(nextPath);
      snapshotMap.set(nextPath, fileStat.mtimeMs);
    }
  }
}

function readRepositoryFileSnapshot({ watchedDirectoryPaths, watchedFilePaths }) {
  const snapshotMap = new Map();
  for (const watchedDirectoryPath of watchedDirectoryPaths) {
    readDirectoryFileSnapshot(watchedDirectoryPath, snapshotMap);
  }

  for (const watchedFilePath of watchedFilePaths) {
    if (!fs.existsSync(watchedFilePath)) {
      continue;
    }
    const fileStat = fs.statSync(watchedFilePath);
    snapshotMap.set(watchedFilePath, fileStat.mtimeMs);
  }

  return snapshotMap;
}

function computeChangedPaths(previousSnapshot, nextSnapshot) {
  const changedPaths = [];

  for (const [filePath, modificationTime] of nextSnapshot.entries()) {
    const previousModificationTime = previousSnapshot.get(filePath);
    if (previousModificationTime !== modificationTime) {
      changedPaths.push(filePath);
    }
  }

  for (const filePath of previousSnapshot.keys()) {
    if (!nextSnapshot.has(filePath)) {
      changedPaths.push(filePath);
    }
  }

  return changedPaths.sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
}

function formatChangeSummary(changedPaths, repositoryRootPath) {
  if (changedPaths.length === 0) {
    return "No changes detected.";
  }

  const displayedChangedPaths = changedPaths
    .slice(0, 4)
    .map((changedPath) => path.relative(repositoryRootPath, changedPath));
  const suffix =
    changedPaths.length > displayedChangedPaths.length
      ? ` +${String(changedPaths.length - displayedChangedPaths.length)} more`
      : "";

  return `Detected ${String(changedPaths.length)} change(s): ${displayedChangedPaths.join(", ")}${suffix}`;
}

function removeDirectoryIfPresent(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  fs.rmSync(directoryPath, { recursive: true, force: true });
}

async function runCommand({ args, cwd, env, label }) {
  process.stdout.write(`[stable-dev] ${label}\n`);
  await new Promise((resolve, reject) => {
    const child = spawn(bunBinary, args, {
      cwd,
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${label} terminated by ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${label} exited with code ${String(code ?? 1)}`));
        return;
      }
      resolve(undefined);
    });
  });
}

/**
 * Owns the stable-development promotion loop: detect repository quiescence,
 * validate one complete build/test gate, and only then promote the snapshot
 * by restarting the API server and publishing the new web build.
 */
export class StableDevelopmentModeCoordinator {
  scanTimer = null;

  currentSnapshot = new Map();

  changedPaths = new Set();

  lastChangeDetectedAt = Date.now();

  changeSequence = 0;

  validationInProgress = false;

  retainedBuildDirectoryPaths = [];

  apiRuntimeState = "starting";

  apiCrashSummary = null;

  constructor({ configuration, liveReloadServer, repositoryRootPath, webServer }) {
    this.configuration = configuration;
    this.liveReloadServer = liveReloadServer;
    this.repositoryRootPath = repositoryRootPath;
    this.webServer = webServer;
    this.runtimeRootPath = path.join(repositoryRootPath, ".runtime", "stable-dev");
    this.webBuildsRootPath = path.join(this.runtimeRootPath, "web-builds");
    this.watchedDirectoryPaths = [
      path.join(repositoryRootPath, "apps"),
      path.join(repositoryRootPath, "packages"),
    ];
    this.watchedFilePaths = [
      path.join(repositoryRootPath, ".env"),
      path.join(repositoryRootPath, ".env.local"),
      path.join(repositoryRootPath, "bun.lock"),
      path.join(repositoryRootPath, "package.json"),
      path.join(repositoryRootPath, "tsconfig.base.json"),
    ];
    this.baseChildEnvironment = buildChildEnvironment(process.env, {});
    this.statusArtifactOwner = new StableDevelopmentStatusArtifactOwner({
      runtimeRootPath: this.runtimeRootPath,
    });
    this.apiServerOwner = new StableDevelopmentApiServerOwner({
      baseChildEnvironment: this.baseChildEnvironment,
      configuration: this.configuration,
      repositoryRootPath: this.repositoryRootPath,
      statusArtifactOwner: this.statusArtifactOwner,
      onUnexpectedExit: (crashSummary) => {
        this.handleUnexpectedApiExit(crashSummary);
      },
    });
  }

  async start() {
    fs.mkdirSync(this.webBuildsRootPath, { recursive: true });

    await this.liveReloadServer.start();
    await this.webServer.start();

    this.currentSnapshot = readRepositoryFileSnapshot({
      watchedDirectoryPaths: this.watchedDirectoryPaths,
      watchedFilePaths: this.watchedFilePaths,
    });

    this.updateStatus({
      status: "starting",
      message: "Running initial stable development validation.",
    });

    await this.runValidationCycle("startup");

    this.scanTimer = setInterval(() => {
      void this.scanForChanges();
    }, this.configuration.pollIntervalMilliseconds);

    process.stdout.write(
      `[stable-dev] stable web http://${this.configuration.host}:${String(this.configuration.webPort)} ` +
        `api http://${this.configuration.host}:${String(this.configuration.apiPort)} ` +
        `live-reload http://${this.configuration.host}:${String(this.configuration.liveReloadPort)}\n`,
    );
  }

  async stop() {
    if (this.scanTimer !== null) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    await this.apiServerOwner.stop();
    await this.webServer.stop();
    await this.liveReloadServer.stop();
  }

  async scanForChanges() {
    const nextSnapshot = readRepositoryFileSnapshot({
      watchedDirectoryPaths: this.watchedDirectoryPaths,
      watchedFilePaths: this.watchedFilePaths,
    });
    const changedPaths = computeChangedPaths(this.currentSnapshot, nextSnapshot);
    this.currentSnapshot = nextSnapshot;

    if (changedPaths.length > 0) {
      for (const changedPath of changedPaths) {
        this.changedPaths.add(changedPath);
      }
      this.lastChangeDetectedAt = Date.now();
      this.changeSequence += 1;

      const message = formatChangeSummary([...this.changedPaths], this.repositoryRootPath);
      this.updateStatus({
        status: "waiting",
        message: `${message} Waiting ${String(this.configuration.idleMilliseconds / 1000)} seconds of quiet before validation.`,
      });
    }

    if (!this.validationInProgress && this.changedPaths.size > 0) {
      const quietMilliseconds = Date.now() - this.lastChangeDetectedAt;
      if (quietMilliseconds >= this.configuration.idleMilliseconds) {
        await this.runValidationCycle("changes");
      }
    }
  }

  updateStatus({ status, message, buildVersion = this.webServer.currentBuildVersion }) {
    this.webServer.setStatus({
      status,
      runtimeState: this.apiRuntimeState,
      message,
      crashSummary: this.apiCrashSummary,
    });
    this.liveReloadServer.setState({
      buildVersion,
      status,
      runtimeState: this.apiRuntimeState,
      message,
      crashSummary: this.apiCrashSummary,
    });
    this.statusArtifactOwner.writeStatus({
      buildVersion,
      status,
      runtimeState: this.apiRuntimeState,
      message,
      crashSummary: this.apiCrashSummary,
    });
  }

  async runValidationCycle(reason) {
    if (this.validationInProgress) {
      return;
    }

    this.validationInProgress = true;
    const validationSequence = this.changeSequence;
    const changedPaths = [...this.changedPaths];
    this.changedPaths.clear();
    const buildVersion = createBuildVersion();
    const candidateBuildDirectoryPath = path.join(this.webBuildsRootPath, buildVersion);

    try {
      this.apiCrashSummary = null;
      this.updateStatus({
        status: "validating",
        message:
          reason === "startup"
            ? "Validating initial stable development snapshot."
            : `Validating ${String(changedPaths.length)} queued change(s).`,
      });

      await this.runValidationCommands({ buildVersion, candidateBuildDirectoryPath });

      if (validationSequence !== this.changeSequence) {
        removeDirectoryIfPresent(candidateBuildDirectoryPath);
        this.updateStatus({
          status: "waiting",
          message:
            "Validation completed, but newer file changes arrived during the run. Waiting for the next quiet window.",
        });
        return;
      }

      await this.promoteValidatedBuild({
        buildVersion,
        buildDirectoryPath: candidateBuildDirectoryPath,
      });
      this.updateStatus({
        status: "ready",
        message: `Serving validated build ${buildVersion}.`,
        buildVersion,
      });
    } catch (error) {
      removeDirectoryIfPresent(candidateBuildDirectoryPath);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: "failed",
        message: `Stable development validation failed: ${errorMessage}`,
      });
    } finally {
      this.validationInProgress = false;
    }
  }

  async runValidationCommands({ buildVersion, candidateBuildDirectoryPath }) {
    removeDirectoryIfPresent(candidateBuildDirectoryPath);
    fs.mkdirSync(candidateBuildDirectoryPath, { recursive: true });

    const buildEnvironment = buildChildEnvironment(this.baseChildEnvironment, {
      VITE_APP_BUILD_ID: buildVersion,
      WEB_BUILD_ID: buildVersion,
    });

    await runCommand({
      args: ["run", "--cwd", "packages/CodexProtocol", "build"],
      cwd: this.repositoryRootPath,
      env: buildEnvironment,
      label: "Build protocol package",
    });
    await runCommand({
      args: ["run", "--cwd", "packages/CodexInterfaceAdapter", "build"],
      cwd: this.repositoryRootPath,
      env: buildEnvironment,
      label: "Build Codex adapter package",
    });
    await runCommand({
      args: ["run", "--cwd", "packages/OpenCodeInterfaceAdapter", "build"],
      cwd: this.repositoryRootPath,
      env: buildEnvironment,
      label: "Build OpenCode adapter package",
    });
    await runCommand({
      args: ["run", "--cwd", "apps/ServerApplication", "build"],
      cwd: this.repositoryRootPath,
      env: buildEnvironment,
      label: "Build stable API server",
    });
    await runCommand({
      args: ["run", "--cwd", "apps/WebApplication", "typecheck"],
      cwd: this.repositoryRootPath,
      env: buildEnvironment,
      label: "Typecheck stable web application",
    });
    await runCommand({
      args: ["x", "vite", "build", "--outDir", candidateBuildDirectoryPath],
      cwd: path.join(this.repositoryRootPath, "apps", "WebApplication"),
      env: buildEnvironment,
      label: "Build stable web snapshot",
    });
    await runCommand({
      args: ["run", "test:ci:stable"],
      cwd: this.repositoryRootPath,
      env: buildEnvironment,
      label: "Run stable development light test suite",
    });
  }

  async promoteValidatedBuild({ buildVersion, buildDirectoryPath }) {
    this.apiCrashSummary = null;
    this.apiRuntimeState = "starting";
    await this.apiServerOwner.start(buildVersion);
    this.apiRuntimeState = "ready";
    this.webServer.setServedBuild({
      buildDirectoryPath,
      buildVersion,
    });
    this.retainedBuildDirectoryPaths.unshift(buildDirectoryPath);
    this.cleanupOldBuildDirectories();
  }

  cleanupOldBuildDirectories() {
    while (this.retainedBuildDirectoryPaths.length > BuildRetentionCount) {
      const removedBuildDirectoryPath = this.retainedBuildDirectoryPaths.pop();
      if (removedBuildDirectoryPath === undefined) {
        continue;
      }
      removeDirectoryIfPresent(removedBuildDirectoryPath);
    }
  }

  handleUnexpectedApiExit(crashSummary) {
    this.apiRuntimeState = "api_crashed";
    this.apiCrashSummary = crashSummary;
    const crashHeadline =
      `[stable-dev] Stable API child crashed. status=${crashSummary.latestStatusPath} ` +
      `crash-json=${crashSummary.latestCrashJsonPath} crash-ndjson=${crashSummary.latestCrashNdjsonPath}\n`;
    process.stderr.write(crashHeadline);
    this.updateStatus({
      status: "api_crashed",
      buildVersion: this.webServer.currentBuildVersion,
      message:
        `Stable API child crashed at ${crashSummary.occurredAt}. ` +
        `Inspect ${crashSummary.latestStatusPath} and ${crashSummary.latestCrashJsonPath}.`,
    });
  }
}
