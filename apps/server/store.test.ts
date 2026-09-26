import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTaskStore } from "./store.js";

describe("SQLite task store", () => {
  let directory: string;
  let store: ReturnType<typeof createTaskStore>;

  afterEach(() => {
    store?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  function openStore() {
    directory = mkdtempSync(join(tmpdir(), "mantooth-tasks-test-"));
    store = createTaskStore(join(directory, "tasks.sqlite3"));
    return store;
  }

  it("migrates an empty data directory and starts with an empty inbox", () => {
    const tasks = openStore();

    expect(tasks.isReady()).toBe(true);
    expect(tasks.list("inbox")).toEqual([]);
  });

  it("moves tasks into Today and transactionally applies the requested order", () => {
    const tasks = openStore();
    const first = tasks.create("Plan the week");
    const second = tasks.create("Water the plants");
    tasks.moveToToday(first.id);
    tasks.moveToToday(second.id);

    expect(tasks.reorderToday([second.id, first.id]).map((task) => task.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(() => tasks.reorderToday([first.id, first.id])).toThrow(/exactly the Today tasks/i);
    expect(tasks.list("today").map((task) => task.id)).toEqual([second.id, first.id]);
  });

  it("moves a task out of Today and compacts remaining positions", () => {
    const tasks = openStore();
    const first = tasks.create("First");
    const second = tasks.create("Second");
    const third = tasks.create("Third");
    tasks.moveToToday(first.id);
    tasks.moveToToday(second.id);
    tasks.moveToToday(third.id);
    tasks.moveToInbox(second.id);

    expect(tasks.list("today").map((task) => task.id)).toEqual([first.id, third.id]);
    expect(tasks.list("inbox").map((task) => task.id)).toContain(second.id);
  });

  it("completes, reopens, edits, and deletes tasks", () => {
    const tasks = openStore();
    const task = tasks.create("Read a chapter");
    const completed = tasks.complete(task.id);

    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
    expect(tasks.list("completed")).toHaveLength(1);
    expect(tasks.reopen(task.id).status).toBe("inbox");
    expect(tasks.updateTitle(task.id, "Read two chapters").title).toBe("Read two chapters");

    tasks.remove(task.id);
    expect(tasks.list("inbox")).toEqual([]);
    expect(() => tasks.remove(task.id)).toThrow(/not found/i);
  });

  it("preserves the same task ID after closing and reopening the database", () => {
    const tasks = openStore();
    const created = tasks.create("Survive a restart");
    tasks.close();
    store = createTaskStore(join(directory, "tasks.sqlite3"));

    expect(store.list("inbox")).toEqual([created]);
  });
});
