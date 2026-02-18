self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const defaults = {
    title: "Codex response ready",
    body: "A response is ready in Farfield.",
    url: "/",
    threadId: null
  };

  let payload = defaults;
  if (event.data) {
    try {
      const decoded = JSON.parse(event.data.text());
      payload = {
        title: String(decoded.title ?? defaults.title),
        body: String(decoded.body ?? defaults.body),
        url: String(decoded.url ?? defaults.url),
        threadId:
          decoded.threadId === null || decoded.threadId === undefined
            ? null
            : String(decoded.threadId)
      };
    } catch {
      payload = defaults;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.threadId ? `thread:${payload.threadId}` : undefined,
      data: {
        url: payload.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification.data?.url ?? "/");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});

