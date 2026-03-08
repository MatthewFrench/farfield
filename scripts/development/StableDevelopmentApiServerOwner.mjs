import { spawn } from "node:child_process";
import http from "node:http";
import readline from "node:readline";

const bunBinary = process.platform === "win32" ? "bun.exe" : "bun";
const StableApiHealthTimeoutMilliseconds = 15_000;
const StableApiHealthProbeTimeoutMilliseconds = 1_000;
const StableApiHealthProbeRetryDelayMilliseconds = 250;

async function waitForServerHealth({ host, port, timeoutMilliseconds }) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMilliseconds) {
    const isHealthy = await new Promise((resolve) => {
      const healthRequest = http.request(
        {
          host,
          port,
          path: "/healthz",
          method: "GET",
        },
        (response) => {
          response.resume();
          resolve((response.statusCode ?? 500) < 500);
        },
      );

      healthRequest.on("error", () => {
        resolve(false);
      });
      healthRequest.setTimeout(StableApiHealthProbeTimeoutMilliseconds, () => {
        healthRequest.destroy();
        resolve(false);
      });
      healthRequest.end();
    });

    if (isHealthy) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, StableApiHealthProbeRetryDelayMilliseconds);
    });
  }

  throw new Error(
    `Stable API server did not become healthy on ${host}:${String(port)} within ${String(timeoutMilliseconds)}ms`,
  );
}

function mirrorOutputLine(stream, line) {
  if (stream === "stdout") {
    process.stdout.write(`${line}\n`);
    return;
  }

  process.stderr.write(`${line}\n`);
}

/**
 * Owns the long-lived stable API child process, including output mirroring,
 * health probing, and unexpected-exit notification back to the stable coordinator.
 */
export class StableDevelopmentApiServerOwner {
  process = null;

  processExitPromise = null;

  currentBuildVersion = null;

  stopRequested = false;

  constructor({
    baseChildEnvironment,
    configuration,
    repositoryRootPath,
    statusArtifactOwner,
    onUnexpectedExit,
  }) {
    this.baseChildEnvironment = baseChildEnvironment;
    this.configuration = configuration;
    this.repositoryRootPath = repositoryRootPath;
    this.statusArtifactOwner = statusArtifactOwner;
    this.onUnexpectedExit = onUnexpectedExit;
  }

  async start(buildVersion) {
    await this.stop();

    this.statusArtifactOwner.resetOutputTail();
    this.currentBuildVersion = buildVersion;
    this.stopRequested = false;

    const serverEnvironment = {
      ...this.baseChildEnvironment,
      HOST: this.configuration.host,
      PORT: String(this.configuration.apiPort),
      WEB_BUILD_ID: buildVersion,
      VITE_APP_BUILD_ID: buildVersion,
    };
    const serverArguments = ["run", "--cwd", "apps/ServerApplication", "start"];
    if (this.configuration.agentIds.length > 0) {
      serverArguments.push("--", `--agents=${this.configuration.agentIds.join(",")}`);
    }

    const child = spawn(bunBinary, serverArguments, {
      cwd: this.repositoryRootPath,
      env: serverEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.process = child;

    const handleUnexpectedExit = (exitCode, signal) => {
      const crashSummary = this.statusArtifactOwner.recordApiChildCrash({
        buildVersion: this.currentBuildVersion,
        pid: child.pid ?? null,
        exitCode,
        signal,
      });
      this.onUnexpectedExit(crashSummary);
    };

    const stdoutReader = readline.createInterface({ input: child.stdout });
    stdoutReader.on("line", (line) => {
      this.statusArtifactOwner.recordServerOutputLine({
        stream: "stdout",
        line,
      });
      mirrorOutputLine("stdout", line);
    });

    const stderrReader = readline.createInterface({ input: child.stderr });
    stderrReader.on("line", (line) => {
      this.statusArtifactOwner.recordServerOutputLine({
        stream: "stderr",
        line,
      });
      mirrorOutputLine("stderr", line);
    });

    this.processExitPromise = new Promise((resolve) => {
      let unexpectedExitHandled = false;

      const finalize = (exitCode, signal) => {
        stdoutReader.close();
        stderrReader.close();
        if (!this.stopRequested && !unexpectedExitHandled) {
          unexpectedExitHandled = true;
          handleUnexpectedExit(exitCode, signal);
        }
        if (this.process === child) {
          this.process = null;
          this.processExitPromise = null;
        }
        resolve(undefined);
      };

      child.once("error", (error) => {
        this.statusArtifactOwner.recordServerOutputLine({
          stream: "stderr",
          line: `[stable-dev] Stable API child process error: ${error.message}`,
        });
        mirrorOutputLine("stderr", `[stable-dev] Stable API child process error: ${error.message}`);
      });

      child.once("exit", (exitCode, signal) => {
        finalize(exitCode ?? null, signal ?? null);
      });
    });

    await Promise.race([
      waitForServerHealth({
        host: this.configuration.upstreamApiHost,
        port: this.configuration.apiPort,
        timeoutMilliseconds: StableApiHealthTimeoutMilliseconds,
      }),
      this.processExitPromise.then(() => {
        throw new Error("Stable API server exited before becoming healthy");
      }),
    ]);
  }

  async stop() {
    const child = this.process;
    if (child === null) {
      return;
    }

    this.stopRequested = true;
    child.kill("SIGTERM");
    if (this.processExitPromise !== null) {
      await this.processExitPromise;
    }
    this.currentBuildVersion = null;
  }
}
