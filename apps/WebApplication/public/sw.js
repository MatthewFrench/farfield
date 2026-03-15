self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createLocalNotificationId() {
  return `notif_local_${Date.now()}`;
}

function receiptMessage(value) {
  const message = String(value);
  if (message.length <= 500) {
    return message;
  }
  return `${message.slice(0, 497)}...`;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

async function postPushReceipt(receipt) {
  try {
    await fetch("/api/push/receipts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...receipt,
        createdAt: new Date().toISOString()
      })
    });
  } catch {
    return;
  }
}

function parseStrictObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertOnlyKeys(value, allowedKeys, label) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`${label} contains unexpected key: ${key}`);
    }
  }
}

function parseRequiredString(value, label) {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function parseOptionalString(value, label) {
  if (value === undefined) {
    return undefined;
  }
  return parseRequiredString(value, label);
}

function parsePushPayload(event) {
  if (!event.data) {
    throw new Error("Push payload is required");
  }

  let decoded;
  try {
    decoded = JSON.parse(event.data.text());
  } catch (error) {
    throw new Error(`Push payload is not valid JSON: ${receiptMessage(error)}`);
  }

  const payload = parseStrictObject(decoded, "push payload");
  assertOnlyKeys(
    payload,
    ["notificationId", "title", "body", "threadId", "turnId", "url", "createdAt", "web_push"],
    "push payload"
  );

  const notificationId = parseRequiredString(payload.notificationId, "push payload.notificationId");
  const title = parseRequiredString(payload.title, "push payload.title");
  if (typeof payload.body !== "string") {
    throw new Error("push payload.body must be a string");
  }
  const body = payload.body;
  const threadId = parseRequiredString(payload.threadId, "push payload.threadId");
  const turnId = parseRequiredString(payload.turnId, "push payload.turnId");
  const url = parseRequiredString(payload.url, "push payload.url");

  const createdAt = parseRequiredString(payload.createdAt, "push payload.createdAt");
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("push payload.createdAt must be an ISO timestamp");
  }

  let icon = "/icons/icon-192.png";
  let badge = "/icons/icon-192.png";
  let tag = `thread:${threadId}`;

  if (payload.web_push !== undefined) {
    const webPush = parseStrictObject(payload.web_push, "push payload.web_push");
    assertOnlyKeys(webPush, ["notification"], "push payload.web_push");
    const notification = parseStrictObject(webPush.notification, "push payload.web_push.notification");
    assertOnlyKeys(
      notification,
      ["title", "body", "navigate", "icon", "badge", "tag"],
      "push payload.web_push.notification"
    );

    const configuredIcon = parseOptionalString(
      notification.icon,
      "push payload.web_push.notification.icon"
    );
    const configuredBadge = parseOptionalString(
      notification.badge,
      "push payload.web_push.notification.badge"
    );
    const configuredTag = parseOptionalString(
      notification.tag,
      "push payload.web_push.notification.tag"
    );
    if (configuredIcon) {
      icon = configuredIcon;
    }
    if (configuredBadge) {
      badge = configuredBadge;
    }
    if (configuredTag) {
      tag = configuredTag;
    }
  }

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
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = parsePushPayload(event);
      } catch (error) {
        await postPushReceipt({
          notificationId: createLocalNotificationId(),
          event: "error",
          url: "/",
          threadId: null,
          turnId: null,
          message: receiptMessage(`Push payload validation failed: ${receiptMessage(error)}`)
        });
        return;
      }

      try {
        await self.registration.showNotification(payload.title, {
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
        });
        await postPushReceipt({
          notificationId: payload.notificationId,
          event: "shown",
          url: payload.url,
          threadId: payload.threadId,
          turnId: payload.turnId
        });
      } catch (error) {
        await postPushReceipt({
          notificationId: payload.notificationId,
          event: "error",
          url: payload.url,
          threadId: payload.threadId,
          turnId: payload.turnId,
          message: receiptMessage(error)
        });
      }
    })()
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
          message: receiptMessage(error)
        })
      )
  );
});
