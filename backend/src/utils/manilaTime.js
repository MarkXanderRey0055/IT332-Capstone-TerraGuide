
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function toManila(date) {
  return new Date(date.getTime() + MANILA_OFFSET_MS);
}


export function getStartOfManilaMonth(date = new Date()) {
  const m = toManila(date);
  return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1, 0, 0, 0) - MANILA_OFFSET_MS);
}

export function getManilaYearBounds(date = new Date()) {
  const m = toManila(date);
  const year = m.getUTCFullYear();
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0) - MANILA_OFFSET_MS),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0) - MANILA_OFFSET_MS),
  };
}
