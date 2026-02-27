import fs from "node:fs";
import path from "node:path";

const DIRECTORY_REQUIRED_ERROR_MESSAGE = "Directory is required";
const DIRECTORY_DOES_NOT_EXIST_ERROR_PREFIX = "Directory does not exist";
const PATH_IS_NOT_DIRECTORY_ERROR_PREFIX = "Path is not a directory";

function hasTrimmedText(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.trim().length > 0;
}

function resolveDirectoryPath(directory: string): string {
  return path.resolve(directory.trim());
}

/**
 * Owns directory normalization/validation and thread-to-directory cache state for OpenCode.
 */
export class OpenCodeDirectoryOwner {
  private readonly threadDirectoryById = new Map<string, string>();

  public normalizeDirectoryInput(directory: string): string {
    const trimmed = directory.trim();
    if (trimmed.length === 0) {
      throw new Error(DIRECTORY_REQUIRED_ERROR_MESSAGE);
    }

    const resolved = resolveDirectoryPath(trimmed);
    if (!fs.existsSync(resolved)) {
      throw new Error(`${DIRECTORY_DOES_NOT_EXIST_ERROR_PREFIX}: ${resolved}`);
    }
    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) {
      throw new Error(`${PATH_IS_NOT_DIRECTORY_ERROR_PREFIX}: ${resolved}`);
    }
    return resolved;
  }

  public normalizeDirectoryList(directories: string[]): string[] {
    const deduplicatedDirectories = new Set<string>();
    for (const directory of directories) {
      const normalizedDirectory = directory.trim();
      if (normalizedDirectory.length > 0) {
        deduplicatedDirectories.add(path.resolve(normalizedDirectory));
      }
    }
    return Array.from(deduplicatedDirectories).sort((left, right) => left.localeCompare(right));
  }

  public async resolveSessionDirectories(
    inputDirectory: string | null,
    listProjectDirectories: () => Promise<string[]>,
  ): Promise<string[]> {
    if (hasTrimmedText(inputDirectory)) {
      return [this.normalizeDirectoryInput(inputDirectory)];
    }
    return listProjectDirectories();
  }

  public cacheThreadDirectory(threadId: string, directory: string | undefined): void {
    if (!hasTrimmedText(directory)) {
      return;
    }
    // OpenCode can return workspace paths with outer whitespace; trim before caching so later requests reuse a valid path.
    this.threadDirectoryById.set(threadId, resolveDirectoryPath(directory));
  }

  public resolveThreadDirectory(threadId: string): string | undefined {
    const directory = this.threadDirectoryById.get(threadId);
    if (directory === undefined || directory.length === 0) {
      return undefined;
    }
    return path.resolve(directory);
  }
}
