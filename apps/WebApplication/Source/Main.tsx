import React from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { App } from "./App";
import "./Index.css";
import { reloadApplicationWindow } from "./Application/Boot/ApplicationWindowReloadOwner";
import { installGlobalClientCrashReporter } from "./Application/Boot/InstallClientErrorReporter";
import { installGlobalClientPerformanceFreezeProbe } from "./Application/Boot/InstallClientPerformanceFreezeProbe";
import { ServiceWorkerControllerChangeReloadOwner } from "./Application/Boot/ServiceWorkerControllerChangeReloadOwner";
import {
  ServiceWorkerReloadEligibilityOwner,
  type WebShellVersionSnapshot,
} from "./Application/Boot/ServiceWorkerReloadEligibilityOwner";
import { getWebShellHealth } from "./Application/DataAccess/WebShellApi";
import { ApplicationRouteStateMapper } from "./Application/DomainModel/ApplicationRouteStateMapper";
import { reconcilePushSubscription } from "./Features/PushNotifications/DataAccess/PushClientApi";

const SERVICE_WORKER_UPDATE_EVENT_NAME = "farfield-sw-update-available";
const BOOT_STATUS_EVENT_NAME = "farfield:boot-status";
const APPLICATION_ROOT_ELEMENT_IDENTIFIER = "root";
const SERVICE_WORKER_SCRIPT_PATH = "/sw.js";
const DISPLAY_MODE_STANDALONE_MEDIA_QUERY = "(display-mode: standalone)";
const STANDALONE_DISPLAY_MODE_CLASS_NAME = "standalone-display-mode";
const BOOT_SPLASH_ELEMENT_IDENTIFIER = "boot-splash";
const BOOT_SPLASH_HIDDEN_CLASS_NAME = "boot-splash--hidden";
const BOOT_SPLASH_REMOVE_DELAY_MILLISECONDS = 220;
const CLIENT_CRASH_REPORT_SOURCE = "farfield-web";
const DEVELOPMENT_BOOT_STATUS_LOADING_MESSAGE = "Loading Farfield";
const DEVELOPMENT_BOOT_STATUS_WAITING_FOR_SERVER_MESSAGE = "Waiting for development server";
const DEVELOPMENT_BOOT_STATUS_WAITING_FOR_SERVER_DETAILS =
  "Lost connection to Vite. Start or restart the dev server, then press Retry.";
const DEVELOPMENT_BOOT_STATUS_APPLYING_UPDATE_MESSAGE = "Applying update";
const DEVELOPMENT_BOOT_STATUS_COMPILE_ERROR_MESSAGE = "Vite compile error";
const DEVELOPMENT_HMR_STATUS_CONNECTED = "HMR connected";
const DEVELOPMENT_HMR_STATUS_DISCONNECTED = "HMR disconnected";
const DEVELOPMENT_HMR_STATUS_UPDATING = "HMR updating";
const DEVELOPMENT_HMR_STATUS_COMPILE_FAILED = "HMR compile failed";
const applicationRouteStateMapper = new ApplicationRouteStateMapper();

interface BootStatusDetail {
  message: string;
  details?: string;
  isError?: boolean;
  showActions?: boolean;
  detailsOpen?: boolean;
  hmrStatus?: string;
}

const ViteErrorPayloadSchema = z
  .object({
    err: z
      .object({
        message: z.string(),
        stack: z.string().optional(),
        plugin: z.string().optional(),
        id: z.string().optional(),
      })
      .strict(),
  })
  .strict();

type ViteErrorPayload = z.infer<typeof ViteErrorPayloadSchema>;

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

interface NavigatorWithOptionalServiceWorker {
  serviceWorker?: ServiceWorkerContainer;
}

interface WindowWithSwReloadSuppression extends Window {
  __farfieldSuppressSwReload?: boolean;
}

function isServiceWorkerReloadSuppressed(): boolean {
  const windowWithSuppression = window as WindowWithSwReloadSuppression;
  return windowWithSuppression.__farfieldSuppressSwReload === true;
}

function publishBootStatus(detail: BootStatusDetail): void {
  window.dispatchEvent(new CustomEvent<BootStatusDetail>(BOOT_STATUS_EVENT_NAME, { detail }));
}

