export function isTransientReadThreadError(errorMessage: string): boolean {
  return (
    /failed to load rollout .* is empty/i.test(errorMessage)
    || /thread not loaded in app-server/i.test(errorMessage)
    || /conversation not found/i.test(errorMessage)
  );
}

export function isThreadNotLoadedReadError(errorMessage: string): boolean {
  return /thread not loaded in app-server/i.test(errorMessage);
}
