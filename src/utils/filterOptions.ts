export function filterSelectOptions(options: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter((opt) => opt.toLowerCase().includes(normalized));
}
