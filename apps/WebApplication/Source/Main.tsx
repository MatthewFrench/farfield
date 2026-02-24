import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./Index.css";
import { reconcilePushSubscription } from "./Features/PushNotifications/DataAccess/PushClientApi";
import { installGlobalClientCrashReporter } from "./Application/Boot/InstallClientErrorReporter";

const SERVICE_WORKER_UPDATE_EVENT_NAME = "farfield-sw-update-available";
const BOOT_STATUS_EVENT_NAME = "farfield:boot-status";

interface BootStatusDetail {
  message: string;
  details?: string;
  isError?: boolean;
  showActions?: boolean;
  detailsOpen?: boolean;
  hmrStatus?: string;
}

interface ViteErrorPayload {
  err: {
    message: string;
    stack?: string;
    plugin?: string;
    id?: string;
  };
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
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

function isStandaloneDisplayMode(): boolean {
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function syncDisplayModeClass(): void {
  document.documentElement.classList.toggle(
    "standalone-display-mode",
    isStandaloneDisplayMode()
  );
}

function readThreadIdFromPathname(pathname: string): string | null {
  const threadMatch = /^\/threads\/([^/?#]+)/.exec(pathname);
  const encodedThreadId = threadMatch?.[1];
  if (!encodedThreadId) {
    return null;
  }
  try {
    const decodedThreadId = decodeURIComponent(encodedThreadId).trim();
    return decodedThreadId.length > 0 ? decodedThreadId : null;
  } catch {
    return null;
  }
}

function installDisplayModeSync(): void {
  const displayModeQuery = window.matchMedia("(display-mode: standalone)");

  syncDisplayModeClass();
  window.addEventListener("focus", syncDisplayModeClass);
  window.addEventListener("pageshow", syncDisplayModeClass);
  if (typeof displayModeQuery.addEventListener === "function") {
    displayModeQuery.addEventListener("change", syncDisplayModeClass);
  }
}

if (typeof window !== "undefined") {
  installDisplayModeSync();
  installGlobalClientCrashReporter({
    source: "farfield-web",
    readThreadId: () => readThreadIdFromPathname(window.location.pathname),
    readUrl: () => window.location.pathname + window.location.search
  });
}

if (import.meta.env.DEV && import.meta.hot) {
  publishBootStatus({
    message: "Loading Farfield",
    hmrStatus: "HMR connected"
  });

  import.meta.hot.on("vite:ws:connect", () => {
    publishBootStatus({
      message: "Loading Farfield",
      isError: false,
      showActions: false,
      detailsOpen: false,
      details: "",
      hmrStatus: "HMR connected"
    });
  });

  import.meta.hot.on("vite:ws:disconnect", () => {
    publishBootStatus({
      message: "Waiting for development server",
      details: "Lost connection to Vite. Start or restart the dev server, then press Retry.",
      isError: true,
      showActions: true,
      detailsOpen: true,
      hmrStatus: "HMR disconnected"
    });
  });

  import.meta.hot.on("vite:beforeUpdate", () => {
    publishBootStatus({
      message: "Applying update",
      isError: false,
      showActions: false,
      detailsOpen: false,
      details: "",
      hmrStatus: "HMR updating"
    });
  });

  import.meta.hot.on("vite:error", (payload: ViteErrorPayload) => {
    const pluginLabel =
      typeof payload.err.plugin === "string" && payload.err.plugin.length > 0
        ? `[${payload.err.plugin}] `
        : "";
    const fileLabel =
      typeof payload.err.id === "string" && payload.err.id.length > 0
        ? `\n${payload.err.id}`
        : "";
    const summary = `${pluginLabel}${payload.err.message}${fileLabel}`.trim();
    const details =
      typeof payload.err.stack === "string" && payload.err.stack.trim().length > 0
        ? payload.err.stack
        : summary;

    publishBootStatus({
      message: "Vite compile error",
      details,
      isError: true,
      showActions: true,
      detailsOpen: true,
      hmrStatus: "HMR compile failed"
    });
  });

  import.meta.hot.on("vite:afterUpdate", () => {
    publishBootStatus({
      message: "Loading Farfield",
      details: "",
      isError: false,
      showActions: false,
      detailsOpen: false,
      hmrStatus: "HMR connected"
    });
  });
}

function dismissBootSplash(): void {
  const splash = document.getElementById("boot-splash");
  if (!splash) {
    return;
  }

  splash.classList.add("boot-splash--hidden");
  window.setTimeout(() => {
    splash.remove();
  }, 220);
}

function notifyServiceWorkerUpdateAvailable(): void {
  window.dispatchEvent(new Event(SERVICE_WORKER_UPDATE_EVENT_NAME));
}

function reconcilePushSubscriptionOnStartup(): void {
  void reconcilePushSubscription().catch(() => {
    // Startup should continue even if push subscription reconciliation fails.
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let didReloadAfterControllerChange = false;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyServiceWorkerUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              notifyServiceWorkerUpdateAvailable();
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (didReloadAfterControllerChange) {
            return;
          }
          if (isServiceWorkerReloadSuppressed()) {
            return;
          }
          didReloadAfterControllerChange = true;
          window.location.reload();
        });

        reconcilePushSubscriptionOnStartup();
      })
      .catch(() => {
        // Service worker registration failures are surfaced via app preflight checks.
      });
  });
}

const applicationRootElement = document.getElementById("root");
if (!applicationRootElement) {
  throw new Error("Failed to mount Farfield: missing #root element");
}

createRoot(applicationRootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (typeof window !== "undefined") {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      dismissBootSplash();
    });
  });
}
