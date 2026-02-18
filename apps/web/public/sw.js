self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePushPayload(event) {
  const defaults = {
    title: "Codex response ready",
    body: "A response is ready in Farfield.",
    url: "/",
    threadId: null,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: undefined
  };

  if (!event.data) {
    return defaults;
  }

  try {
    const decoded = JSON.parse(event.data.text());
    const webPush =
      decoded && typeof decoded === "object" && decoded.web_push && typeof decoded.web_push === "object"
        ? decoded.web_push
        : null;
    const notification =
      webPush &&
      typeof webPush === "object" &&
      webPush.notification &&
      typeof webPush.notification === "object"
        ? webPush.notification
        : null;

    const title = isNonEmptyString(decoded.title)
      ? decoded.title
      : isNonEmptyString(notification?.title)
      ? notification.title
      : defaults.title;
    const body = typeof decoded.body === "string"
      ? decoded.body
      : typeof notification?.body === "string"
      ? notification.body
      : defaults.body;
    const url = isNonEmptyString(decoded.url)
      ? decoded.url
      : isNonEmptyString(notification?.navigate)
      ? notification.navigate
      : defaults.url;
    const threadId = isNonEmptyString(decoded.threadId) ? decoded.threadId : null;
    const icon = isNonEmptyString(notification?.icon) ? notification.icon : defaults.icon;
    const badge = isNonEmptyString(notification?.badge) ? notification.badge : defaults.badge;
    const tag = isNonEmptyString(notification?.tag)
      ? notification.tag
      : threadId
      ? `thread:${threadId}`
      : defaults.tag;

    return {
      title,
      body,
      url,
      threadId,
      icon,
      badge,
      tag
    };
  } catch {
    return defaults;
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: {
        url: payload.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification.data?.url ?? "/");
  const absoluteTargetUrl = new URL(targetUrl, self.location.origin).href;
  const targetPathname = new URL(absoluteTargetUrl).pathname;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client && new URL(client.url).pathname === targetPathname) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTargetUrl);
      }

      return undefined;
    })
  );
});
