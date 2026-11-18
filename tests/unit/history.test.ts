import { describe, expect, it } from "vitest";
import { MAX_STEPS, commit, redo, replace, snapshot, start, undo } from "@/features/editor/history";

describe("editor history", () => {
  it("undoes and redoes in order", () => {
    let h = start(["a"]);
    h = commit(h, ["a", "b"]);
    h = commit(h, ["a", "b", "c"]);
    h = undo(h);
    expect(h.present).toEqual(["a", "b"]);
    h = undo(h);
    expect(h.present).toEqual(["a"]);
    h = redo(h);
    expect(h.present).toEqual(["a", "b"]);
  });

  it("forgets what was undone when something new is done", () => {
    let h = commit(start(1), 2);
    h = undo(h);
    h = commit(h, 3);
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe(3);
  });

  it("does nothing at either end", () => {
    const h = start(1);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("makes no step when nothing changed", () => {
    const state = { n: 1 };
    const h = start(state);
    expect(commit(h, state)).toBe(h);
  });

  it("keeps at most 100 steps", () => {
    let h = start(0);
    for (let i = 1; i <= MAX_STEPS + 20; i++) h = commit(h, i);
    expect(h.past).toHaveLength(MAX_STEPS);
    expect(h.past[0]).toBe(20);
  });

  it("replace changes the present without an undo step", () => {
    let h = commit(start(1), 2);
    h = replace(h, 5);
    expect(h.past).toEqual([1]);
    expect(undo(h).present).toBe(1);
  });

  it("a gesture is one undo step however many changes it makes", () => {
    let h = start(0);
    h = snapshot(h);
    for (const n of [1, 2, 3]) h = replace(h, n);
    expect(h.present).toBe(3);
    expect(undo(h).present).toBe(0);
  });
});