function publishConnectedDevelopmentBootStatus(): void {
  publishBootStatus({
    message: DEVELOPMENT_BOOT_STATUS_LOADING_MESSAGE,
    details: "",
    isError: false,
    showActions: false,
    detailsOpen: false,
    hmrStatus: DEVELOPMENT_HMR_STATUS_CONNECTED,
  });
}

function publishDisconnectedDevelopmentBootStatus(): void {
  publishBootStatus({
    message: DEVELOPMENT_BOOT_STATUS_WAITING_FOR_SERVER_MESSAGE,
    details: DEVELOPMENT_BOOT_STATUS_WAITING_FOR_SERVER_DETAILS,
    isError: true,
    showActions: true,
    detailsOpen: true,
    hmrStatus: DEVELOPMENT_HMR_STATUS_DISCONNECTED,
  });
}

function publishUpdatingDevelopmentBootStatus(): void {
  publishBootStatus({
    message: DEVELOPMENT_BOOT_STATUS_APPLYING_UPDATE_MESSAGE,
    details: "",
    isError: false,
    showActions: false,
    detailsOpen: false,
    hmrStatus: DEVELOPMENT_HMR_STATUS_UPDATING,
  });
}

function publishCompileFailedDevelopmentBootStatus(details: string): void {
  publishBootStatus({
    message: DEVELOPMENT_BOOT_STATUS_COMPILE_ERROR_MESSAGE,
    details,
    isError: true,
    showActions: true,
    detailsOpen: true,
    hmrStatus: DEVELOPMENT_HMR_STATUS_COMPILE_FAILED,
  });
}

function isStandaloneDisplayMode(): boolean {
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  return (
    window.matchMedia(DISPLAY_MODE_STANDALONE_MEDIA_QUERY).matches ||
    navigatorWithStandalone.standalone === true
  );
}

function syncDisplayModeClass(): void {
  document.documentElement.classList.toggle(
    STANDALONE_DISPLAY_MODE_CLASS_NAME,
    isStandaloneDisplayMode(),
  );
}

function installDisplayModeSync(): void {
  const displayModeQuery = window.matchMedia(DISPLAY_MODE_STANDALONE_MEDIA_QUERY);

  syncDisplayModeClass();
  window.addEventListener("focus", syncDisplayModeClass);
  window.addEventListener("pageshow", syncDisplayModeClass);
  displayModeQuery.addEventListener("change", syncDisplayModeClass);
}

function installBootstrapWindowOwners(): void {
  installDisplayModeSync();
  installGlobalClientCrashReporter({
    source: CLIENT_CRASH_REPORT_SOURCE,
    readThreadId: () =>
      applicationRouteStateMapper.parseFromLocation(
        window.location.pathname,
        window.location.search,
      ).threadId,
    readUrl: () => window.location.pathname + window.location.search,
  });
  if (import.meta.env.DEV) {
    installGlobalClientPerformanceFreezeProbe();
  }
}

installBootstrapWindowOwners();

function installDevelopmentBootStatusPublisher(): void {
  if (!import.meta.env.DEV || !import.meta.hot) {
    return;
  }

  publishConnectedDevelopmentBootStatus();

  import.meta.hot.on("vite:ws:connect", () => {
    publishConnectedDevelopmentBootStatus();
  });

  import.meta.hot.on("vite:ws:disconnect", () => {
    publishDisconnectedDevelopmentBootStatus();
  });

  import.meta.hot.on("vite:beforeUpdate", () => {
    publishUpdatingDevelopmentBootStatus();
  });

  import.meta.hot.on("vite:error", (payload: ViteErrorPayload) => {
    const parsedPayload = ViteErrorPayloadSchema.parse(payload);
    const pluginLabel =
      parsedPayload.err.plugin !== undefined && parsedPayload.err.plugin.length > 0
        ? `[${parsedPayload.err.plugin}] `
        : "";
    const fileLabel =
      parsedPayload.err.id !== undefined && parsedPayload.err.id.length > 0
        ? `\n${parsedPayload.err.id}`
        : "";
    const summary = `${pluginLabel}${parsedPayload.err.message}${fileLabel}`.trim();
    const details =
      parsedPayload.err.stack !== undefined && parsedPayload.err.stack.trim().length > 0
        ? parsedPayload.err.stack
        : summary;

    publishCompileFailedDevelopmentBootStatus(details);
  });

  import.meta.hot.on("vite:afterUpdate", () => {
    publishConnectedDevelopmentBootStatus();
  });
}

