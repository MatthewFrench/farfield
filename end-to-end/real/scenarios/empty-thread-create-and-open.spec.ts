import type { Page } from "@playwright/test";
import { z } from "zod";
import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, openSidebarIfHidden } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

const INITIAL_THREAD_RESPONSE_TEXT = "EMPTY-CREATE-SEED-OK";
const INITIAL_THREAD_MESSAGE = `Reply with exactly ${INITIAL_THREAD_RESPONSE_TEXT} and nothing else.`;
const CREATED_THREAD_RESPONSE_TEXT = "EMPTY-CREATE-COMPOSER-OK";
const CREATED_THREAD_MESSAGE = `Reply with exactly ${CREATED_THREAD_RESPONSE_TEXT} and nothing else.`;
const CURRENT_PROJECT_CONTEXT_STORAGE_KEY = "farfield.threads.composer-project-context.v1";
const LAST_VIEWED_THREAD_STORAGE_KEY = "farfield.threads.last-viewed.v1";
const THREAD_ROUTE_PATTERN = /^\/threads\/([^/?#]+)$/;

const ReadThreadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    thread: z
      .object({
        cwd: z.string().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

function buildUniqueProjectPath(): string {
  return `/tmp/farfield-empty-create-${Date.now()}`;
}

function readThreadIdFromPath(pathname: string): string {
  const match = pathname.match(THREAD_ROUTE_PATTERN);
  if (!match || typeof match[1] !== "string") {
    throw new Error(`Expected a thread route pathname but received: ${pathname}`);
  }
  return decodeURIComponent(match[1]);
}

async function selectThreadFromSidebar(page: Page, threadId: string): Promise<void> {
  const threadRow = page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${threadId}"]`)
    .first();
  await expect(threadRow).toBeVisible();
  await threadRow.click();
}

test("empty composer creates and opens a new managed thread in the owned current project", async ({
  page,
  sentinel,
  stateGuard,
}) => {
  const projectPath = buildUniqueProjectPath();

  const managedSeedThreadId = await stateGuard.createManagedThread({
    agentId: "codex",
    cwd: projectPath,
    ephemeral: false,
  });
  await stateGuard.waitForManagedThreadInActiveList(managedSeedThreadId);
  await stateGuard.waitForManagedThreadReadiness(managedSeedThreadId);

  await openAppHome(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  await openSidebarIfHidden(page);
  await selectThreadFromSidebar(page, managedSeedThreadId);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(page.getByTestId("selected-thread-label")).not.toHaveText("No thread selected");

  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, LAST_VIEWED_THREAD_STORAGE_KEY);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(page.getByTestId("selected-thread-label")).toHaveText("No thread selected");

  const composerInput = page.getByPlaceholder(/Message /i).first();
  const sendButton = page.getByRole("button", { name: "Send" }).first();
  await expect(composerInput).toBeVisible();
  await expect(sendButton).toBeVisible();
  await composerInput.fill(CREATED_THREAD_MESSAGE);
  await expect(sendButton).toBeEnabled();

  stateGuard.allowNextBrowserThreadCreation();
  const createdThreadIdPromise = stateGuard.waitForNextBrowserThreadCreation();
  await sendButton.click();

  const createdThreadId = await createdThreadIdPromise;
  await expect.poll(() => page.url()).toContain(`/threads/${createdThreadId}`);

  await stateGuard.waitForManagedThreadReadiness(createdThreadId);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(
    page.getByTestId("chat-surface").getByText(CREATED_THREAD_RESPONSE_TEXT, { exact: true }),
  ).toBeVisible();

  const readThreadResponse = await page.request.get(
    `/api/threads/${encodeURIComponent(createdThreadId)}?includeTurns=true`,
  );
  expect(readThreadResponse.ok()).toBe(true);
  const parsedReadThreadEnvelope = ReadThreadEnvelopeSchema.parse(await readThreadResponse.json());
  await expect(page.getByTestId("selected-thread-label")).not.toHaveText("No thread selected");

  await openSidebarIfHidden(page);
  await expect(
    page.locator(`[data-testid="thread-list-item"][data-thread-id="${createdThreadId}"]`).first(),
  ).toBeVisible();
  await expectNoErrorBanner(page);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
  await expectNoUnexpectedClientErrors(sentinel);
  expect(parsedReadThreadEnvelope.thread.cwd ?? null).toBe(projectPath);
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, CURRENT_PROJECT_CONTEXT_STORAGE_KEY);
});
