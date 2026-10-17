/**
 * Where an undone removal goes back in a list. `before` is the id that
 * followed the item when it was removed; `index` is its old position, used
 * only when that neighbour is gone too. Anchoring to the neighbour keeps the
 * order right when several removals are undone in any order.
 */
export interface RestorePosition {
  index: number;
  before?: string;
}

/** Captures the restore position of `id` in `ids` (call before removing it). */
export function positionIn(ids: readonly string[], id: string): RestorePosition {
  const index = ids.indexOf(id);
  return { index, before: index >= 0 ? ids[index + 1] : undefined };
}

/**
 * Returns a copy of `list` with `item` inserted at `at`: before its old
 * neighbour when that is still in the list, else at the old index (clamped),
 * else at the end.
 */
export function insertAt<T>(list: readonly T[], item: T, idOf: (entry: T) => string, at?: RestorePosition): T[] {
  const next = [...list];
  const anchor = at?.before === undefined ? -1 : next.findIndex((entry) => idOf(entry) === at.before);
  const index = anchor >= 0 ? anchor : Math.min(Math.max(at?.index ?? next.length, 0), next.length);
  next.splice(index, 0, item);
  return next;
}
