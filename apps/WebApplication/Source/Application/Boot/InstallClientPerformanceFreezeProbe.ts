import { ClientPerformanceFreezeProbeOwner } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";

export interface GlobalClientPerformanceFreezeProbeHandle {
  remove: () => void;
}

interface WindowWithClientPerformanceFreezeProbeOwner extends Window {
  __farfieldClientPerformanceFreezeProbeInstalled?: boolean;
  __farfieldClientPerformanceFreezeProbeOwner?: ClientPerformanceFreezeProbeOwner;
}

/**
 * Installs bounded client-side freeze diagnostics for live debugging and real-app automation.
 * The probe is lightweight enough for development sessions and exposes a typed owner on `window`
 * so DevTools and Playwright can read one canonical snapshot.
 */
export function installGlobalClientPerformanceFreezeProbe(): GlobalClientPerformanceFreezeProbeHandle {
  const typedWindow = window as WindowWithClientPerformanceFreezeProbeOwner;
  if (typedWindow.__farfieldClientPerformanceFreezeProbeInstalled === true) {
    return {
      remove: () => {
        return;
      },
    };
  }

  const owner = new ClientPerformanceFreezeProbeOwner({
    readTimeOriginMilliseconds: () => performance.timeOrigin,
    readHighResolutionMilliseconds: () => performance.now(),
    readVisibilityState: () => document.visibilityState,
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
  });

  typedWindow.__farfieldClientPerformanceFreezeProbeInstalled = true;
  typedWindow.__farfieldClientPerformanceFreezeProbeOwner = owner;
  owner.start();

  let longTaskObserver: PerformanceObserver | null = null;
  if (typeof PerformanceObserver !== "undefined") {
    try {
      longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          owner.recordLongTask({
            startedAtHighResolutionMilliseconds: entry.startTime,
            durationMilliseconds: entry.duration,
          });
        }
      });
      longTaskObserver.observe({
        type: "longtask",
        buffered: true,
      });
    } catch {
      longTaskObserver = null;
    }
  }

  return {
    remove: () => {
      longTaskObserver?.disconnect();
      owner.stop();
      typedWindow.__farfieldClientPerformanceFreezeProbeInstalled = false;
      delete typedWindow.__farfieldClientPerformanceFreezeProbeOwner;
    },
  };
}
