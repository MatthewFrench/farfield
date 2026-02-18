self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createLocalNotificationId() {
  return `notif_local_${Date.now()}`;
}

function postPushReceipt(receipt) {
  return fetch("/api/push/receipts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...receipt,
      createdAt: new Date().toISOString()
    })
  }).catch(() => undefined);
}

function parsePushPayload(event) {
  const defaults = {
    notificationId: createLocalNotificationId(),
    title: "Codex response ready",
    body: "A response is ready in Farfield.",
    url: "/",
    threadId: null,
    turnId: null,
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
    const turnId = isNonEmptyString(decoded.turnId) ? decoded.turnId : null;
    const notificationId = isNonEmptyString(decoded.notificationId)
      ? decoded.notificationId
      : defaults.notificationId;
    const icon = isNonEmptyString(notification?.icon) ? notification.icon : defaults.icon;
    const badge = isNonEmptyString(notification?.badge) ? notification.badge : defaults.badge;
    const tag = isNonEmptyString(notification?.tag)
      ? notification.tag
      : threadId
      ? `thread:${threadId}`
      : defaults.tag;

    return {
      notificationId,
      title,
      body,
      url,
      threadId,
      turnId,
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
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        tag: payload.tag,
        data: {
          notificationId: payload.notificationId,
          url: payload.url,
          threadId: payload.threadId,
          turnId: payload.turnId
        }
      })
      .then(() =>
        postPushReceipt({
          notificationId: payload.notificationId,
          event: "shown",
          url: payload.url,
          threadId: payload.threadId,
          turnId: payload.turnId
        })
      )
      .catch((error) =>
        postPushReceipt({
          notificationId: payload.notificationId,
          event: "error",
          url: payload.url,
          threadId: payload.threadId,
          turnId: payload.turnId,
          message: String(error)
        })
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification.data?.url ?? "/");
  const notificationId = isNonEmptyString(event.notification.data?.notificationId)
    ? event.notification.data.notificationId
    : createLocalNotificationId();
  const threadId = isNonEmptyString(event.notification.data?.threadId)
    ? event.notification.data.threadId
    : null;
  const turnId = isNonEmptyString(event.notification.data?.turnId)
    ? event.notification.data.turnId
    : null;
  const absoluteTargetUrl = new URL(targetUrl, self.location.origin).href;
  const targetPathname = new URL(absoluteTargetUrl).pathname;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client && new URL(client.url).pathname === targetPathname) {
            await client.focus();
            return;
          }
        }

        const firstClient = windowClients[0];
        if (firstClient && "focus" in firstClient) {
          if ("navigate" in firstClient && typeof firstClient.navigate === "function") {
            await firstClient.navigate(absoluteTargetUrl);
            await firstClient.focus();
            return;
          }
        }

        if (self.clients.openWindow) {
          await self.clients.openWindow(absoluteTargetUrl);
          return;
        }
      })
      .then(() =>
        postPushReceipt({
          notificationId,
          event: "clicked",
          url: targetUrl,
          threadId,
          turnId
        })
      )
      .catch((error) =>
        postPushReceipt({
          notificationId,
          event: "error",
          url: targetUrl,
          threadId,
          turnId,
          message: String(error)
        })
      )
  );
});
