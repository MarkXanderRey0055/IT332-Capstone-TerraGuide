/** Format original submission timestamps in the viewer's local timezone. */
export function formatActivityTimestamp(value: string | null | undefined): string {
  if (!value?.trim()) return 'Unavailable';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unavailable';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
