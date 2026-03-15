export function normalizeNullableIdentifier(identifier: string | null | undefined): string | null {
  if (identifier === null || identifier === undefined || identifier.length === 0) {
    return null;
  }

  const trimmedIdentifier = identifier.trim();
  return trimmedIdentifier.length > 0 ? trimmedIdentifier : null;
}
