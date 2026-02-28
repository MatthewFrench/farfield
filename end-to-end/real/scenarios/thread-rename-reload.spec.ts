import { z } from "zod";
import { expect, type Page, test } from "../fixtures/real-app.fixture";
import { openAppHome, openSidebarIfHidden, selectFirstThreadIfAny } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

const THREADS_ROUTE_PATTERN = "**/api/threads?*";
const PERSISTED_THREAD_LABEL = "Farfield thread label persistence check";
const THREAD_LABEL_SAMPLE_COUNT = 16;
const THREAD_LABEL_SAMPLE_INTERVAL_MILLISECONDS = 35;
const DELAYED_THREAD_REQUEST_LIMIT = 2;
const THREAD_REQUEST_DELAY_MILLISECONDS = 450;

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z
        .object({
          id: z.string().min(1),
        })
        .passthrough(),
    ),
  })
  .passthrough();

type ThreadListEnvelope = z.infer<typeof ThreadListEnvelopeSchema>;

async function readThreadLabel(page: Page, threadId: string): Promise<string> {
  const threadLabel = page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${threadId}"] span`)
    .first();
  await expect(threadLabel).toBeVisible();
  const textContent = await threadLabel.textContent();
  return (textContent ?? "").trim();
}

async function sampleThreadLabelValues(page: Page, threadId: string): Promise<string[]> {
  const labelSamples: string[] = [];
  for (let sampleIndex = 0; sampleIndex < THREAD_LABEL_SAMPLE_COUNT; sampleIndex += 1) {
    labelSamples.push(await readThreadLabel(page, threadId));
    await page.waitForTimeout(THREAD_LABEL_SAMPLE_INTERVAL_MILLISECONDS);
  }
  return labelSamples;
}

function buildThreadListEnvelopeWithPatchedThreadName(
  envelope: ThreadListEnvelope,
  threadId: string,
): ThreadListEnvelope {
  return {
    ...envelope,
    data: envelope.data.map((thread) => {
      if (thread.id !== threadId) {
        return thread;
      }
      return {
        ...thread,
        threadName: PERSISTED_THREAD_LABEL,
      };
    }),
  };
}

test("thread rename persists across reload with stable sidebar labeling", async ({
  page,
  sentinel,
}) => {
  let delayedRequestCount = 0;
  let renamedThreadIdentifier: string | null = null;

  await page.route(THREADS_ROUTE_PATTERN, async (route) => {
    if (delayedRequestCount < DELAYED_THREAD_REQUEST_LIMIT) {
      delayedRequestCount += 1;
      await page.waitForTimeout(THREAD_REQUEST_DELAY_MILLISECONDS);
    }

    const response = await route.fetch();
    if (renamedThreadIdentifier === null) {
      await route.fulfill({ response });
      return;
    }

    const responseBody = await response.json();
    const parsedThreadListEnvelope = ThreadListEnvelopeSchema.safeParse(responseBody);
    if (!parsedThreadListEnvelope.success) {
      await route.fulfill({ response });
      return;
    }

    const nextResponseBody = buildThreadListEnvelopeWithPatchedThreadName(
      parsedThreadListEnvelope.data,
      renamedThreadIdentifier,
    );
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: JSON.stringify(nextResponseBody),
    });
  });

  await openAppHome(page);
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const selection = await selectFirstThreadIfAny(page);
  if (!selection.selected || selection.threadId === undefined) {
    await page.unroute(THREADS_ROUTE_PATTERN);
    return;
  }

  renamedThreadIdentifier = selection.threadId;
  const labelBeforeReload = await readThreadLabel(page, renamedThreadIdentifier);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const labelSamples = await sampleThreadLabelValues(page, renamedThreadIdentifier);
  expect(new Set(labelSamples)).toEqual(new Set([PERSISTED_THREAD_LABEL]));
  expect(labelSamples).not.toContain(labelBeforeReload);

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
  await page.unroute(THREADS_ROUTE_PATTERN);
});
