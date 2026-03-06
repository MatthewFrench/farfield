/**
 * Owns full-page reload execution so bootstrap flows can mock or defer reload behavior cleanly in tests.
 */
export function reloadApplicationWindow(): void {
  window.location.reload();
}
