#!/usr/bin/env node

import path from "node:path";
import {
  formatStableDevelopmentHelpText,
  readStableDevelopmentConfiguration,
} from "./StableDevelopmentConfiguration.mjs";
import { StableDevelopmentLiveReloadServer } from "./StableDevelopmentLiveReloadServer.mjs";
import { StableDevelopmentModeCoordinator } from "./StableDevelopmentModeCoordinator.mjs";
import { StableDevelopmentWebServer } from "./StableDevelopmentWebServer.mjs";

function resolveSignalExitCode(signal) {
  if (signal === "SIGINT") {
    return 130;
  }
  if (signal === "SIGTERM") {
    return 143;
  }
  return 1;
}

async function main() {
  const configuration = readStableDevelopmentConfiguration(process.argv.slice(2), process.env);
  if (configuration.showHelp) {
    process.stdout.write(`${formatStableDevelopmentHelpText()}\n`);
    return;
  }

  const repositoryRootPath = path.resolve(process.cwd());
  const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
  const liveReloadServer = new StableDevelopmentLiveReloadServer({
    host: configuration.host,
    port: configuration.liveReloadPort,
  });
  const webServer = new StableDevelopmentWebServer({
    host: configuration.host,
    port: configuration.webPort,
    apiHost: configuration.upstreamApiHost,
    apiPort: configuration.apiPort,
    apiToken,
    liveReloadPort: configuration.liveReloadPort,
    rawTrustedOrigins: process.env["VITE_DEV_PROXY_TRUSTED_ORIGINS"],
  });
  const coordinator = new StableDevelopmentModeCoordinator({
    configuration,
    liveReloadServer,
    repositoryRootPath,
    webServer,
  });

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) {
      return;
    }
    stopping = true;
    await coordinator.stop();
    process.exit(signal === null ? 0 : resolveSignalExitCode(signal));
  };

  process.on("SIGINT", () => {
    void stop("SIGINT");
  });
  process.on("SIGTERM", () => {
    void stop("SIGTERM");
  });

  await coordinator.start();
}

main().catch((error) => {
  process.stderr.write(`[stable-dev] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
