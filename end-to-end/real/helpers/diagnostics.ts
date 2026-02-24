export function formatSection(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return `${title}: none`;
  }
  return `${title}:\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export function limitItems(items: string[], maxItems: number): string[] {
  if (items.length <= maxItems) {
    return items;
  }
  const limited = items.slice(0, maxItems);
  limited.push(`... (${String(items.length - maxItems)} more)`);
  return limited;
}

export function buildSignalFailureMessage(
  title: string,
  items: string[],
  maxItems = 10
): string {
  const lines = limitItems(items, maxItems);
  return formatSection(title, lines);
}
