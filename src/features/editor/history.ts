// Undo and redo for the editor, as plain functions so they can be tested without a screen.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const MAX_STEPS = 100;

export const start = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** Records a new state. The old one can be restored with `undo`; anything that was undone is forgotten. */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present];
  if (past.length > MAX_STEPS) past.shift();
  return { past, present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past[h.past.length - 1];
  if (previous === undefined) return h;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
}

/** Replaces the present state without making an undo step, for changes that are part of one gesture (a drag, typing). */
export const replace = <T>(h: History<T>, next: T): History<T> =>
  Object.is(next, h.present) ? h : { ...h, present: next };

/** Marks the start of a gesture: the present state becomes an undo step, and the changes that follow are made with `replace`. */
export function snapshot<T>(h: History<T>): History<T> {
  const past = [...h.past, h.present];
  if (past.length > MAX_STEPS) past.shift();
  return { past, present: h.present, future: [] };
}