function dismissBootSplash(): void {
  const splash = document.getElementById(BOOT_SPLASH_ELEMENT_IDENTIFIER);
  if (!splash) {
    return;
  }

  splash.classList.add(BOOT_SPLASH_HIDDEN_CLASS_NAME);
  // Delay removal so any boot-splash exit transition can finish before the node is detached.
  window.setTimeout(() => {
    splash.remove();
  }, BOOT_SPLASH_REMOVE_DELAY_MILLISECONDS);
}

function notifyServiceWorkerUpdateAvailable(): void {
  window.dispatchEvent(new Event(SERVICE_WORKER_UPDATE_EVENT_NAME));
}

async function readWebShellVersionSnapshot(): Promise<WebShellVersionSnapshot | null> {
  try {
    const healthResponse = await getWebShellHealth();
    return {
      buildId: healthResponse.buildId,
      gitCommit: healthResponse.gitCommit,
      serviceWorkerVersion: healthResponse.serviceWorkerVersion,
    };
  } catch {
    return null;
  }
}

function reconcilePushSubscriptionOnStartup(): void {
  void reconcilePushSubscription().catch(() => {
    // Startup should continue even if push subscription reconciliation fails.
  });
}

function installServiceWorkerStartupRegistration(): void {
  const navigatorWithOptionalServiceWorker = window.navigator as NavigatorWithOptionalServiceWorker;
  const serviceWorkerContainer = navigatorWithOptionalServiceWorker.serviceWorker;
  if (serviceWorkerContainer === undefined) {
    return;
  }

  const initialWebShellVersionSnapshotPromise = readWebShellVersionSnapshot();

  window.addEventListener("load", () => {
    const serviceWorkerControllerChangeReloadOwner = new ServiceWorkerControllerChangeReloadOwner(
      serviceWorkerContainer.controller !== null,
    );
    const serviceWorkerReloadEligibilityOwner = new ServiceWorkerReloadEligibilityOwner(null);
    let hasPendingServiceWorkerUpdate = false;

    void initialWebShellVersionSnapshotPromise.then((initialVersionSnapshot) => {
      serviceWorkerReloadEligibilityOwner.setInitialVersionSnapshot(initialVersionSnapshot);
    });

    void serviceWorkerContainer
      .register(SERVICE_WORKER_SCRIPT_PATH)
      .then((registration) => {
        const markPendingServiceWorkerUpdate = (): void => {
          hasPendingServiceWorkerUpdate = true;
          notifyServiceWorkerUpdateAvailable();
        };

        if (registration.waiting && serviceWorkerContainer.controller) {
          markPendingServiceWorkerUpdate();
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && serviceWorkerContainer.controller) {
              markPendingServiceWorkerUpdate();
            }
          });
        });

        serviceWorkerContainer.addEventListener("controllerchange", () => {
          void (async () => {
            const reloadDecision = serviceWorkerControllerChangeReloadOwner.readDecision({
              reloadSuppressed: isServiceWorkerReloadSuppressed(),
            });
            if (!reloadDecision.shouldReload) {
              return;
            }

            const currentVersionSnapshot = await readWebShellVersionSnapshot();
            const shouldReload = serviceWorkerReloadEligibilityOwner.readShouldReload({
              hasPendingUpdate: hasPendingServiceWorkerUpdate,
              nextVersionSnapshot: currentVersionSnapshot,
            });
            serviceWorkerControllerChangeReloadOwner.completePendingReloadDecision(shouldReload);
            if (!shouldReload) {
              return;
            }

            publishUpdatingDevelopmentBootStatus();
            reloadApplicationWindow();
          })();
        });

        reconcilePushSubscriptionOnStartup();
      })
      .catch(() => {
        // Service worker registration failures are surfaced via app preflight checks.
      });
  });
}

function mountApplication(): void {
  const applicationRootElement = document.getElementById(APPLICATION_ROOT_ELEMENT_IDENTIFIER);
  if (!applicationRootElement) {
    throw new Error("Failed to mount Farfield: missing #root element");
  }

  createRoot(applicationRootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

function scheduleBootSplashDismissal(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Wait two paint ticks so React has rendered before removing the static bootstrap splash.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      dismissBootSplash();
    });
  });
}

installDevelopmentBootStatusPublisher();
installServiceWorkerStartupRegistration();
mountApplication();
scheduleBootSplashDismissal();
