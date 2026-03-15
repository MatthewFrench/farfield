import { AppServerListThreadsResponseSchema } from "@farfield/protocol";
import { z } from "zod";
import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, openSidebarIfHidden } from "../helpers/app-actions";
import {
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

const PROJECT_KEY_PREFIX = "project:";
const UNKNOWN_PROJECT_KEY = "project:unknown";
const WINDOWS_PATH_SEPARATOR = "\\";
const PROJECT_PATH_SEPARATOR = "/";
const TRAILING_PROJECT_PATH_SEPARATOR_PATTERN = /\/+$/;
const ACTIVE_THREAD_LIST_ENDPOINT =
  "/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at";

const ProjectOrderingThreadSchema = z
  .object({
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    path: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerListThreadsResponseSchema)
  .strict();

interface ProjectMetadata {
  path: string;
  label: string;
  projectCreatedAt: number;
  latestUpdatedAt: number;
}

function normalizeProjectPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const normalizedPathSeparators = trimmed.replaceAll(
    WINDOWS_PATH_SEPARATOR,
    PROJECT_PATH_SEPARATOR,
  );
  const normalized = normalizedPathSeparators.replace(TRAILING_PROJECT_PATH_SEPARATOR_PATTERN, "");
  return normalized.length > 0 ? normalized : normalizedPathSeparators;
}

function readProjectPathFromGroupKey(groupKey: string): string | null {
  if (groupKey === UNKNOWN_PROJECT_KEY) {
    return null;
  }
  if (!groupKey.startsWith(PROJECT_KEY_PREFIX)) {
    return null;
  }
  return normalizeProjectPath(groupKey.slice(PROJECT_KEY_PREFIX.length));
}

function readProjectLabel(projectPath: string): string {
  const pathParts = projectPath.split(PROJECT_PATH_SEPARATOR).filter((part) => part.length > 0);
  return pathParts[pathParts.length - 1] ?? projectPath;
}

function readThreadProjectPath(thread: z.infer<typeof ProjectOrderingThreadSchema>): string | null {
  if (thread.cwd !== undefined) {
    const normalizedCurrentWorkingDirectory = normalizeProjectPath(thread.cwd);
    if (normalizedCurrentWorkingDirectory.length > 0) {
      return normalizedCurrentWorkingDirectory;
    }
  }

  if (thread.path !== undefined && thread.path !== null) {
    const normalizedPath = normalizeProjectPath(thread.path);
    if (normalizedPath.length > 0) {
      return normalizedPath;
    }
  }

  return null;
}

function readExpectedProjectOrderMetadata(
  threads: z.infer<typeof ProjectOrderingThreadSchema>[],
): ProjectMetadata[] {
  const projectMetadataByPath = new Map<string, ProjectMetadata>();
  for (const thread of threads) {
    const projectPath = readThreadProjectPath(thread);
    if (projectPath === null) {
      continue;
    }

    const existingProjectMetadata = projectMetadataByPath.get(projectPath);
    if (!existingProjectMetadata) {
      projectMetadataByPath.set(projectPath, {
        path: projectPath,
        label: readProjectLabel(projectPath),
        projectCreatedAt: thread.createdAt,
        latestUpdatedAt: thread.updatedAt,
      });
      continue;
    }

    existingProjectMetadata.projectCreatedAt = Math.min(
      existingProjectMetadata.projectCreatedAt,
      thread.createdAt,
    );
    existingProjectMetadata.latestUpdatedAt = Math.max(
      existingProjectMetadata.latestUpdatedAt,
      thread.updatedAt,
    );
  }

  return Array.from(projectMetadataByPath.values()).sort((leftProject, rightProject) => {
    if (leftProject.projectCreatedAt !== rightProject.projectCreatedAt) {
      return rightProject.projectCreatedAt - leftProject.projectCreatedAt;
    }
    if (leftProject.latestUpdatedAt !== rightProject.latestUpdatedAt) {
      return rightProject.latestUpdatedAt - leftProject.latestUpdatedAt;
    }
    return leftProject.label.localeCompare(rightProject.label);
  });
}

test("active project groups follow thread-derived project order", async ({ page, sentinel }) => {
  await openAppHome(page);
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);

  const activeThreadListResponse = ThreadListEnvelopeSchema.parse(
    await page.request.get(ACTIVE_THREAD_LIST_ENDPOINT).then((response) => response.json()),
  );
  const projectOrderingThreads = activeThreadListResponse.data.map((thread) =>
    ProjectOrderingThreadSchema.parse(thread),
  );
  const expectedProjectOrderMetadata = readExpectedProjectOrderMetadata(projectOrderingThreads);
  if (expectedProjectOrderMetadata.length === 0) {
    await expectNoUnexpectedClientErrors(sentinel);
    await expectNoUnexpectedWarningsOrErrors(sentinel);
    return;
  }

  const expectedProjectOrderIndexByPath = new Map<string, number>();
  for (const projectMetadata of expectedProjectOrderMetadata) {
    expectedProjectOrderIndexByPath.set(projectMetadata.path, expectedProjectOrderIndexByPath.size);
  }

  const readActiveProjectGroupOrderIndexes = async (): Promise<number[]> => {
    const activeProjectGroupToggleLocator = page.getByTestId("thread-project-group-toggle");
    const activeProjectGroupCount = await activeProjectGroupToggleLocator.count();
    const activeProjectGroupOrderIndexes: number[] = [];

    for (
      let activeProjectGroupIndex = 0;
      activeProjectGroupIndex < activeProjectGroupCount;
      activeProjectGroupIndex += 1
    ) {
      const activeProjectGroupKey = await activeProjectGroupToggleLocator
        .nth(activeProjectGroupIndex)
        .getAttribute("data-project-key");
      if (!activeProjectGroupKey) {
        continue;
      }

      const projectPath = readProjectPathFromGroupKey(activeProjectGroupKey);
      if (projectPath === null) {
        continue;
      }

      const projectOrderIndex = expectedProjectOrderIndexByPath.get(projectPath);
      if (projectOrderIndex === undefined) {
        continue;
      }

      activeProjectGroupOrderIndexes.push(projectOrderIndex);
    }

    return activeProjectGroupOrderIndexes;
  };

  await expect
    .poll(async () => {
      const activeProjectGroupOrderIndexes = await readActiveProjectGroupOrderIndexes();
      for (let index = 1; index < activeProjectGroupOrderIndexes.length; index += 1) {
        const previousOrderIndex = activeProjectGroupOrderIndexes[index - 1];
        const currentOrderIndex = activeProjectGroupOrderIndexes[index];
        if (previousOrderIndex === undefined || currentOrderIndex === undefined) {
          continue;
        }
        if (previousOrderIndex > currentOrderIndex) {
          return false;
        }
      }
      return true;
    })
    .toBe(true);

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
