const NO_THREAD_OWNER_CLIENT_ID_ERROR_MESSAGE =
  "No owner client id is known for this thread yet. Wait for the desktop app to publish a thread event.";

function normalizeOwnerClientId(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolveOwnerClientId(
  threadOwnerById: ReadonlyMap<string, string>,
  threadId: string,
  override?: string
): string {
  const mappedOwnerClientId = normalizeOwnerClientId(threadOwnerById.get(threadId));
  if (mappedOwnerClientId !== null) {
    return mappedOwnerClientId;
  }

  const overrideOwnerClientId = normalizeOwnerClientId(override);
  if (overrideOwnerClientId !== null) {
    return overrideOwnerClientId;
  }

  throw new Error(NO_THREAD_OWNER_CLIENT_ID_ERROR_MESSAGE);
}
