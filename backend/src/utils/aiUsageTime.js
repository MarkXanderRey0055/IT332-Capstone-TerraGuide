const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getUsageDateKey(date = new Date()) {
  const manilaTime = new Date(date.getTime() + MANILA_OFFSET_MS);
  const year = manilaTime.getUTCFullYear();
  const month = String(manilaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(manilaTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextResetAt(date = new Date()) {
  const manilaTime = new Date(date.getTime() + MANILA_OFFSET_MS);
  const year = manilaTime.getUTCFullYear();
  const month = manilaTime.getUTCMonth();
  const day = manilaTime.getUTCDate();

  const nextManilaMidnightAsUtcMs = Date.UTC(year, month, day + 1, 0, 0, 0) - MANILA_OFFSET_MS;
  return new Date(nextManilaMidnightAsUtcMs);
}
